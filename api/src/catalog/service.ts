import { ENV } from "../env";
import { TTLCache } from "./cache";
import { fixturesProvider } from "./fixtures-provider";
import { createTicketmasterProvider } from "./ticketmaster";
import { CatalogItem, CatalogProvider, SearchResult } from "./types";

const TTL_MS = 10 * 60 * 1000;

const cache = new TTLCache<CatalogItem[]>(TTL_MS);

const remote: CatalogProvider | null = ENV.TICKETMASTER_API_KEY
  ? createTicketmasterProvider(ENV.TICKETMASTER_API_KEY)
  : null;

const keyOf = (query: string, page: number) => `ticketmaster:${query}:${page}`;

export async function search(query: string, page = 0): Promise<SearchResult> {
  if (!remote) {
    return {
      items: await fixturesProvider.search(query, page),
      degraded: true,
    };
  }

  const cached = cache.get(keyOf(query, page));
  if (cached) return { items: cached, degraded: false };

  try {
    const items = await remote.search(query, page);
    cache.set(keyOf(query, page), items);
    return { items, degraded: false };
  } catch (err) {
    console.warn("Catálogo indisponível.", (err as Error).message);
    return {
      items: await fixturesProvider.search(query, page),
      degraded: false,
    };
  }
}

export async function getById(externalId: string): Promise<CatalogItem | null> {
  if (!remote) return fixturesProvider.getById(externalId);

  try {
    return await remote.getById(externalId);
  } catch (err) {
    console.warn("Catálogo externo indisponível.", (err as Error).message);
    return fixturesProvider.getById(externalId);
  }
}
