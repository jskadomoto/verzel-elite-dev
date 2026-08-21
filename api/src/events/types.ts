export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export type TierInput = {
  name: string;
  priceCents: number;
  capacity: number;
};

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

export type OrganizerListResult = {
  items: EventWithTiers[];
  page: number;
  pageSize: number;
  total: number;
};

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
