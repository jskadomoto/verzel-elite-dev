import { availabilityLabel, formatBrl, formatEventDateTimeLong } from "@/lib/format";
import {
  NOT_EDITABLE_REASON,
  STATUS_LABEL,
  STATUS_STYLE,
  type OrganizerEvent,
  type OrganizerTier,
} from "@/lib/organizer";

export function OrganizerEventView({ event }: { event: OrganizerEvent }) {
  const place = event.state ? `${event.city}, ${event.state}` : event.city;
  const reason = NOT_EDITABLE_REASON[event.status];

  return (
    <div className="flex flex-col gap-4">
      {reason ? <p className="notice">{reason}</p> : null}

      <dl className="flex flex-col gap-2">
        <Line label="Situação">
          <span className={`chip ${STATUS_STYLE[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </Line>
        <Line label="Título">{event.title}</Line>
        <Line label="Categoria">{event.category}</Line>
        <Line label="Data e hora">
          {formatEventDateTimeLong(event.startsAt, event.timezone)}
        </Line>
        <Line label="Local">{`${event.venueName} · ${place}`}</Line>
        {event.address ? <Line label="Endereço">{event.address}</Line> : null}
        {event.description ? (
          <Line label="Descrição">{event.description}</Line>
        ) : null}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Setores</h2>

        {event.tiers.length === 0 ? (
          <p className="notice">Este evento não tem setores.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {event.tiers.map((tier) => (
              <li key={tier.id}>
                <TierLine tier={tier} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TierLine({ tier }: { tier: OrganizerTier }) {
  const soldOut = tier.available === 0;

  return (
    <div
      className={`flex flex-col gap-1 rounded-md border border-line bg-surface p-3 sm:flex-row sm:items-baseline sm:justify-between ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      <span className="font-medium break-words">{tier.name}</span>
      <span className="text-sm text-muted">
        {`${formatBrl(tier.priceCents)} · ${availabilityLabel(tier.available, tier.capacity)}`}
      </span>
    </div>
  );
}

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="label">{label}</dt>
      <dd className="break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}
