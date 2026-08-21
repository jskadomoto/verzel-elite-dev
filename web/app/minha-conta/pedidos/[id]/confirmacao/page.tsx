import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { RetryButton } from "@/components/retry-button";
import { checkoutHref, eventHref } from "@/lib/checkout";
import { messageFor } from "@/lib/errors";
import { loadCheckout, tierNameOf } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ConfirmationPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const result = await loadCheckout(id);

  if (!result.ok) {
    if (result.status === 404) notFound();
    if (result.status === 401) redirect("/login");

    return (
      <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Confirmação indisponível</h1>
        <p>{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const { order, event } = result.data;

  if (order.status !== "PAID") redirect(checkoutHref(order.id));

  return (
    <main className="flex min-h-full flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Pagamento aprovado</h1>
        <p>Seus ingressos foram emitidos.</p>
      </header>

      <OrderSummary order={order} event={event} />

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="text-lg font-semibold">
          {order.tickets.length === 1
            ? "Seu ingresso"
            : `Seus ${order.tickets.length} ingressos`}
        </h2>

        <ul className="flex flex-col gap-2">
          {order.tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded border p-3"
            >
              <span className="break-words">
                {tierNameOf(event, ticket.tierId)}
              </span>
              <span className="font-mono whitespace-nowrap">
                lugar {ticket.seatLabel}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={eventHref(order.eventId)}
          className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
        >
          Voltar ao evento
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
        >
          Ver outros eventos
        </Link>
      </div>
    </main>
  );
}
