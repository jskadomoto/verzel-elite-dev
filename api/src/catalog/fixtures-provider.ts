import items from "./fixtures.json";
import { CatalogItem, CatalogProvider } from "./types";

const PAGE_SIZE = 20;
const catalog = items as CatalogItem[];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matches(item: CatalogItem, query: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;

  return [item.title, item.venueName, item.city, item.category].some((field) =>
    normalize(field).includes(needle),
  );
}

export const fixturesProvider: CatalogProvider = {
  async search(query: string, page = 0): Promise<CatalogItem[]> {
    const found = catalog.filter((item) => matches(item, query));
    return found.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  },

  async getById(externalId: string): Promise<CatalogItem | null> {
    return catalog.find((item) => item.externalId === externalId) ?? null;
  },
};
