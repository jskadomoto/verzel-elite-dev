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

const fieldClass =
  "min-h-11 w-full rounded border bg-background px-3 text-base text-foreground";

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
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invertedPeriod) apply(draft);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm">Buscar por nome do evento ou do local</span>
        <input
          type="search"
          name="q"
          value={draft.q}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          placeholder="festival, arena…"
          className={fieldClass}
        />
        {queryTooShort ? (
          <span className="text-sm opacity-70">
            Digite ao menos {MIN_QUERY_LENGTH} letras para buscar.
          </span>
        ) : null}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">Cidade</span>
          <select
            name="city"
            value={draft.city}
            onChange={(event) => change({ city: event.target.value })}
            className={fieldClass}
          >
            <option value="" className="bg-background text-foreground">
              Todas as cidades
            </option>
            {cities.map((city) => (
              <option
                key={city}
                value={city}
                className="bg-background text-foreground"
              >
                {city}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">Categoria</span>
          <input
            type="text"
            name="category"
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value })
            }
            onBlur={() => change({ category: draft.category })}
            placeholder="musica, teatro…"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">A partir de</span>
          <input
            type="date"
            name="from"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(event) => change({ from: event.target.value })}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm">Até</span>
          <input
            type="date"
            name="to"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) => change({ to: event.target.value })}
            aria-invalid={invertedPeriod}
            className={fieldClass}
          />
        </label>
      </div>

      {invertedPeriod ? (
        <p role="alert" className="text-sm">
          O fim do período não pode ser anterior ao início. Enquanto isso, a lista
          abaixo continua com o filtro anterior.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={invertedPeriod}
          className="min-h-11 rounded border px-4 text-base disabled:opacity-60"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="min-h-11 rounded border px-4 text-base"
        >
          Limpar filtros
        </button>
      </div>
    </form>
  );
}
