import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  name!: string;

  @IsEmail()
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Phone number is required" })
  @Matches(/^\d{10}$/, { message: "Phone number must be exactly 10 digits" })
  phone!: string;

  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  @Matches(/[!@#$%^&*]/, { message: "Password must contain at least one special character (!@#$%^&*)" })
  password!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: "Email OTP must be a valid 6-digit code" })
  emailOtpCode!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "Phone OTP must be a valid 6-digit code" })
  phoneOtpCode?: string;

  @IsOptional()
  @IsBoolean()
  requestDealerAccess?: boolean;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: "Contact phone must be exactly 10 digits" })
  contactPhone?: string;
}

export class ApplyDealerAccessDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Business name cannot be empty" })
  businessName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: "Contact phone must be exactly 10 digits" })
  contactPhone?: string;
}

export class RequestRegistrationOtpDto {
  @IsEmail()
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: "Phone number is required" })
  @Matches(/^\d{10}$/, { message: "Phone number must be exactly 10 digits" })
  phone!: string;

  @IsOptional()
  @IsIn(["USER_PORTAL", "DEALER_PORTAL"])
  purpose?: "USER_PORTAL" | "DEALER_PORTAL";

  @IsOptional()
  @IsBoolean()
  requestDealerAccess?: boolean;
}

export class SigninDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty({ message: "Password is required" })
  password!: string;

  @IsOptional()
  @IsIn(["USER_PORTAL", "DEALER_PORTAL"], {
    message: "portal must be USER_PORTAL or DEALER_PORTAL",
  })
  portal?: "USER_PORTAL" | "DEALER_PORTAL";
}

export class VerifyEmailDto {
  @IsNotEmpty()
  emailVerificationToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  token!: string;

  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  @Matches(/[!@#$%^&*]/, { message: "Password must contain at least one special character (!@#$%^&*)" })
  newPassword!: string;
}

/**
 * Forced first-login password change for legacy dealer accounts.
 * The client re-submits the temporary password + new password.
 */
export class ChangePasswordOnFirstLoginDto {
  @IsEmail()
  @IsNotEmpty({ message: "Email is required" })
  email!: string;

  @IsNotEmpty({ message: "Current (temporary) password is required" })
  currentPassword!: string;

  @MinLength(8, { message: "New password must be at least 8 characters long" })
  @Matches(/[A-Z]/, { message: "New password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "New password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "New password must contain at least one number" })
  @Matches(/[!@#$%^&*]/, { message: "New password must contain at least one special character (!@#$%^&*)" })
  newPassword!: string;
}

/**
 * Authenticated self-service password change for any logged-in user (including admins).
 * Requires re-verification of the current password before allowing the change.
 */
export class ChangeOwnPasswordDto {
  @IsNotEmpty({ message: "Current password is required" })
  currentPassword!: string;

  @MinLength(8, { message: "New password must be at least 8 characters long" })
  @Matches(/[A-Z]/, { message: "New password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "New password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "New password must contain at least one number" })
  @Matches(/[!@#$%^&*]/, { message: "New password must contain at least one special character (!@#$%^&*)" })
  newPassword!: string;
}

/**
 * SuperAdmin out-of-band emergency reset.
 * Requires the SUPERADMIN_RESET_SECRET shared secret configured in environment.
 * Used when a SuperAdmin cannot log in to change their own password.
 */
export class SuperAdminResetPasswordDto {
  @IsNotEmpty({ message: "Reset secret is required" })
  @IsString()
  resetSecret!: string;

  @IsEmail()
  @IsNotEmpty({ message: "Target email is required" })
  targetEmail!: string;

  @MinLength(8, { message: "New password must be at least 8 characters long" })
  @Matches(/[A-Z]/, { message: "New password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "New password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "New password must contain at least one number" })
  @Matches(/[!@#$%^&*]/, { message: "New password must contain at least one special character (!@#$%^&*)" })
  newPassword!: string;
}
