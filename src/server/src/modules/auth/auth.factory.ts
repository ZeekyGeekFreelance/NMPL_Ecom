import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DealerNotificationService } from '@/shared/services/dealerNotification.service';

export const makeAuthController = () => {
  const repository = new AuthRepository();
  const dealerNotificationService = new DealerNotificationService();
  const service = new AuthService(repository, dealerNotificationService);
  return new AuthController(service);
};
