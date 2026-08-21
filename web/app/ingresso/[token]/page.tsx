import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RetryButton } from "@/components/retry-button";
import { TicketEventHeading, TicketFace } from "@/components/ticket-face";
import { messageFor } from "@/lib/errors";
import { loadSharedTicket } from "@/lib/ticket-reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Ingresso compartilhado",
  robots: { index: false, follow: false },
};

export default async function SharedTicketPage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const result = await loadSharedTicket(token);

  if (!result.ok) {
    if (result.status === 404) notFound();

    return (
      <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Ingresso indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const ticket = result.data;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-5 px-4 py-6">
      <p className="chip self-start">Ingresso compartilhado com você</p>

      <TicketEventHeading event={ticket.event} />

      <TicketFace ticket={ticket}>
        <p className="w-full text-sm text-muted">
          Mostre este código na entrada. Se a câmera falhar, o texto acima pode
          ser digitado na portaria.
        </p>
      </TicketFace>

      <p className="notice">
        Este ingresso entra uma vez só, e a primeira leitura na portaria é a que
        vale. Se quem compartilhou apresentar o mesmo código antes de você, a sua
        entrada será recusada. O link também pode ser revogado a qualquer momento
        por quem o enviou.
      </p>

      <Link href="/" className="btn-quiet">
        Ver outros eventos
      </Link>
    </main>
  );
}
