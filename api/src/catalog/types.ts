export type CatalogItem = {
  source: "ticketmaster" | "fixtures";
  externalId: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  venueName: string;
  address: string | null;
  city: string;
  state: string | null;
  country: string;
  timezone: string;
  startsAt: string;
  raw: unknown;
  title: string
};

export type SearchResult = {
  items: CatalogItem[];
  degraded: boolean;
};

export type CatalogProvider = {
    search(query: string, page?: number): Promise<CatalogItem[]>
    getById(externalId: string): Promise<CatalogItem | null>
}