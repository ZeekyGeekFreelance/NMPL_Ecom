import { OrderService } from "../order/order.service";

export class CheckoutService {
  constructor(private orderService: OrderService) {}

  async placeOrder(userId: string, cartId: string) {
    return this.orderService.createOrderFromCart(userId, cartId);
  }
}
