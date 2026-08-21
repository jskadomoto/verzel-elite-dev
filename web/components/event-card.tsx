import Link from "next/link";
import { formatBrl, formatEventDateTime } from "@/lib/format";
import type { PublicEventSummary } from "@/lib/events";

export function EventCard({ event }: { event: PublicEventSummary }) {
  const place = event.state ? `${event.city}, ${event.state}` : event.city;

  return (
    <Link
      href={`/eventos/${event.id}`}
      className="flex min-h-11 flex-col gap-1 rounded border p-4"
    >
      <h2 className="text-lg font-semibold break-words">{event.title}</h2>
      <p className="text-sm">
        {formatEventDateTime(event.startsAt, event.timezone)}
      </p>
      <p className="text-sm break-words">{`${event.venueName} · ${place}`}</p>
      <p className="mt-1 text-sm">
        {event.priceFromCents === null
          ? "Ingressos ainda não disponíveis"
          : `A partir de ${formatBrl(event.priceFromCents)}`}
      </p>
    </Link>
  );
}
