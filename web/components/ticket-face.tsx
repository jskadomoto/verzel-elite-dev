import { formatEventDateTime, formatEventDateTimeLong } from "@/lib/format";
import {
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
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold break-words">{event.title}</h1>
      <p className="text-sm">
        {formatEventDateTimeLong(event.startsAt, event.timezone)}
      </p>
      <p className="text-sm break-words opacity-80">
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
    <section className="flex flex-col items-center gap-3 rounded border p-4">
      <div className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-lg break-words">
          {ticket.tier.name}
          <span className="font-mono"> {ticket.seatLabel}</span>
        </span>
        <span
          className={`whitespace-nowrap ${
            ticket.status === "VALID" ? "opacity-70" : "font-semibold"
          }`}
        >
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      <TicketCode code={ticket.code} status={ticket.status} />

      <code className="w-full text-center text-xs break-all opacity-70">
        {ticket.code}
      </code>

      {note ? <p className="w-full text-sm font-medium">{note}</p> : children}

      {ticket.usedAt ? (
        <p className="w-full text-sm opacity-80">
          Entrada registrada em{" "}
          {formatEventDateTime(ticket.usedAt, ticket.event.timezone)}.
        </p>
      ) : null}
    </section>
  );
}
