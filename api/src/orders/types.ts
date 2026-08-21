export type OrderStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

export type OrderItemInput = {
  tierId: string;
  quantity: number;
};

export type CreateOrderInput = {
  eventId: string;
  items: OrderItemInput[];
  idempotencyKey: string;
};

export type NewOrder = {
  eventId: string;
  customerId: string;
  idempotencyKey: string;
  holdMinutes: number;
};

export type PricedItem = OrderItemInput & {
  unitPriceCents: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  tierId: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderRecord = {
  id: string;
  eventId: string;
  customerId: string;
  status: OrderStatus;
  totalCents: number;
  holdExpiresAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderWithItems = OrderRecord & { items: OrderItem[] };

export type CreatedOrder = {
  order: OrderWithItems;
  created: boolean;
};
