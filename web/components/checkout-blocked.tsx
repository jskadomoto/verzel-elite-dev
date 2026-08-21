import Link from "next/link";
import {
  confirmationHref,
  eventHref,
  type CheckoutBlock,
} from "@/lib/checkout";

export function CheckoutBlocked({
  block,
  orderId,
  eventId,
}: Readonly<{ block: CheckoutBlock; orderId: string; eventId: string }>) {
  if (block === "PAID") {
    return (
      <div className="card flex flex-col gap-3">
        <p className="font-medium">Este pedido já foi pago.</p>
        <p className="text-sm text-muted">
          Os ingressos já foram emitidos, e nada foi cobrado de novo.
        </p>
        <Link href={confirmationHref(orderId)} className="btn-quiet">
          Ver a confirmação
        </Link>
      </div>
    );
  }

  if (block === "EXPIRED") {
    return (
      <div className="card flex flex-col gap-3">
        <p className="font-medium">A reserva expirou.</p>
        <p className="text-sm text-muted">
          Os ingressos voltaram para a venda. Se ainda houver lugar, você pode
          reservar de novo.
        </p>
        <Link href={eventHref(eventId)} className="btn-quiet">
          Voltar ao evento
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <p className="font-medium">
        {block === "CANCELLED"
          ? "Este pedido foi cancelado."
          : "Este pedido não está mais aguardando pagamento."}
      </p>
      <Link href={eventHref(eventId)} className="btn-quiet">
        Voltar ao evento
      </Link>
    </div>
  );
}
