import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
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
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <Link href="/login" className="btn-quiet">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Os próximos eventos
          </h1>
          <p className="text-muted">
            Escolha o setor, reserve por dez minutos e receba o ingresso com
            código de entrada no celular.
          </p>
        </div>

        <CatalogFilterForm
          filters={filters}
          cities={cities.ok ? cities.data.cities : []}
        />

        {listing ? (
          <CatalogResults filters={filters} listing={listing} />
        ) : (
          <p className="notice">
            Ajuste o período para ver os eventos: o fim não pode ser anterior ao
            início.
          </p>
        )}
      </main>
    </div>
  );
}
