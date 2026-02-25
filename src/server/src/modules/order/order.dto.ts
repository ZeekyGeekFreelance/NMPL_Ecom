import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class UpdateTrackingStatusDto {
  @IsNotEmpty({ message: "Status is required" })
  @IsString({ message: "Status must be a string" })
  @IsIn(["PLACED", "CONFIRMED", "REJECTED", "DELIVERED"], {
    message:
      "Status must be one of: PLACED, CONFIRMED, REJECTED, DELIVERED",
  })
  status!: string;
}
