import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutBlocked } from "@/components/checkout-blocked";
import { CheckoutPayment } from "@/components/checkout-payment";
import { OrderSummary } from "@/components/order-summary";
import { RetryButton } from "@/components/retry-button";
import { blockOf, confirmationHref, eventHref } from "@/lib/checkout";
import { messageFor } from "@/lib/errors";
import { loadCheckout } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function CheckoutPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const result = await loadCheckout(id);

  if (!result.ok) {
    if (result.status === 404) notFound();
    if (result.status === 401) redirect("/login");

    return (
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Pagamento indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const { order, event, readAt } = result.data;
  const block = blockOf(order, readAt);

  if (block === "PAID") redirect(confirmationHref(order.id));

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href={eventHref(order.eventId)} className="back-link">
        ← Voltar ao evento
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Pagamento</h1>

      {block ? (
        <>
          <CheckoutBlocked
            block={block}
            orderId={order.id}
            eventId={order.eventId}
          />
          <OrderSummary order={order} event={event} />
        </>
      ) : (
        <CheckoutPayment
          orderId={order.id}
          eventId={order.eventId}
          holdExpiresAt={order.holdExpiresAt}
        >
          <OrderSummary order={order} event={event} />
        </CheckoutPayment>
      )}
    </main>
  );
}
