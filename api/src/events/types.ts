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
