import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class CheckoutSelectionDto {
  @IsString()
  @IsNotEmpty()
  addressId!: string;

  @IsString()
  @IsIn(["PICKUP", "DELIVERY"])
  deliveryMode!: "PICKUP" | "DELIVERY";
}
