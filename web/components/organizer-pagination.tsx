"use client";

import { useRouter } from "next/navigation";
import { lastPageOf, organizerHref } from "@/lib/organizer";

export function OrganizerPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const lastPage = lastPageOf(pageSize, total);

  if (lastPage === 0) return null;

  return (
    <nav className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => router.push(organizerHref(page - 1))}
        className="btn-quiet"
      >
        Anterior
      </button>

      <span className="text-sm text-muted">
        Página {page + 1} de {lastPage + 1}
      </span>

      <button
        type="button"
        disabled={page >= lastPage}
        onClick={() => router.push(organizerHref(page + 1))}
        className="btn-quiet"
      >
        Próxima
      </button>
    </nav>
  );
}
