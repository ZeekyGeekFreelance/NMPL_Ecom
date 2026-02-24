import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DealerNotificationService } from '@/shared/services/dealerNotification.service';

export const makeUserController = () => {
  const repository = new UserRepository();
  const dealerNotificationService = new DealerNotificationService();
  const service = new UserService(repository, dealerNotificationService);
  return new UserController(service);
};
