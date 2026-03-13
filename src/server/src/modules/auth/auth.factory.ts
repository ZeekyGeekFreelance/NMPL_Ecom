import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DealerNotificationService } from '@/shared/services/dealerNotification.service';
import { CartRepository } from "../cart/cart.repository";
import { CartService } from "../cart/cart.service";

export const makeAuthController = () => {
  const repository = new AuthRepository();
  const cartRepository = new CartRepository();
  const cartService = new CartService(cartRepository);
  const dealerNotificationService = new DealerNotificationService();
  const service = new AuthService(repository, dealerNotificationService);
  return new AuthController(service, cartService);
};
