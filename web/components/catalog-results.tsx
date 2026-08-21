import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { EventCard } from "@/components/event-card";
import { RetryButton } from "@/components/retry-button";
import type { ReadResult } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import {
  catalogHref,
  hasActiveFilters,
  type CatalogFilters,
  type EventListResult,
} from "@/lib/events";

export function CatalogResults({
  filters,
  listing,
}: {
  filters: CatalogFilters;
  listing: ReadResult<EventListResult>;
}) {
  if (!listing.ok) {
    return (
      <div className="flex flex-col items-start gap-5">
        <p className="text-muted">{messageFor(listing.code)}</p>
        <RetryButton />
      </div>
    );
  }

  const { items, pageSize, total } = listing.data;

  if (items.length === 0) {
    return <EmptyCatalog filtered={hasActiveFilters(filters)} />;
  }

  return (
    <>
      <p className="text-sm text-faint">
        {total} {total === 1 ? "evento" : "eventos"}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((event) => (
          <li key={event.id} className="flex">
            <EventCard event={event} />
          </li>
        ))}
      </ul>

      <Pagination
        page={filters.page}
        pageSize={pageSize}
        total={total}
        previousHref={catalogHref({
          ...filters,
          page: Math.max(0, filters.page - 1),
        })}
        nextHref={catalogHref({ ...filters, page: filters.page + 1 })}
      />
    </>
  );
}

function EmptyCatalog({ filtered }: { filtered: boolean }) {
  if (!filtered) {
    return (
      <p className="notice">
        Nenhum evento publicado no momento. Volte em instantes.
      </p>
    );
  }

  return (
    <div className="card flex flex-col items-start gap-3">
      <p>
        Nenhum evento encontrado com esses filtros. Tente outro termo, outra
        cidade ou um período maior.
      </p>
      <Link href="/" className="btn-quiet">
        Limpar filtros
      </Link>
    </div>
  );
}
