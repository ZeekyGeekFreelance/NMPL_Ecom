import { ChatController } from "./chat.controller";
import { ChatRepository } from "./chat.repository";
import { ChatService } from "./chat.service";

export const makeChatController = () => {
  const repo = new ChatRepository();
  const service = new ChatService(repo);
  const controller = new ChatController(service);

  return controller;
};
