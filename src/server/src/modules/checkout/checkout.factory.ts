import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";
import { CartService } from "../cart/cart.service";
import { CartRepository } from "../cart/cart.repository";
import { OrderRepository } from "../order/order.repository";
import { OrderService } from "../order/order.service";

export const makeCheckoutController = () => {
  const repo = new CartRepository();
  const cartService = new CartService(repo);
  const orderRepository = new OrderRepository();
  const orderService = new OrderService(orderRepository);
  const checkoutService = new CheckoutService(orderService);
  const controller = new CheckoutController(checkoutService, cartService);
  return controller;
};
