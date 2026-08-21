import { detailsOf } from "./errors";
import type { Tier } from "./events";

export type OrderStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

export type OrderItem = {
  id: string;
  orderId: string;
  tierId: string;
  quantity: number;
  unitPriceCents: number;
};

export type Order = {
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

export type OrderWithItems = Order & { items: OrderItem[] };

export type Ticket = {
  id: string;
  orderId: string;
  eventId: string;
  tierId: string;
  seatLabel: string;
  status: "VALID" | "USED" | "CANCELLED";
  createdAt: string;
};

export type OrderDetail = OrderWithItems & { tickets: Ticket[] };

export type Payment = {
  id: string;
  orderId: string;
  status: "APPROVED" | "DECLINED";
  cardLast4: string | null;
  declineReason: string | null;
  createdAt: string;
};

export type PaymentResult = {
  payment: Payment;
  order: Order;
  tickets: Ticket[];
};

export const MAX_PER_TIER = 6;
export const MAX_TIERS_PER_ORDER = 6;

export type ChosenQuantities = Record<string, number>;

export const quantitiesFor = (available: number) =>
  Array.from(
    { length: Math.min(available, MAX_PER_TIER) + 1 },
    (_, quantity) => quantity,
  );

export const chosenTiers = (chosen: ChosenQuantities) =>
  Object.entries(chosen)
    .filter(([, quantity]) => quantity > 0)
    .map(([tierId, quantity]) => ({ tierId, quantity }));

export const totalOf = (tiers: Tier[], chosen: ChosenQuantities) =>
  tiers.reduce(
    (total, tier) => total + tier.priceCents * (chosen[tier.id] ?? 0),
    0,
  );

export const seatsOf = (chosen: ChosenQuantities) =>
  Object.values(chosen).reduce((seats, quantity) => seats + quantity, 0);

export function settledStatusOf(payload: unknown): OrderStatus | null {
  const details = detailsOf(payload);
  if (typeof details !== "object" || details === null) return null;

  const { status } = details as { status?: unknown };
  return status === "PENDING" ||
    status === "PAID" ||
    status === "EXPIRED" ||
    status === "CANCELLED"
    ? status
    : null;
}

export function orderIdOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { id } = payload as { id?: unknown };
  return typeof id === "string" ? id : null;
}

export const checkoutHref = (orderId: string) =>
  `/minha-conta/pedidos/${orderId}`;

export const confirmationHref = (orderId: string) =>
  `${checkoutHref(orderId)}/confirmacao`;

export const orderHref = (order: Order) =>
  order.status === "PAID" ? confirmationHref(order.id) : checkoutHref(order.id);

export const eventHref = (eventId: string) => `/eventos/${eventId}`;

export function newIdempotencyKey(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) return generated;

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const remainingMsOf = (holdExpiresAt: string, now: number) =>
  Math.max(0, Date.parse(holdExpiresAt) - now);

export const holdIsOver = (order: Order, now: number) =>
  remainingMsOf(order.holdExpiresAt, now) === 0;

export const displayStatusOf = (order: Order, now: number): OrderStatus =>
  order.status === "PENDING" && holdIsOver(order, now)
    ? "EXPIRED"
    : order.status;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Reserva expirada",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_CHIP: Record<OrderStatus, string> = {
  PENDING: "border-attention/40 bg-attention/15 text-attention",
  PAID: "border-success/40 bg-success/15 text-success",
  EXPIRED: "border-line-strong bg-surface-raised text-faint",
  CANCELLED: "border-danger/50 bg-danger/15 text-danger",
};

export type CheckoutBlock = "EXPIRED" | "PAID" | "CANCELLED" | "SETTLED";

export function blockOf(order: Order, now: number): CheckoutBlock | null {
  if (order.status === "PAID") return "PAID";
  if (order.status === "CANCELLED") return "CANCELLED";
  if (order.status === "EXPIRED" || holdIsOver(order, now)) return "EXPIRED";
  return null;
}

export function formatRemaining(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type TestCard = { number: string; outcome: string };

export const TEST_CARDS: TestCard[] = [
  { number: "4242 4242 4242 4242", outcome: "aprova" },
  { number: "4242 4242 4242 4241", outcome: "número inválido" },
  { number: "4000 0000 0000 0002", outcome: "recusado pelo emissor" },
  { number: "4000 0000 0000 9995", outcome: "saldo insuficiente" },
  { number: "4000 0000 0000 0069", outcome: "cartão vencido" },
  { number: "4000 0000 0000 0127", outcome: "cartão bloqueado" },
];
