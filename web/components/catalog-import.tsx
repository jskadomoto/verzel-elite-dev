"use client";

import { useState } from "react";
import { wallTimeFromInstant } from "@/lib/datetime";
import { codeOf, messageFor } from "@/lib/errors";
import { MIN_QUERY_LENGTH } from "@/lib/events";
import { formatEventDateTime } from "@/lib/format";
import type { CatalogItem, CatalogSearchResult } from "@/lib/organizer";

export function CatalogImport({
  onImport,
}: {
  onImport: (item: CatalogItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CatalogSearchResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    setProblem(null);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setProblem(`Digite ao menos ${MIN_QUERY_LENGTH} letras para buscar.`);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/catalog/search?q=${encodeURIComponent(query.trim())}`,
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setResult(null);
        setProblem(messageFor(codeOf(payload)));
        return;
      }

      setResult(payload as CatalogSearchResult);
    } catch {
      setResult(null);
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Importar do catálogo externo</h2>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={search}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="nome do show, do artista ou do local"
          className="field"
        />
        <button type="submit" disabled={searching} className="btn-primary">
          {searching ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {problem ? (
        <p role="alert" className="alert">
          {problem}
        </p>
      ) : null}

      {result?.degraded ? (
        <p className="notice">
          A fonte externa não respondeu, então estes resultados vêm de um
          conjunto local. Você ainda pode importar e ajustar tudo.
        </p>
      ) : null}

      {result && result.items.length === 0 ? (
        <p className="notice">
          Nenhum item encontrado no catálogo externo para esse termo.
        </p>
      ) : null}

      {result && result.items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {result.items.map((item) => (
            <li
              key={item.externalId}
              className="card flex flex-col gap-2"
            >
              <p className="font-medium break-words">{item.title}</p>
              <p className="text-sm text-brand">{whenOf(item)}</p>
              <p className="text-sm break-words text-muted">{placeOf(item)}</p>
              <button
                type="button"
                onClick={() => onImport(item)}
                className="btn-quiet"
              >
                Importar para o formulário
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function whenOf(item: CatalogItem) {
  const readable = wallTimeFromInstant(item.startsAt, item.timezone) !== null;

  return readable
    ? formatEventDateTime(item.startsAt, item.timezone)
    : "Data e hora ilegíveis na fonte externa";
}

function placeOf(item: CatalogItem) {
  const place = item.state ? `${item.city}, ${item.state}` : item.city;
  return `${item.venueName} · ${place}`;
}
