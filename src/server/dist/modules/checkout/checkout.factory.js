"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeCheckoutController = void 0;
const checkout_service_1 = require("./checkout.service");
const checkout_controller_1 = require("./checkout.controller");
const cart_service_1 = require("../cart/cart.service");
const cart_repository_1 = require("../cart/cart.repository");
const order_repository_1 = require("../order/order.repository");
const order_service_1 = require("../order/order.service");
const makeCheckoutController = () => {
    const repo = new cart_repository_1.CartRepository();
    const cartService = new cart_service_1.CartService(repo);
    const orderRepository = new order_repository_1.OrderRepository();
    const orderService = new order_service_1.OrderService(orderRepository);
    const checkoutService = new checkout_service_1.CheckoutService(orderService);
    const controller = new checkout_controller_1.CheckoutController(checkoutService, cartService);
    return controller;
};
exports.makeCheckoutController = makeCheckoutController;
