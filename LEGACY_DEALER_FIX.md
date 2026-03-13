# Legacy Dealer Login Fix

## Issues Identified

1. **Legacy dealers cannot login** - When `mustChangePassword` is true, no tokens are issued but client doesn't handle this
2. **Legacy status not displayed properly** - Admin panel should show both "LEGACY" and "APPROVED" labels
3. **Missing password change flow** - No UI for legacy dealers to change their temporary password

## Root Cause Analysis

### Server-Side (Working Correctly)
The server correctly:
- Returns `requiresPasswordChange: true` for legacy dealers with `mustChangePassword` flag
- Does NOT issue tokens when password change is required
- Has `/auth/change-password` endpoint ready

### Client-Side (Broken)
The dealer sign-in page:
- Does NOT check for `requiresPasswordChange` in response
- Redirects to home without tokens
- No password change page exists for dealers

## Complete Fix

### 1. Update Dealer Sign-In Page

**File:** `src/client/app/(auth)/dealer/sign-in/page.tsx`

Replace the `onSubmit` function:

```typescript
const onSubmit = async (formData: InputForm) => {
  try {
    const response = await signIn({
      ...formData,
      email: normalizeEmailValue(formData.email),
      portal: "DEALER_PORTAL",
    }).unwrap();
    
    // Check if legacy dealer needs to change password
    if ((response as any).requiresPasswordChange) {
      // Store email and password temporarily for password change
      sessionStorage.setItem('dealer_temp_email', formData.email);
      sessionStorage.setItem('dealer_temp_password', formData.password);
      router.push('/dealer/change-password');
      return;
    }
    
    const requestedNextPath = searchParams.get("next");
    const nextPath =
      requestedNextPath && requestedNextPath.startsWith("/")
        ? requestedNextPath
        : null;
    const role = resolveDisplayRole(response.user);
    const destination =
      role === "ADMIN" || role === "SUPERADMIN"
        ? "/dashboard"
        : role === "DEALER"
          ? nextPath || "/"
          : nextPath || "/";
    router.push(destination);
  } catch {
    // Error handled from mutation state.
  }
};
```

### 2. Create Password Change Page

**File:** `src/client/app/(auth)/dealer/change-password/page.tsx`

```typescript
"use client";

import { useForm } from "react-hook-form";
import Input from "@/app/components/atoms/Input";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/templates/MainLayout";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/app/lib/constants/config";
import { useAppDispatch } from "@/app/store/hooks";
import { setUser } from "@/app/store/slices/AuthSlice";

interface InputForm {
  newPassword: string;
  confirmPassword: string;
}

const DealerChangePassword = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('dealer_temp_email');
    const storedPassword = sessionStorage.getItem('dealer_temp_password');
    
    if (!storedEmail || !storedPassword) {
      router.push('/dealer/sign-in');
      return;
    }
    
    setEmail(storedEmail);
    setCurrentPassword(storedPassword);
  }, [router]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<InputForm>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword");

  const onSubmit = async (formData: InputForm) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      // Clear temporary storage
      sessionStorage.removeItem('dealer_temp_email');
      sessionStorage.removeItem('dealer_temp_password');

      // Update user state
      if (data.data?.user) {
        dispatch(setUser({ user: data.data.user }));
      }

      // Redirect to dealer portal
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Unable to change password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <main className="w-full max-w-md bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 text-center mb-2">
            Change Password
          </h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            You must change your temporary password before accessing your dealer account.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-600 text-center text-sm p-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              name="newPassword"
              type="password"
              placeholder="New password"
              control={control}
              validation={{
                required: "New password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters long",
                },
              }}
              error={errors.newPassword?.message}
              className="py-2.5 text-sm"
            />

            <Input
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              control={control}
              validation={{
                required: "Please confirm your password",
                validate: (value: string) =>
                  value === newPassword || "Passwords do not match",
              }}
              error={errors.confirmPassword?.message}
              className="py-2.5 text-sm"
            />

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <Loader2 className="animate-spin mx-auto" size={20} />
              ) : (
                "Change Password & Sign In"
              )}
            </button>
          </form>
        </main>
      </div>
    </MainLayout>
  );
};

export default DealerChangePassword;
```

### 3. Display Legacy Status in Admin Panel

For any admin panel component that displays dealer status, update the badge/label logic:

```typescript
const getDealerStatusBadge = (status: string) => {
  if (status === "LEGACY") {
    return (
      <div className="flex gap-2">
        <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
          LEGACY
        </span>
        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
          APPROVED
        </span>
      </div>
    );
  }
  
  if (status === "APPROVED") {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
        APPROVED
      </span>
    );
  }
  
  if (status === "PENDING") {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-100 text-yellow-800">
        PENDING
      </span>
    );
  }
  
  if (status === "REJECTED") {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
        REJECTED
      </span>
    );
  }
  
  if (status === "SUSPENDED") {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
        SUSPENDED
      </span>
    );
  }
  
  return null;
};
```

## Implementation Steps

1. **Create the directory:**
   ```bash
   mkdir "src\client\app\(auth)\dealer\change-password"
   ```

2. **Create the password change page:**
   - Copy the code from section 2 above into `page.tsx`

3. **Update dealer sign-in page:**
   - Modify the `onSubmit` function as shown in section 1

4. **Update admin panel dealer list:**
   - Find the component that displays dealer status
   - Add the dual badge logic for LEGACY status

## Testing

### Test Legacy Dealer Login:
1. Create a test dealer with `mustChangePassword: true` and `dealerStatus: LEGACY`
2. Try to login at `/dealer/sign-in`
3. Should redirect to `/dealer/change-password`
4. Change password
5. Should login successfully and redirect to dealer portal

### Test Normal Dealer Login:
1. Login with approved dealer (no `mustChangePassword`)
2. Should login directly without password change

### Test Admin Panel:
1. View dealer list in admin panel
2. Legacy dealers should show both "LEGACY" and "APPROVED" badges
3. Normal approved dealers should show only "APPROVED" badge

## Database Query to Check Legacy Dealers

```sql
SELECT 
  u.id,
  u.email,
  u.name,
  u.mustChangePassword,
  dp.status as dealerStatus,
  dp.payLaterEnabled
FROM "User" u
JOIN "DealerProfile" dp ON u.id = dp."userId"
WHERE dp.status = 'LEGACY';
```

## Quick Fix for Existing Legacy Dealers

If you need to manually fix a legacy dealer who can't login:

```sql
-- Option 1: Remove password change requirement (they can use existing password)
UPDATE "User" 
SET "mustChangePassword" = false 
WHERE email = 'legacy-dealer@example.com';

-- Option 2: Reset their password and let them use forgot password flow
UPDATE "User" 
SET "mustChangePassword" = false,
    "resetPasswordToken" = NULL,
    "resetPasswordTokenExpiresAt" = NULL
WHERE email = 'legacy-dealer@example.com';
```

## Summary

The fix ensures:
- ✅ Legacy dealers are redirected to password change page
- ✅ Password change flow works correctly
- ✅ After password change, dealers can login normally
- ✅ Admin panel shows both LEGACY and APPROVED labels
- ✅ Normal dealers continue to work without issues
