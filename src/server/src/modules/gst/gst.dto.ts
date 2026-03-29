import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateGstDto {
  @IsNotEmpty({ message: "name is required" })
  @IsString({ message: "name must be a string" })
  name!: string;

  @Type(() => Number)
  @IsNumber({}, { message: "rate must be a number" })
  @Min(0, { message: "rate cannot be negative" })
  @Max(100, { message: "rate cannot exceed 100" })
  rate!: number;
}

export class UpdateGstDto {
  @IsNotEmpty({ message: "name is required" })
  @IsString({ message: "name must be a string" })
  name!: string;

  @Type(() => Number)
  @IsNumber({}, { message: "rate must be a number" })
  @Min(0, { message: "rate cannot be negative" })
  @Max(100, { message: "rate cannot exceed 100" })
  rate!: number;
}

export class ToggleGstActivationDto {
  @Type(() => Boolean)
  @IsBoolean({ message: "isActive must be a boolean" })
  isActive!: boolean;
}
