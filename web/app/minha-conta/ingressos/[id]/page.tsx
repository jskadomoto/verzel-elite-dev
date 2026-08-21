import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RetryButton } from "@/components/retry-button";
import { TicketEventHeading, TicketFace } from "@/components/ticket-face";
import { messageFor } from "@/lib/errors";
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
      <TicketEventHeading event={ticket.event} />

      <TicketFace ticket={ticket}>
        <p className="w-full text-sm opacity-80">
          Mostre este código na entrada. Se a câmera falhar, o texto acima pode
          ser digitado na portaria.
        </p>
      </TicketFace>

      <Link
        href="/minha-conta"
        className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
      >
        Voltar aos meus ingressos
      </Link>
    </main>
  );
}
