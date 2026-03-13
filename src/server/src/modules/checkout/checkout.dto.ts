import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class CheckoutSelectionDto {
  @ValidateIf((payload) => payload.deliveryMode === "DELIVERY")
  @IsString()
  @IsNotEmpty()
  addressId?: string;

  @IsString()
  @IsIn(["PICKUP", "DELIVERY"])
  deliveryMode!: "PICKUP" | "DELIVERY";

  /**
   * Optional total the client computed during the checkout summary step.
   * When present, the server rejects the order if the live-computed total
   * has drifted by more than ₹0.01 (e.g. dealer pricing changed mid-session).
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedTotal?: number;
}
