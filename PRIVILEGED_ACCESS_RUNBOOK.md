# Privileged Access Runbook

This runbook covers:

- how `SUPERADMIN` and `ADMIN` accounts work
- how password changes are persisted to Neon
- how to create the first `SUPERADMIN`
- how to create later `ADMIN` accounts
- how to recover a locked-out `SUPERADMIN`

## 1. Role Model

There is no separate `OWNER` role in this system.

If you created:

- `owner@nmpl.online`

as:

- `SUPERADMIN`

then that account is your owner account operationally, but the actual app role is still `SUPERADMIN`.

The relevant privileged roles are:

- `SUPERADMIN`
- `ADMIN`

## 2. How Changes Sync To Neon

If your server is running with:

- `DATABASE_URL` = Neon pooled URL
- `DIRECT_URL` = Neon direct URL

then all privileged account changes made through the application are written directly to Neon through Prisma.

There is no separate sync job.

That means these actions update Neon immediately:

- first-login password change
- SuperAdmin self password change
- SuperAdmin emergency password reset
- SuperAdmin-issued admin password reset
- SuperAdmin-created admin accounts

You can verify the result in Neon SQL with:

```sql
select
  "email",
  "role",
  "mustChangePassword",
  "tokenVersion",
  "updatedAt"
from "User"
where "role" in ('SUPERADMIN', 'ADMIN')
order by "updatedAt" desc;
```

## 3. Create The First SuperAdmin

Recommended:

```bash
npm run bootstrap:privileged -- SUPERADMIN owner@nmpl.online "Owner Name" "TempPass1!" 9190362986
```

What this does:

- creates a `User` row in Neon with `role=SUPERADMIN`
- hashes the password correctly
- sets `mustChangePassword=true`
- refuses to overwrite an existing email

After that:

1. Sign in with the temporary password.
2. The app will force the `/change-password` flow.
3. Set the real password.
4. From that point onward, the account is active as a normal `SUPERADMIN`.

Emergency alternative:

- create the first `SUPERADMIN` directly in Neon SQL

That is acceptable only for bootstrap, not as the normal operating model.

## 4. Create An Admin

Recommended production path:

- create `ADMIN` accounts only from a signed-in `SUPERADMIN`

Server endpoint:

- `POST /api/v1/users/admin`

Required privileges:

- authenticated `SUPERADMIN`
- valid auth cookies
- valid CSRF token

Request body:

```json
{
  "name": "Admin Name",
  "email": "admin@nmpl.online",
  "phone": "9190362986",
  "password": "TempPass1!",
  "assignBillingSupervisor": false
}
```

What happens:

- the new row is created in Neon with `role=ADMIN`
- the password is hashed
- `mustChangePassword=true`
- the admin must change the temporary password on first sign-in

Important current limitation:

- the repo currently has server support for admin creation, but there is no dedicated client UI flow for creating admins yet

So today, the practical ways to create an `ADMIN` are:

1. use the authenticated API route `POST /api/v1/users/admin`
2. use the bootstrap script for an exceptional/manual case:

```bash
npm run bootstrap:privileged -- ADMIN admin@nmpl.online "Admin Name" "TempPass1!" 9190362986
```

Use the bootstrap script for `ADMIN` only when you intentionally want a manual bootstrap path and you accept that it bypasses the normal signed-in `SUPERADMIN` audit trail.

## 5. SuperAdmin Password Management

### First login with a temporary password

When a `SUPERADMIN` is created with a temporary password:

- sign-in succeeds
- the API returns `requiresPasswordChange=true`
- the client redirects to `/change-password`
- once completed, the new password is stored in Neon immediately

### Regular password change for a signed-in SuperAdmin

Endpoint:

- `POST /api/v1/auth/change-own-password`

Required:

- authenticated session
- current password
- new password
- CSRF token

Request body:

```json
{
  "currentPassword": "CurrentPassword1!",
  "newPassword": "NewPassword2!"
}
```

Behavior:

- updates the password in Neon
- invalidates other sessions
- issues fresh auth cookies

### Locked-out SuperAdmin recovery

Endpoint:

- `POST /api/v1/auth/superadmin/reset-password`

Required:

- `SUPERADMIN_RESET_SECRET` from environment
- target SuperAdmin email
- new strong password
- CSRF token

Request body:

```json
{
  "resetSecret": "your-break-glass-secret",
  "targetEmail": "owner@nmpl.online",
  "newPassword": "RecoveredPass2!"
}
```

Behavior:

- updates the SuperAdmin password in Neon
- invalidates all sessions
- sends recovery notification email

This is the intended break-glass recovery path if you forget the owner/SuperAdmin password.

## 6. Admin Password Management

### First login

Every new `ADMIN` is created with:

- a temporary password
- `mustChangePassword=true`

So the first sign-in always forces a password change.

### Regular admin password changes later

This is intentionally not self-service.

`ADMIN` accounts:

- cannot use public forgot/reset
- cannot use the authenticated self password-change route

Instead, a `SUPERADMIN` must issue a new temporary password.

Endpoint:

- `PATCH /api/v1/users/:id/admin-password`

Required:

- authenticated `SUPERADMIN`
- CSRF token

Request body:

```json
{
  "newPassword": "TempReset2!"
}
```

Behavior:

- writes the new hashed password to Neon
- sets `mustChangePassword=true`
- invalidates current sessions
- forces the admin to rotate the password on the next sign-in

## 7. What Recovery Options You Actually Have

### If you forget the SuperAdmin password

Use one of these, in order:

1. `POST /api/v1/auth/superadmin/reset-password` with `SUPERADMIN_RESET_SECRET`
2. direct Neon SQL update as last resort

Recommended production policy:

- keep one primary named `SUPERADMIN`
- keep one backup named `SUPERADMIN` only if required by your operating model
- store `SUPERADMIN_RESET_SECRET` in a password manager
- store Neon admin access separately as last-resort recovery

### If an Admin forgets the password

The `SUPERADMIN` resets it with:

- `PATCH /api/v1/users/:id/admin-password`

That reset is immediate in Neon and forces the admin through first-login password rotation again.

## 8. Recommended Production Model

- `owner@nmpl.online` should be your main `SUPERADMIN`
- do not keep generic demo `superadmin@example.com` in Neon production
- keep only one or two named `SUPERADMIN` accounts
- use `ADMIN` accounts for day-to-day internal work
- let `SUPERADMIN` handle admin creation and admin password resets
- let dealers/users use their own self-service flows

## 9. Operational Notes

- privileged password changes are not cached client-side; the source of truth is Neon
- if the server points to Neon correctly, there is no separate sync action needed
- `ADMIN` password management is intentionally centralized under `SUPERADMIN`
- public forgot/reset is blocked for `ADMIN` and `SUPERADMIN`

## 10. Current Practical Recommendation

For your current setup:

1. Keep `owner@nmpl.online` as the primary `SUPERADMIN`.
2. Set and store a strong `SUPERADMIN_RESET_SECRET`.
3. Create later admins through the authenticated `SUPERADMIN` flow, not by editing Neon directly.
4. Use Neon SQL only for first bootstrap or last-resort recovery.
