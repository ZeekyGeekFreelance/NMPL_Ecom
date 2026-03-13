import AppError from "@/shared/errors/AppError";
import { DeliveryRateRepository } from "./deliveryRate.repository";
import { canonicalizeAddressState } from "../address/address.location";

type UpsertStateRatePayload = {
  charge: number;
  isServiceable?: boolean;
};

export class DeliveryRateService {
  constructor(private deliveryRateRepository: DeliveryRateRepository) {}

  async getAllStateRates() {
    return this.deliveryRateRepository.findAllStateRates();
  }

  async upsertStateRate(stateParam: string, payload: UpsertStateRatePayload) {
    const canonicalState = canonicalizeAddressState(stateParam);
    if (!canonicalState) {
      throw new AppError(400, "Select a valid state.");
    }

    const normalizedCharge = Number(payload.charge);
    if (!Number.isFinite(normalizedCharge) || normalizedCharge < 0) {
      throw new AppError(400, "Delivery fee must be a number greater than or equal to 0.");
    }

    const isServiceable =
      payload.isServiceable === undefined ? true : Boolean(payload.isServiceable);

    return this.deliveryRateRepository.upsertStateRate({
      state: canonicalState,
      charge: Number(normalizedCharge.toFixed(2)),
      isServiceable,
    });
  }

  async deleteStateRate(stateParam: string) {
    const canonicalState = canonicalizeAddressState(stateParam);
    if (!canonicalState) {
      throw new AppError(400, "Select a valid state.");
    }

    const existing = await this.deliveryRateRepository.findStateRateByState(canonicalState);
    if (!existing) {
      throw new AppError(404, "State delivery fee mapping not found.");
    }

    return this.deliveryRateRepository.deleteStateRateByState(canonicalState);
  }
}
