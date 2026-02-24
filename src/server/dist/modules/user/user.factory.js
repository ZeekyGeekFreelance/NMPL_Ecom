"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeUserController = void 0;
const user_repository_1 = require("./user.repository");
const user_service_1 = require("./user.service");
const user_controller_1 = require("./user.controller");
const dealerNotification_service_1 = require("@/shared/services/dealerNotification.service");
const makeUserController = () => {
    const repository = new user_repository_1.UserRepository();
    const dealerNotificationService = new dealerNotification_service_1.DealerNotificationService();
    const service = new user_service_1.UserService(repository, dealerNotificationService);
    return new user_controller_1.UserController(service);
};
exports.makeUserController = makeUserController;
