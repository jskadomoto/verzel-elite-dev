import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogFilterForm } from "@/components/catalog-filter-form";
import { CatalogResults } from "@/components/catalog-results";
import { read } from "@/lib/api";
import {
  apiSearchParams,
  catalogHref,
  filtersFrom,
  isInvertedPeriod,
  lastPageOf,
  type CitiesResult,
  type EventListResult,
} from "@/lib/events";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function CatalogPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const filters = filtersFrom(await searchParams);
  const invertedPeriod = isInvertedPeriod(filters);

  const [cities, listing] = await Promise.all([
    read<CitiesResult>("/events/cities"),
    invertedPeriod
      ? null
      : read<EventListResult>("/events", apiSearchParams(filters)),
  ]);

  if (listing?.ok && listing.data.items.length === 0 && listing.data.total > 0) {
    redirect(
      catalogHref({
        ...filters,
        page: lastPageOf(listing.data.pageSize, listing.data.total),
      }),
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <p className="font-semibold">Ingressos</p>
        <Link href="/login" className="inline-flex min-h-11 items-center rounded border px-4">
          Entrar
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-xl font-semibold">Eventos</h1>

        <CatalogFilterForm
          filters={filters}
          cities={cities.ok ? cities.data.cities : []}
        />

        {listing ? (
          <CatalogResults filters={filters} listing={listing} />
        ) : (
          <p>
            Ajuste o período para ver os eventos: o fim não pode ser anterior ao
            início.
          </p>
        )}
      </main>
    </div>
  );
}
