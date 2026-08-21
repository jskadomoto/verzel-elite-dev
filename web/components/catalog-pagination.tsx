"use client";

import { useRouter } from "next/navigation";
import { catalogHref, lastPageOf, type CatalogFilters } from "@/lib/events";

export function CatalogPagination({
  filters,
  pageSize,
  total,
}: {
  filters: CatalogFilters;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const lastPage = lastPageOf(pageSize, total);

  if (lastPage === 0) return null;

  const goTo = (page: number) => router.push(catalogHref({ ...filters, page }));

  return (
    <nav className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={filters.page <= 0}
        onClick={() => goTo(filters.page - 1)}
        className="btn-quiet"
      >
        Anterior
      </button>

      <span className="text-sm text-muted">
        Página {filters.page + 1} de {lastPage + 1}
      </span>

      <button
        type="button"
        disabled={filters.page >= lastPage}
        onClick={() => goTo(filters.page + 1)}
        className="btn-quiet"
      >
        Próxima
      </button>
    </nav>
  );
}
