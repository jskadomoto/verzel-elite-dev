import { read, readAuthed, type ReadResult } from "./api";
import { displayStatusOf, type OrderDetail } from "./checkout";
import type { PublicEventDetail } from "./events";

export type Checkout = {
  order: OrderDetail;
  event: PublicEventDetail | null;
  readAt: number;
};

export type OrderEvent = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  title: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  city: string;
  state: string | null;
};

export type OrderSummary = OrderDetail & { event: OrderEvent };

export type OrderListResult = {
  items: OrderSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type OrderListing = OrderListResult & { readAt: number };

export async function loadOrders(): Promise<ReadResult<OrderListing>> {
  const listing = await readAuthed<OrderListResult>("/orders");
  if (!listing.ok) return listing;

  return { ok: true, data: { ...listing.data, readAt: Date.now() } };
}

export const seatsIn = (order: OrderSummary) =>
  order.items.reduce((seats, item) => seats + item.quantity, 0);

export function isCancellable(order: OrderSummary, now: number): boolean {
  const status = displayStatusOf(order, now);
  if (status !== "PENDING" && status !== "PAID") return false;
  if (Date.parse(order.event.startsAt) <= now) return false;
  return order.tickets.every((ticket) => ticket.status !== "USED");
}

export async function loadCheckout(
  orderId: string,
): Promise<ReadResult<Checkout>> {
  const order = await readAuthed<OrderDetail>(
    `/orders/${encodeURIComponent(orderId)}`,
  );
  if (!order.ok) return order;

  const event = await read<PublicEventDetail>(
    `/events/${encodeURIComponent(order.data.eventId)}`,
  );

  return {
    ok: true,
    data: {
      order: order.data,
      event: event.ok ? event.data : null,
      readAt: Date.now(),
    },
  };
}

export const tierNameOf = (event: PublicEventDetail | null, tierId: string) =>
  event?.tiers.find((tier) => tier.id === tierId)?.name ?? "Setor";
