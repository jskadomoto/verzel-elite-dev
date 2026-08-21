import Link from "next/link";
import { formatBrl, formatEventDateTime } from "@/lib/format";
import type { PublicEventSummary } from "@/lib/events";

export function EventCard({ event }: { event: PublicEventSummary }) {
  const place = event.state ? `${event.city}, ${event.state}` : event.city;

  return (
    <Link
      href={`/eventos/${event.id}`}
      className="group flex w-full min-h-11 flex-col gap-2 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-brand"
    >
      <p className="text-sm font-medium text-brand">
        {formatEventDateTime(event.startsAt, event.timezone)}
      </p>

      <h2 className="text-lg font-semibold tracking-tight break-words group-hover:text-brand">
        {event.title}
      </h2>

      <p className="text-sm break-words text-muted">{`${event.venueName} · ${place}`}</p>

      <p className="mt-auto pt-2 text-sm">
        {event.priceFromCents === null ? (
          <span className="text-faint">Ingressos ainda não disponíveis</span>
        ) : (
          <>
            <span className="text-faint">A partir de </span>
            <span className="font-semibold">
              {formatBrl(event.priceFromCents)}
            </span>
          </>
        )}
      </p>
    </Link>
  );
}
