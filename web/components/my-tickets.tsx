import Link from "next/link";
import { messageFor } from "@/lib/errors";
import { formatEventDateTimeLong } from "@/lib/format";
import { loadTickets } from "@/lib/ticket-reads";
import { groupByEvent, STATUS_LABEL, ticketHref } from "@/lib/tickets";
import { RetryButton } from "./retry-button";

export async function MyTickets() {
  const result = await loadTickets();

  if (!result.ok) {
    return (
      <section className="mt-4 flex flex-col items-start gap-3">
        <p>{messageFor(result.code)}</p>
        <RetryButton />
      </section>
    );
  }

  const groups = groupByEvent(result.data.tickets);

  if (!groups.length) {
    return (
      <section className="mt-4 flex flex-col items-start gap-3">
        <p>Você ainda não tem ingressos.</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
        >
          Ver eventos
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-4 flex flex-col gap-5">
      <h2 className="sr-only">Meus ingressos</h2>

      {groups.map(({ event, tickets }) => (
        <article key={event.id} className="flex flex-col gap-3 rounded border p-4">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold break-words">{event.title}</h3>
            <p className="text-sm">
              {formatEventDateTimeLong(event.startsAt, event.timezone)}
            </p>
            <p className="text-sm opacity-80 break-words">
              {event.venueName}, {event.city}
            </p>
          </header>

          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={ticketHref(ticket.id)}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border px-3 py-2"
                >
                  <span className="break-words">
                    {ticket.tier.name}
                    <span className="font-mono"> {ticket.seatLabel}</span>
                  </span>
                  <span
                    className={`text-sm whitespace-nowrap ${
                      ticket.status === "VALID" ? "opacity-70" : "font-semibold"
                    }`}
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
