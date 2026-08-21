import Link from "next/link";
import { CatalogPagination } from "@/components/catalog-pagination";
import { EventCard } from "@/components/event-card";
import { RetryButton } from "@/components/retry-button";
import type { ReadResult } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import {
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
      <div className="flex flex-col items-start gap-4">
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

      <CatalogPagination filters={filters} pageSize={pageSize} total={total} />
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
    <div className="card flex flex-col items-start gap-4">
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
