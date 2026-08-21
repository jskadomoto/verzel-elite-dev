import Link from "next/link";
import {
  displayStatusOf,
  orderHref,
  ORDER_STATUS_CHIP,
  ORDER_STATUS_LABEL,
} from "@/lib/checkout";
import { messageFor } from "@/lib/errors";
import {
  formatBrl,
  formatEventDateTimeLong,
  formatHourMinute,
} from "@/lib/format";
import { isCancellable, loadOrders, seatsIn } from "@/lib/orders";
import { CancelOrder } from "./cancel-order";
import { RetryButton } from "./retry-button";

export async function MyOrders() {
  const result = await loadOrders();

  if (!result.ok) {
    return (
      <section className="mt-8 flex flex-col items-start gap-3">
        <h2 className="micro-label">Meus pedidos</h2>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </section>
    );
  }

  const { items: orders, readAt: now } = result.data;
  if (!orders.length) return null;

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="micro-label">Meus pedidos</h2>

      {orders.map((order) => {
        const status = displayStatusOf(order, now);
        const seats = seatsIn(order);

        return (
          <article key={order.id} className="card flex flex-col gap-3">
            <header className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold break-words">
                  {order.event.title}
                </h3>
                <span
                  className={`chip whitespace-nowrap ${ORDER_STATUS_CHIP[status]}`}
                >
                  {ORDER_STATUS_LABEL[status]}
                </span>
              </div>
              <p className="text-sm font-medium text-gold">
                {formatEventDateTimeLong(
                  order.event.startsAt,
                  order.event.timezone,
                )}
              </p>
            </header>

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted">
                {seats} {seats === 1 ? "ingresso" : "ingressos"}
              </span>
              <span className="text-xl font-bold whitespace-nowrap text-gold">
                {formatBrl(order.totalCents)}
              </span>
            </div>

            {status === "PENDING" ? (
              <p className="text-sm font-medium text-attention">
                A reserva expira às{" "}
                {formatHourMinute(order.holdExpiresAt, order.event.timezone)}.
              </p>
            ) : null}

            <Link
              href={orderHref(order)}
              className={status === "PENDING" ? "btn-primary" : "btn-quiet"}
            >
              {status === "PENDING" ? "Pagar agora" : "Ver pedido"}
            </Link>

            {isCancellable(order, now) ? (
              <CancelOrder orderId={order.id} />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
