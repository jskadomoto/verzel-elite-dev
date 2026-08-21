import type { Checkout } from "@/lib/orders";
import { tierNameOf } from "@/lib/orders";
import { formatBrl, formatEventDateTimeLong } from "@/lib/format";

export function OrderSummary({
  order,
  event,
}: Readonly<Pick<Checkout, "order" | "event">>) {
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-lg font-semibold break-words">
        {event ? event.title : "Pedido"}
      </h2>

      {event ? (
        <p className="text-sm text-brand">
          {formatEventDateTimeLong(event.startsAt, event.timezone)}
        </p>
      ) : (
        <p className="text-sm text-muted">
          Este evento saiu do catálogo público desde que você reservou.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="break-words">
              {item.quantity} × {tierNameOf(event, item.tierId)}
            </span>
            <span className="whitespace-nowrap">
              {formatBrl(item.unitPriceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-muted">Total</span>
        <span className="text-xl font-semibold whitespace-nowrap">
          {formatBrl(order.totalCents)}
        </span>
      </div>
    </section>
  );
}
