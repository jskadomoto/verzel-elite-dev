import Link from "next/link";
import { messageFor } from "@/lib/errors";
import { formatEventDateTimeLong } from "@/lib/format";
import { loadTickets } from "@/lib/ticket-reads";
import {
  groupByEvent,
  STATUS_CHIP,
  STATUS_LABEL,
  ticketHref,
} from "@/lib/tickets";
import { RetryButton } from "./retry-button";

export async function MyTickets() {
  const result = await loadTickets();

  if (!result.ok) {
    return (
      <section className="mt-5 flex flex-col items-start gap-3">
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </section>
    );
  }

  const groups = groupByEvent(result.data.tickets);

  if (!groups.length) {
    return (
      <section className="card mt-5 flex flex-col items-start gap-3">
        <p>Você ainda não tem ingressos.</p>
        <p className="text-sm text-muted">
          Escolha um evento no catálogo, reserve e pague para receber o código de
          entrada.
        </p>
        <Link href="/" className="btn-primary">
          Ver eventos
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-5 flex flex-col gap-4">
      <h2 className="sr-only">Meus ingressos</h2>

      {groups.map(({ event, tickets }) => (
        <article key={event.id} className="card flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold break-words">{event.title}</h3>
            <p className="text-sm text-brand">
              {formatEventDateTimeLong(event.startsAt, event.timezone)}
            </p>
            <p className="text-sm break-words text-muted">
              {event.venueName}, {event.city}
            </p>
          </header>

          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ticketHref(ticket.id)}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-line bg-surface-raised px-3 py-2 hover:border-brand"
                >
                  <span className="break-words">
                    {ticket.tier.name}
                    <span className="font-mono text-muted">
                      {" "}
                      {ticket.seatLabel}
                    </span>
                  </span>
                  <span
                    className={`chip whitespace-nowrap ${STATUS_CHIP[ticket.status]}`}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
