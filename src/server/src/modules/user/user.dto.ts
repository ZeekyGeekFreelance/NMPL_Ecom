import {
  IsArray,
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
  @IsIn(["USER", "ADMIN", "SUPERADMIN"], {
    message: "Role must be USER, ADMIN, or SUPERADMIN",
  })
  role?: string;
}

export class UserIdDto {
  @IsNotEmpty({ message: "ID is required" })
  @IsString({ message: "ID must be a string" })
  id!: string;
}

export class UpdateOwnProfileDto {
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(80, { message: "Name must be at most 80 characters long" })
  name!: string;
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
  @Matches(/^[0-9()+\-\s]{7,20}$/, {
    message:
      "Phone number must be 7-20 characters and contain only valid digits/symbols",
  })
  phone!: string;

  @IsNotEmpty({ message: "Password is required" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @IsString({ message: "Password must be a string" })
  password!: string;
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
  @Matches(/^[0-9()+\-\s]{7,20}$/, {
    message:
      "Contact phone must be 7-20 characters and contain only valid digits/symbols",
  })
  contactPhone!: string;
}

export class UpdateDealerStatusDto {
  @IsNotEmpty({ message: "Status is required" })
  @IsIn(["PENDING", "APPROVED", "REJECTED"], {
    message: "Status must be PENDING, APPROVED, or REJECTED",
  })
  status!: "PENDING" | "APPROVED" | "REJECTED";
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
