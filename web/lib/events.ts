export type Tier = {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
};

export type PublicEvent = {
  id: string;
  status: "PUBLISHED";
  title: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  startsAt: string;
  timezone: string;
  venueName: string;
  address: string | null;
  city: string;
  state: string | null;
  country: string;
};

export type PublicEventSummary = PublicEvent & {
  priceFromCents: number | null;
};

export type PublicEventDetail = PublicEvent & { tiers: Tier[] };

export type EventListResult = {
  items: PublicEventSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type CitiesResult = { cities: string[] };

export type CatalogFilters = {
  q: string;
  city: string;
  category: string;
  from: string;
  to: string;
  page: number;
};

export const MIN_QUERY_LENGTH = 2;

export const EMPTY_FILTERS: CatalogFilters = {
  q: "",
  city: "",
  category: "",
  from: "",
  to: "",
  page: 0,
};

type RawSearchParams = Record<string, string | string[] | undefined>;

const singleValue = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const pageNumber = (value: string | string[] | undefined) => {
  const parsed = Number(singleValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

export function filtersFrom(params: RawSearchParams): CatalogFilters {
  return {
    q: singleValue(params.q),
    city: singleValue(params.city),
    category: singleValue(params.category),
    from: singleValue(params.from),
    to: singleValue(params.to),
    page: pageNumber(params.page),
  };
}

export const hasActiveFilters = (filters: CatalogFilters) =>
  Boolean(filters.q || filters.city || filters.category || filters.from || filters.to);

export const isInvertedPeriod = (filters: CatalogFilters) =>
  Boolean(filters.from && filters.to && filters.to < filters.from);

export function catalogSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("city", filters.city);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page > 0) params.set("page", String(filters.page));

  return params;
}

export function apiSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = catalogSearchParams(filters);

  if (filters.q.length < MIN_QUERY_LENGTH) params.delete("q");

  return params;
}

export function catalogHref(filters: CatalogFilters): string {
  const query = catalogSearchParams(filters).toString();
  return query ? `/?${query}` : "/";
}
