import Link from "next/link";
import { OrganizerPagination } from "@/components/organizer-pagination";
import { RetryButton } from "@/components/retry-button";
import type { ReadResult } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { formatEventDateTime } from "@/lib/format";
import {
  STATUS_LABEL,
  STATUS_STYLE,
  type OrganizerEvent,
  type OrganizerListResult,
} from "@/lib/organizer";

const linkClass = "inline-flex min-h-11 items-center rounded border px-4";

export function OrganizerEventList({
  page,
  listing,
}: {
  page: number;
  listing: ReadResult<OrganizerListResult>;
}) {
  if (!listing.ok) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>{messageFor(listing.code)}</p>
        <RetryButton />
      </div>
    );
  }

  const { items, pageSize, total } = listing.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm opacity-70">
          {total} {total === 1 ? "evento" : "eventos"}
        </p>
        <Link href="/organizador/novo" className={linkClass}>
          Criar evento
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p>
            Você ainda não tem eventos. Comece importando um do catálogo externo
            ou criando do zero.
          </p>
          <Link href="/organizador/novo" className={linkClass}>
            Criar meu primeiro evento
          </Link>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((event) => (
              <li key={event.id}>
                <OrganizerEventRow event={event} />
              </li>
            ))}
          </ul>

          <OrganizerPagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}

function OrganizerEventRow({ event }: { event: OrganizerEvent }) {
  const place = event.state ? `${event.city}, ${event.state}` : event.city;

  return (
    <Link
      href={`/organizador/eventos/${event.id}`}
      className="flex min-h-11 flex-col gap-1 rounded border p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded border px-2 py-0.5 text-sm ${STATUS_STYLE[event.status]}`}
        >
          {STATUS_LABEL[event.status]}
        </span>
        <span className="text-sm opacity-70">
          {event.tiers.length} {event.tiers.length === 1 ? "setor" : "setores"}
        </span>
      </div>

      <p className="font-semibold break-words">{event.title}</p>
      <p className="text-sm">
        {formatEventDateTime(event.startsAt, event.timezone)}
      </p>
      <p className="text-sm break-words">{place}</p>
    </Link>
  );
}
