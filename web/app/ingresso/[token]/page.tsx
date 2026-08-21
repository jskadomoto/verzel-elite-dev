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
      <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Ingresso indisponível</h1>
        <p>{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const ticket = result.data;

  return (
    <main className="flex min-h-full flex-col gap-4 px-4 py-6">
      <p className="text-sm opacity-80">Ingresso compartilhado com você.</p>

      <TicketEventHeading event={ticket.event} />

      <TicketFace ticket={ticket}>
        <p className="w-full text-sm opacity-80">
          Mostre este código na entrada. Se a câmera falhar, o texto acima pode
          ser digitado na portaria.
        </p>
      </TicketFace>

      <p className="rounded border p-3 text-sm">
        Este ingresso entra uma vez só, e a primeira leitura na portaria é a que
        vale. Se quem compartilhou apresentar o mesmo código antes de você, a
        sua entrada será recusada. O link também pode ser revogado a qualquer
        momento por quem o enviou.
      </p>

      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
      >
        Ver outros eventos
      </Link>
    </main>
  );
}
