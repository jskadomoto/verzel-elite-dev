import Link from "next/link";
import {
  confirmationHref,
  eventHref,
  type CheckoutBlock,
} from "@/lib/checkout";

const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 text-base";

export function CheckoutBlocked({
  block,
  orderId,
  eventId,
}: Readonly<{ block: CheckoutBlock; orderId: string; eventId: string }>) {
  if (block === "PAID") {
    return (
      <div className="flex flex-col gap-3 rounded border p-4">
        <p className="font-medium">Este pedido já foi pago.</p>
        <p className="text-sm">
          Os ingressos já foram emitidos, e nada foi cobrado de novo.
        </p>
        <Link href={confirmationHref(orderId)} className={linkClass}>
          Ver a confirmação
        </Link>
      </div>
    );
  }

  if (block === "EXPIRED") {
    return (
      <div className="flex flex-col gap-3 rounded border p-4">
        <p className="font-medium">A reserva expirou.</p>
        <p className="text-sm">
          Os ingressos voltaram para a venda. Se ainda houver lugar, você pode
          reservar de novo.
        </p>
        <Link href={eventHref(eventId)} className={linkClass}>
          Voltar ao evento
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <p className="font-medium">
        {block === "CANCELLED"
          ? "Este pedido foi cancelado."
          : "Este pedido não está mais aguardando pagamento."}
      </p>
      <Link href={eventHref(eventId)} className={linkClass}>
        Voltar ao evento
      </Link>
    </div>
  );
}
