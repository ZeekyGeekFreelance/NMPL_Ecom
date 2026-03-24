import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  Matches,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @IsOptional()
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @IsString()
  password?: string;

  @IsOptional()
  @IsIn(["USER", "DEALER", "ADMIN", "SUPERADMIN"], {
    message: "Role must be USER, DEALER, ADMIN, or SUPERADMIN",
  })
  role?: string;
}

export class UserIdDto {
  @IsNotEmpty({ message: "ID is required" })
  @IsString({ message: "ID must be a string" })
  id!: string;
}

export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(80, { message: "Name must be at most 80 characters long" })
  name?: string;

  @IsOptional()
  @IsString({ message: "Phone number must be a string" })
  @Matches(/^\d{10}$/, {
    message: "Phone number must be exactly 10 digits",
  })
  phone?: string;
}

export class UserEmailDto {
  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;
}

export class CreateAdminDto {
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MinLength(3, { message: "Name must be at least 3 characters long" })
  name!: string;

  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsNotEmpty({ message: "Phone number is required" })
  @IsString({ message: "Phone number must be a string" })
  @Matches(/^\d{10}$/, {
    message: "Phone number must be exactly 10 digits",
  })
  phone!: string;

  @IsNotEmpty({ message: "Password is required" })
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
  @IsString({ message: "Password must be a string" })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: "assignBillingSupervisor must be a boolean" })
  assignBillingSupervisor?: boolean;
}

export class CreateDealerDto {
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MinLength(3, { message: "Name must be at least 3 characters long" })
  name!: string;

  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Invalid email format" })
  email!: string;

  @IsNotEmpty({ message: "Password is required" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @IsString({ message: "Password must be a string" })
  password!: string;

  @IsOptional()
  @IsString({ message: "Business name must be a string" })
  businessName?: string;

  @IsNotEmpty({ message: "Contact phone is required" })
  @IsString({ message: "Contact phone must be a string" })
  @Matches(/^\d{10}$/, {
    message: "Contact phone must be exactly 10 digits",
  })
  contactPhone!: string;

  /**
   * When true, creates a LEGACY pay-later dealer:
   *   - DealerProfile.status = LEGACY
   *   - DealerProfile.payLaterEnabled = true
   *   - User.mustChangePassword = true
   *   - Sends legacy credential email with forced password-change notice
   */
  @IsOptional()
  @IsBoolean({ message: "isLegacy must be a boolean" })
  isLegacy?: boolean;
}

export class UpdateDealerStatusDto {
  @IsNotEmpty({ message: "Status is required" })
  @IsIn(["PENDING", "APPROVED", "LEGACY", "REJECTED", "SUSPENDED"], {
    message: "Status must be PENDING, APPROVED, LEGACY, REJECTED, or SUSPENDED",
  })
  status!: "PENDING" | "APPROVED" | "LEGACY" | "REJECTED" | "SUSPENDED";
}

export class DealerPriceItemDto {
  @IsNotEmpty({ message: "variantId is required" })
  @IsString({ message: "variantId must be a string" })
  variantId!: string;

  @IsNumber({}, { message: "customPrice must be a number" })
  @Min(0, { message: "customPrice cannot be negative" })
  customPrice!: number;
}

export class SetDealerPricesDto {
  @IsArray({ message: "prices must be an array" })
  @ValidateNested({ each: true })
  @Type(() => DealerPriceItemDto)
  prices!: DealerPriceItemDto[];
}

export class UpdateBillingSupervisorDto {
  @IsNotEmpty({ message: "isBillingSupervisor is required" })
  @IsBoolean({ message: "isBillingSupervisor must be a boolean" })
  isBillingSupervisor!: boolean;
}

export class UpdateAdminPasswordDto {
  @IsNotEmpty({ message: "newPassword is required" })
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
