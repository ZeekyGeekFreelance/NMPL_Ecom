import { DeliveryRateController } from "./deliveryRate.controller";
import { DeliveryRateRepository } from "./deliveryRate.repository";
import { DeliveryRateService } from "./deliveryRate.service";

export const makeDeliveryRateController = () => {
  const repository = new DeliveryRateRepository();
  const service = new DeliveryRateService(repository);
  return new DeliveryRateController(service);
};
