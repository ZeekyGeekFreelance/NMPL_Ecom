import {
  IsBoolean,
  IsEnum,
  Matches,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { ADDRESS_TYPE } from "@prisma/client";

export class CreateAddressDto {
  @IsOptional()
  @IsEnum(ADDRESS_TYPE)
  type?: ADDRESS_TYPE;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^\d{10}$/, {
    message: "Phone number must be exactly 10 digits",
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 255)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  state!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^india$/i, {
    message: "Country must be India",
  })
  @Length(2, 120)
  country!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: "Pincode must be exactly 6 digits",
  })
  pincode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsEnum(ADDRESS_TYPE)
  type?: ADDRESS_TYPE;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^\d{10}$/, {
    message: "Phone number must be exactly 10 digits",
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(5, 255)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  state?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^india$/i, {
    message: "Country must be India",
  })
  @Length(2, 120)
  country?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: "Pincode must be exactly 6 digits",
  })
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
