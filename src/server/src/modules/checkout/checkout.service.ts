import { OrderService } from "../order/order.service";

export class CheckoutService {
  constructor(private orderService: OrderService) {}

  async getCheckoutSummary(
    userId: string,
    data: { addressId?: string; deliveryMode: "PICKUP" | "DELIVERY" }
  ) {
    return this.orderService.buildCheckoutSummaryFromUserCart(
      userId,
      data.addressId,
      data.deliveryMode
    );
  }

  async placeOrder(
    userId: string,
    cartId: string,
    data: { addressId?: string; deliveryMode: "PICKUP" | "DELIVERY"; expectedTotal?: number }
  ) {
    return this.orderService.createOrderFromCart(
      userId,
      cartId,
      data.addressId,
      data.deliveryMode,
      data.expectedTotal
    );
  }
}
