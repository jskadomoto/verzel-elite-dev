import { formatEventDateTime, formatEventDateTimeLong } from "@/lib/format";
import {
  STATUS_CHIP,
  STATUS_LABEL,
  type SharedTicket,
  type TicketEvent,
  type TicketStatus,
} from "@/lib/tickets";
import { TicketCode } from "./ticket-code";

const NOTE: Record<TicketStatus, string | null> = {
  VALID: null,
  USED: "Este ingresso já entrou. A primeira leitura na portaria é a que vale.",
  CANCELLED: "Este ingresso foi cancelado e não dá acesso ao evento.",
};

export function TicketEventHeading({
  event,
}: Readonly<{ event: TicketEvent }>) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight break-words">
        {event.title}
      </h1>
      <p className="text-sm text-brand">
        {formatEventDateTimeLong(event.startsAt, event.timezone)}
      </p>
      <p className="text-sm break-words text-muted">
        {event.venueName}, {event.city}
      </p>
    </header>
  );
}

export function TicketFace({
  ticket,
  children,
}: Readonly<{ ticket: SharedTicket; children?: React.ReactNode }>) {
  const note = NOTE[ticket.status];

  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-5">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs tracking-widest text-faint uppercase">
            Setor
          </span>
          <span className="text-lg font-semibold break-words">
            {ticket.tier.name}
          </span>
          <span className="font-mono text-sm text-muted">
            lugar {ticket.seatLabel}
          </span>
        </div>

        <span
          className={`chip whitespace-nowrap ${STATUS_CHIP[ticket.status]}`}
        >
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <div className="relative">
        <div className="border-t border-dashed border-line-strong" />
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-ink"
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-ink"
        />
      </div>

      <div className="flex flex-col items-center gap-3 px-4 pt-5 pb-4">
        <div className="paper w-full max-w-86">
          <TicketCode code={ticket.code} status={ticket.status} />
        </div>

        <code className="w-full text-center font-mono text-xs break-all text-faint">
          {ticket.code}
        </code>

        {note ? (
          <p
            className={`w-full text-sm font-medium ${
              ticket.status === "CANCELLED" ? "text-danger" : "text-attention"
            }`}
          >
            {note}
          </p>
        ) : (
          children
        )}

        {ticket.usedAt ? (
          <p className="w-full text-sm text-muted">
            Entrada registrada em{" "}
            {formatEventDateTime(ticket.usedAt, ticket.event.timezone)}.
          </p>
        ) : null}
      </div>
    </section>
  );
}
