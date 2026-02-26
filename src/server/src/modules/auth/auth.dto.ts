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
  @IsNotEmpty({
    message: "Name is required",
  })
  @MinLength(2, {
    message: "Name must be at least 2 characters long",
  })
  name!: string;

  @IsEmail()
  @IsNotEmpty({
    message: "Email is required",
  })
  email!: string;

  @MinLength(8, {
    message: "Password must be at least 8 characters long",
  })
  @Matches(/[A-Z]/, {
    message: "Password must contain at least one uppercase letter",
  })
  @Matches(/[a-z]/, {
    message: "Password must contain at least one lowercase letter",
  })
  @Matches(/[0-9]/, {
    message: "Password must contain at least one number",
  })
  @Matches(/[!@#$%^&*]/, {
    message: "Password must contain at least one special character (!@#$%^&*)",
  })
  password!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, {
    message: "OTP must be a valid 6-digit code",
  })
  otpCode!: string;

  @IsOptional()
  @IsBoolean()
  requestDealerAccess?: boolean;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class RequestRegistrationOtpDto {
  @IsEmail()
  @IsNotEmpty({
    message: "Email is required",
  })
  email!: string;

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

  @IsNotEmpty({
    message: "Password is required",
  })
  password!: string;
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

  @MinLength(8, {
    message: "Password must be at least 8 characters long",
  })
  @Matches(/[A-Z]/, {
    message: "Password must contain at least one uppercase letter",
  })
  @Matches(/[a-z]/, {
    message: "Password must contain at least one lowercase letter",
  })
  @Matches(/[0-9]/, {
    message: "Password must contain at least one number",
  })
  @Matches(/[!@#$%^&*]/, {
    message: "Password must contain at least one special character (!@#$%^&*)",
  })
  newPassword!: string;
}
