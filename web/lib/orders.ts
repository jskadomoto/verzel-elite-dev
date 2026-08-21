import { read, readAuthed, type ReadResult } from "./api";
import type { OrderDetail } from "./checkout";
import type { PublicEventDetail } from "./events";

export type Checkout = {
  order: OrderDetail;
  event: PublicEventDetail | null;
  readAt: number;
};

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
