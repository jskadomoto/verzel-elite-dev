import { DEFAULT_TIMEZONE, wallTimeFromInstant } from "./datetime";
import { reaisFromCents } from "./format";

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type OrganizerTier = {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
};

export type OrganizerEvent = {
  id: string;
  organizerId: string;
  status: EventStatus;
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
  externalSource: string | null;
  externalId: string | null;
  snapshotAt: string | null;
  createdAt: string;
  updatedAt: string;
  tiers: OrganizerTier[];
};

export type OrganizerListResult = {
  items: OrganizerEvent[];
  page: number;
  pageSize: number;
  total: number;
};

export type CatalogItem = {
  source: string;
  externalId: string;
  title: string;
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
};

export type CatalogSearchResult = {
  items: CatalogItem[];
  degraded: boolean;
};

export const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
};

export const STATUS_STYLE: Record<EventStatus, string> = {
  DRAFT: "border-dashed border-line-strong bg-surface-raised text-muted",
  PUBLISHED: "border-success/40 bg-success/15 text-success",
  CANCELLED: "border-danger/50 bg-danger/15 text-danger line-through",
};

export const NOT_EDITABLE_REASON: Record<EventStatus, string> = {
  DRAFT: "",
  PUBLISHED:
    "Evento publicado não pode ser editado: ele já está no catálogo público e pode ter ingressos vendidos. Cancele o evento para tirá-lo do ar.",
  CANCELLED:
    "Evento cancelado não pode ser editado nem voltar ao ar. Crie um evento novo para remarcar.",
};

export type TierFormValues = {
  rowId: string;
  name: string;
  price: string;
  capacity: string;
};

let rowsCreated = 0;

function newRowId(): string {
  const generated = globalThis.crypto?.randomUUID?.();
  if (generated) return generated;

  rowsCreated += 1;
  return `setor-${rowsCreated}`;
}

export type EventFormValues = {
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  wallTime: string;
  timezone: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  externalId: string;
  tiers: TierFormValues[];
};

export const MIN_TIERS = 1;
export const MAX_TIERS = 6;

export const emptyTier = (): TierFormValues => ({
  rowId: newRowId(),
  name: "",
  price: "",
  capacity: "",
});

export const blankEventForm = (): EventFormValues => ({
  title: "",
  description: "",
  category: "",
  imageUrl: "",
  wallTime: "",
  timezone: DEFAULT_TIMEZONE,
  venueName: "",
  address: "",
  city: "",
  state: "",
  country: "BR",
  externalId: "",
  tiers: [emptyTier()],
});

export function eventFormFromCatalogItem(item: CatalogItem): EventFormValues {
  const wallTime = wallTimeFromInstant(item.startsAt, item.timezone);

  return {
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    imageUrl: item.imageUrl ?? "",
    wallTime: wallTime ?? "",
    timezone: wallTime ? item.timezone : DEFAULT_TIMEZONE,
    venueName: item.venueName,
    address: item.address ?? "",
    city: item.city,
    state: item.state ?? "",
    country: item.country,
    externalId: item.externalId,
    tiers: [emptyTier()],
  };
}

export function eventFormFromEvent(event: OrganizerEvent): EventFormValues {
  const wallTime = wallTimeFromInstant(event.startsAt, event.timezone);

  return {
    title: event.title,
    description: event.description ?? "",
    category: event.category,
    imageUrl: event.imageUrl ?? "",
    wallTime: wallTime ?? "",
    timezone: wallTime ? event.timezone : DEFAULT_TIMEZONE,
    venueName: event.venueName,
    address: event.address ?? "",
    city: event.city,
    state: event.state ?? "",
    country: event.country,
    externalId: "",
    tiers: event.tiers.map((tier) => ({
      rowId: newRowId(),
      name: tier.name,
      price: reaisFromCents(tier.priceCents),
      capacity: String(tier.capacity),
    })),
  };
}

export function duplicatedTierName(tiers: TierFormValues[]): string | null {
  const seen = new Set<string>();

  for (const tier of tiers) {
    const key = tier.name.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return tier.name.trim();
    seen.add(key);
  }
  return null;
}

export const organizerHref = (page: number) =>
  page > 0 ? `/organizador?page=${page}` : "/organizador";
