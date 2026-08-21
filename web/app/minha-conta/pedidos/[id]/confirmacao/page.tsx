import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CancelOrder } from "@/components/cancel-order";
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
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-5 px-4 py-6">
        <h1 className="text-xl font-semibold">Confirmação indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const { order, event } = result.data;

  if (order.status !== "PAID") redirect(checkoutHref(order.id));

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <span className="chip self-start border-success/40 bg-success/15 text-success">
          Pagamento aprovado
        </span>
        <h1 className="text-2xl font-extrabold">Seus ingressos foram emitidos</h1>
      </header>

      <OrderSummary order={order} event={event} />

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {order.tickets.length === 1
            ? "Seu ingresso"
            : `Seus ${order.tickets.length} ingressos`}
        </h2>

        <ul className="flex flex-col gap-2">
          {order.tickets.map((ticket) => (
            <li
              key={ticket.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-line bg-surface-raised px-3 py-2"
            >
              <span className="break-words">
                {tierNameOf(event, ticket.tierId)}
              </span>
              <span className="font-mono whitespace-nowrap text-muted">
                lugar {ticket.seatLabel}
              </span>
            </li>
          ))}
        </ul>

        <Link href="/minha-conta" className="btn-primary">
          Ver meus ingressos
        </Link>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={eventHref(order.eventId)} className="btn-quiet">
          Voltar ao evento
        </Link>
        <Link href="/" className="btn-quiet">
          Ver outros eventos
        </Link>
      </div>

      <CancelOrder orderId={order.id} />
    </main>
  );
}
