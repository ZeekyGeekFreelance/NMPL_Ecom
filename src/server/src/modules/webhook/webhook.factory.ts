import { WebhookService } from "./webhook.service";
import { WebhookController } from "./webhook.controller";

export const makeWebhookController = () => {
  const webhookService = new WebhookService();
  return new WebhookController(webhookService);
};
