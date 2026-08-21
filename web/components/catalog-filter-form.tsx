"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  catalogHref,
  isInvertedPeriod,
  MIN_QUERY_LENGTH,
  type CatalogFilters,
} from "@/lib/events";

const TYPING_PAUSE_MS = 400;

export function CatalogFilterForm({
  filters,
  cities,
}: {
  filters: CatalogFilters;
  cities: string[];
}) {
  const router = useRouter();
  const [applied, setApplied] = useState(filters);
  const [draft, setDraft] = useState(filters);

  if (catalogHref(applied) !== catalogHref(filters)) {
    const stillTyping = draft.q !== applied.q;
    setApplied(filters);
    setDraft({ ...filters, q: stillTyping ? draft.q : filters.q });
  }

  useEffect(() => {
    if (draft.q === applied.q) return;

    const timer = setTimeout(() => {
      router.push(catalogHref({ ...draft, page: 0 }));
    }, TYPING_PAUSE_MS);

    return () => clearTimeout(timer);
  }, [draft, applied, router]);

  const apply = (next: CatalogFilters) => {
    router.push(catalogHref({ ...next, page: 0 }));
  };

  const change = (patch: Partial<CatalogFilters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!isInvertedPeriod(next)) apply(next);
  };

  const invertedPeriod = isInvertedPeriod(draft);
  const queryTooShort = draft.q.length > 0 && draft.q.length < MIN_QUERY_LENGTH;

  return (
    <form
      className="card flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invertedPeriod) apply(draft);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="label">Buscar por nome do evento ou do local</span>
        <input
          type="search"
          name="q"
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          placeholder="festival, arena…"
          className="field"
        />
        {queryTooShort ? (
          <span className="text-sm text-faint">
            Digite ao menos {MIN_QUERY_LENGTH} letras para buscar.
          </span>
        ) : null}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Cidade</span>
          <select
            name="city"
            value={draft.city}
            onChange={(event) => change({ city: event.target.value })}
            className="field"
          >
            <option value="">Todas as cidades</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Categoria</span>
          <input
            type="text"
            name="category"
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value })
            }
            onBlur={() => change({ category: draft.category })}
            placeholder="musica, teatro…"
            className="field"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">A partir de</span>
          <input
            type="date"
            name="from"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(event) => change({ from: event.target.value })}
            className="field"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Até</span>
          <input
            type="date"
            name="to"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) => change({ to: event.target.value })}
            aria-invalid={invertedPeriod}
            className="field"
          />
        </label>
      </div>

      {invertedPeriod ? (
        <p role="alert" className="alert">
          O fim do período não pode ser anterior ao início. Enquanto isso, a lista
          abaixo continua com o filtro anterior.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={invertedPeriod}
          className="btn-primary"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn-quiet"
        >
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
