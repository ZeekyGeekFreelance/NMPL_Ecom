import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class UpdateTrackingStatusDto {
  @IsNotEmpty({ message: "Status is required" })
  @IsString({ message: "Status must be a string" })
  @IsIn(
    [
      "PENDING_VERIFICATION",
      "WAITLISTED",
      "AWAITING_PAYMENT",
      "QUOTATION_REJECTED",
      "CONFIRMED",
      "DELIVERED",
    ],
    {
      message:
        "Status must be one of: PENDING_VERIFICATION, WAITLISTED, AWAITING_PAYMENT, QUOTATION_REJECTED, CONFIRMED, DELIVERED",
    }
  )
  status!: string;
}
