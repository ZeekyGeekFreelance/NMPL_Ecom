import { IsIn, IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class CheckoutSelectionDto {
  @ValidateIf((payload) => payload.deliveryMode === "DELIVERY")
  @IsString()
  @IsNotEmpty()
  addressId?: string;

  @IsString()
  @IsIn(["PICKUP", "DELIVERY"])
  deliveryMode!: "PICKUP" | "DELIVERY";
}
