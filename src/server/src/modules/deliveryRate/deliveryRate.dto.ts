import { IsBoolean, IsNumber, IsOptional, Min } from "class-validator";

export class UpsertStateDeliveryRateDto {
  @IsNumber({}, { message: "charge must be a number" })
  @Min(0, { message: "charge cannot be negative" })
  charge!: number;

  @IsOptional()
  @IsBoolean({ message: "isServiceable must be a boolean" })
  isServiceable?: boolean;
}
