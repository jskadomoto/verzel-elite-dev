import { CatalogItem, CatalogProvider } from "./types";

const BASE_URL = "http://app.ticketmaster.com/discovery/v2/events.json";
const TIMEOUT_MS = 5000;
const PAGE_SIZE = 20;

type TmVenue = {
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
  address?: { line1?: string };
  timezone?: string;
};

type TmEvent = {
  id: string;
  name: string;
  info?: string;
  description?: string;
  images?: { url: string; width: number }[];
  dates?: { start?: { dateTime?: string }; timezone?: string };
  classifications?: {
    segment?: { name?: string };
    genre?: { name?: string };
  }[];
  _embedded?: { venues?: TmVenue[] };
};

type TmResponse = { _embedded?: { events?: TmEvent[] } };

function pickImage(images: TmEvent["images"]): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => b.width - a.width);
  return sorted[0]?.url ?? null;
}

// Evento sem data ou sem local não serve para criar venda
function toCatalogItem(event: TmEvent): CatalogItem | null {
  const venue = event._embedded?.venues?.[0];
  const startsAt = event?.dates?.start?.dateTime;

  if (!startsAt || !venue?.name || !venue?.city?.name) return null;
  const classification = event.classifications?.[0];

  return {
    source: "ticketmaster",
    externalId: event.id,
    title: event.name,
    description: event.info ?? event.description ?? null,
    imageUrl: pickImage(event.images),
    category: (
      classification?.genre?.name ??
      classification?.segment?.name ??
      "outros"
    ).toLowerCase(),
    venueName: venue.name,
    address: venue.address?.line1 ?? null,
    city: venue.city.name,
    state: venue.state?.stateCode ?? null,
    country: venue.country?.countryCode ?? "BR",
    timezone: venue.timezone ?? event.dates?.timezone ?? "America/Sao_Paulo",
    startsAt,
    raw: event,
  };
}

async function request(url: string): Promise<TmResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Ticketmaster respondeu ${response.status}`);
      (error as Error & { retryable?: boolean }).retryable =
        response.status >= 500;
      throw error;
    }
    return (await response.json()) as TmResponse;
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(url: string): Promise<TmResponse> {
  try {
    return await request(url);
  } catch (err) {
    const retryable =
      (err as Error & { retryable?: boolean }).retryable ?? true;
    if (!retryable) throw err;
    return request(url);
  }
}

export function createTicketmasterProvider(apiKey: string): CatalogProvider {
  return {
    async search(query: string, page = 0): Promise<CatalogItem[]> {
      const params = new URLSearchParams({
        apikey: apiKey,
        keywords: query,
        size: String(PAGE_SIZE),
        page: String(page),
        countryCode: "BR",
        sort: "date,asc",
      });

      const data = await requestWithRetry(`${BASE_URL}?${params}`);
      return (data._embedded?.events ?? [])
        .map(toCatalogItem)
        .filter((item): item is CatalogItem => item !== null);
    },

    async getById(externalId: string): Promise<CatalogItem | null> {
      const params = new URLSearchParams({ apikey: apiKey, id: externalId });
      const data = await requestWithRetry(`${BASE_URL}?${params}`);
      const event = data._embedded?.events?.[0];
      return event ? toCatalogItem(event) : null;
    },
  };
}
