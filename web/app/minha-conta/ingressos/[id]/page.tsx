import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RetryButton } from "@/components/retry-button";
import { ShareControls } from "@/components/share-controls";
import { TicketEventHeading, TicketFace } from "@/components/ticket-face";
import { messageFor } from "@/lib/errors";
import { formatEventDateTime } from "@/lib/format";
import { loadTicket } from "@/lib/ticket-reads";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TicketPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const result = await loadTicket(id);

  if (!result.ok) {
    if (result.status === 404) notFound();
    if (result.status === 401) redirect("/login");

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
      <Link href="/minha-conta" className="back-link">
        ← Meus ingressos
      </Link>

      <TicketEventHeading event={ticket.event} />

      <TicketFace ticket={ticket}>
        <p className="w-full text-sm text-muted">
          Mostre este código na entrada. Se a câmera falhar, o texto acima pode
          ser digitado na portaria.
        </p>
      </TicketFace>

      <ShareControls
        ticketId={ticket.id}
        share={ticket.share}
        expiresLabel={
          ticket.share
            ? formatEventDateTime(ticket.share.expiresAt, ticket.event.timezone)
            : ""
        }
        lastOpenedLabel={
          ticket.share?.lastOpenedAt
            ? formatEventDateTime(
                ticket.share.lastOpenedAt,
                ticket.event.timezone,
              )
            : null
        }
      />
    </main>
  );
}
