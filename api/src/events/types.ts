export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type TierInput = {
  name: string;
  priceCents: number;
  capacity: number;
};

// `allocated` não aparece aqui de propósito: o contador de ocupação é interno e
// o que sai da API é sempre `available`, derivado de capacity menos allocated.
export type Tier = {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
};

export type EventRecord = {
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
};

export type EventWithTiers = EventRecord & { tiers: Tier[] };

// Projeção pública do evento, no mesmo idioma do `toPublic` de auth: o que não
// interessa a quem só navega o catálogo sai aqui, e não numa segunda conversão
// de linha. Procedência da importação e dono do evento são dados internos.
export type PublicEvent = Omit<
  EventRecord,
  | "organizerId"
  | "externalSource"
  | "externalId"
  | "snapshotAt"
  | "createdAt"
  | "updatedAt"
>;

export const toPublicEvent = ({
  organizerId: _organizerId,
  externalSource: _externalSource,
  externalId: _externalId,
  snapshotAt: _snapshotAt,
  createdAt: _createdAt,
  updatedAt: _updatedAt,
  ...rest
}: EventRecord): PublicEvent => rest;

// O card do catálogo mostra preço, então a lista carrega o menor preço entre os
// setores. Não carrega os setores inteiros: isso é o detalhe.
export type PublicEventSummary = PublicEvent & {
  priceFromCents: number | null;
};

export type PublicEventDetail = PublicEvent & { tiers: Tier[] };

export type PublicSearchFilters = {
  q?: string;
  city?: string;
  category?: string;
  from?: string;
  to?: string;
  page: number;
};

export type PublicSearchResult = {
  items: PublicEventSummary[];
  page: number;
  pageSize: number;
  total: number;
};

// Campos que o organizador informa. Todos opcionais na criação, porque o que
// faltar é preenchido pelo item importado do catálogo.
export type EventFields = {
  title?: string;
  description?: string | null;
  category?: string;
  imageUrl?: string | null;
  startsAt?: string;
  timezone?: string;
  venueName?: string;
  address?: string | null;
  city?: string;
  state?: string | null;
  country?: string;
};

export type CreateEventInput = EventFields & {
  externalId?: string;
  tiers?: TierInput[];
};

export type UpdateEventInput = EventFields & {
  tiers?: TierInput[];
};

// Linha pronta para inserção, já com o snapshot resolvido no servidor.
// Sem `snapshotAt`: a data é derivada do próprio snapshot dentro do insert.
export type NewEvent = {
  organizerId: string;
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
  externalSnapshot: unknown;
};
