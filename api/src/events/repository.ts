import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  EventFields,
  EventRecord,
  EventStatus,
  NewEvent,
  PublicSearchFilters,
  Tier,
  TierInput,
} from "./types";

type Executor = Pool | PoolClient;

const EVENT_COLUMNS = `id, organizer_id, status, title, description, category,
  image_url, starts_at, timezone, venue_name, address, city, state, country,
  external_source, external_id, snapshot_at, created_at, updated_at`;

const TIER_COLUMNS = `id, event_id, name, price_cents, capacity, allocated`;

type EventRow = {
  id: string;
  organizer_id: string;
  status: EventStatus;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  starts_at: Date;
  timezone: string;
  venue_name: string;
  address: string | null;
  city: string;
  state: string | null;
  country: string;
  external_source: string | null;
  external_id: string | null;
  snapshot_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type TierRow = {
  id: string;
  event_id: string;
  name: string;
  price_cents: number;
  capacity: number;
  allocated: number;
};

const toEvent = (row: EventRow): EventRecord => ({
  id: row.id,
  organizerId: row.organizer_id,
  status: row.status,
  title: row.title,
  description: row.description,
  category: row.category,
  imageUrl: row.image_url,
  startsAt: row.starts_at.toISOString(),
  timezone: row.timezone,
  venueName: row.venue_name,
  address: row.address,
  city: row.city,
  state: row.state,
  country: row.country,
  externalSource: row.external_source,
  externalId: row.external_id,
  snapshotAt: row.snapshot_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toTier = (row: TierRow): Tier => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  priceCents: row.price_cents,
  capacity: row.capacity,
  available: row.capacity - row.allocated,
});

export async function insertEvent(
  input: NewEvent,
  db: Executor = pool,
): Promise<EventRecord> {
  const { rows } = await db.query<EventRow>(
    `insert into events (organizer_id, title, description, category, image_url,
       starts_at, timezone, venue_name, address, city, state, country,
       external_source, external_id, external_snapshot, snapshot_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       case when $15::jsonb is null then null else now() end)
     returning ${EVENT_COLUMNS}`,
    [
      input.organizerId,
      input.title,
      input.description,
      input.category,
      input.imageUrl,
      input.startsAt,
      input.timezone,
      input.venueName,
      input.address,
      input.city,
      input.state,
      input.country,
      input.externalSource,
      input.externalId,
      input.externalSnapshot === null
        ? null
        : JSON.stringify(input.externalSnapshot),
    ],
  );
  return toEvent(rows[0]);
}

export async function insertTiers(
  eventId: string,
  tiers: TierInput[],
  db: Executor = pool,
): Promise<Tier[]> {
  if (!tiers.length) return [];

  const values: unknown[] = [eventId];
  const placeholders = tiers.map((tier) => {
    values.push(tier.name, tier.priceCents, tier.capacity);
    const base = values.length - 2;
    return `($1, $${base}, $${base + 1}, $${base + 2})`;
  });

  const { rows } = await db.query<TierRow>(
    `insert into ticket_tiers (event_id, name, price_cents, capacity)
     values ${placeholders.join(", ")}
     returning ${TIER_COLUMNS}`,
    values,
  );
  return rows.map(toTier);
}

export async function replaceTiers(
  eventId: string,
  tiers: TierInput[],
  db: PoolClient,
): Promise<Tier[]> {
  await db.query("delete from ticket_tiers where event_id = $1", [eventId]);
  return insertTiers(eventId, tiers, db);
}

export async function findTiers(
  eventId: string,
  db: Executor = pool,
): Promise<Tier[]> {
  const { rows } = await db.query<TierRow>(
    `select ${TIER_COLUMNS} from ticket_tiers
     where event_id = $1
     order by price_cents, name`,
    [eventId],
  );
  return rows.map(toTier);
}

export const ORGANIZER_PAGE_SIZE = 20;

export async function findByOrganizer(
  organizerId: string,
  page: number,
  db: Executor = pool,
): Promise<{ items: EventRecord[]; total: number }> {
  const { rows } = await db.query<EventRow & { total: string }>(
    `select ${EVENT_COLUMNS}, count(*) over() as total
     from events
     where organizer_id = $1
     order by created_at desc, id
     limit $2 offset $3`,
    [organizerId, ORGANIZER_PAGE_SIZE, page * ORGANIZER_PAGE_SIZE],
  );

  return {
    items: rows.map(toEvent),
    total: await totalOf(rows, page, () => countByOrganizer(organizerId, db)),
  };
}

async function countByOrganizer(
  organizerId: string,
  db: Executor,
): Promise<number> {
  const { rows } = await db.query<{ total: string }>(
    "select count(*)::text as total from events where organizer_id = $1",
    [organizerId],
  );
  return Number(rows[0].total);
}

export async function findTiersOf(
  eventIds: string[],
  db: Executor = pool,
): Promise<Map<string, Tier[]>> {
  const byEvent = new Map<string, Tier[]>();
  if (!eventIds.length) return byEvent;

  const { rows } = await db.query<TierRow>(
    `select ${TIER_COLUMNS} from ticket_tiers
     where event_id = any($1::uuid[])
     order by event_id, price_cents, name`,
    [eventIds],
  );

  for (const row of rows) {
    const tier = toTier(row);
    const existing = byEvent.get(tier.eventId);
    if (existing) existing.push(tier);
    else byEvent.set(tier.eventId, [tier]);
  }
  return byEvent;
}

export async function findPublishedForShare(
  id: string,
  db: PoolClient,
): Promise<EventRecord | null> {
  const { rows } = await db.query<EventRow>(
    `select ${EVENT_COLUMNS} from events
     where id = $1 and status = 'PUBLISHED'
     for share`,
    [id],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function allocate(
  tierId: string,
  eventId: string,
  quantity: number,
  db: PoolClient,
): Promise<number | null> {
  const { rows } = await db.query<{ price_cents: number }>(
    `update ticket_tiers
     set allocated = allocated + $3, updated_at = now()
     where id = $1 and event_id = $2 and allocated + $3 <= capacity
     returning price_cents`,
    [tierId, eventId, quantity],
  );
  return rows[0]?.price_cents ?? null;
}

export async function findOwned(
  id: string,
  organizerId: string,
  db: Executor = pool,
): Promise<EventRecord | null> {
  const { rows } = await db.query<EventRow>(
    `select ${EVENT_COLUMNS} from events where id = $1 and organizer_id = $2`,
    [id, organizerId],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function findOwnedForUpdate(
  id: string,
  organizerId: string,
  db: PoolClient,
): Promise<EventRecord | null> {
  const { rows } = await db.query<EventRow>(
    `select ${EVENT_COLUMNS} from events
     where id = $1 and organizer_id = $2
     for update`,
    [id, organizerId],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

const UPDATABLE: Record<keyof EventFields, string> = {
  title: "title",
  description: "description",
  category: "category",
  imageUrl: "image_url",
  startsAt: "starts_at",
  timezone: "timezone",
  venueName: "venue_name",
  address: "address",
  city: "city",
  state: "state",
  country: "country",
};

export async function updateOwnedDraft(
  id: string,
  organizerId: string,
  fields: EventFields,
  db: Executor = pool,
): Promise<EventRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [id, organizerId];

  for (const [key, column] of Object.entries(UPDATABLE)) {
    const value = fields[key as keyof EventFields];
    if (value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  if (!assignments.length) {
    const { rows } = await db.query<EventRow>(
      `select ${EVENT_COLUMNS} from events
       where id = $1 and organizer_id = $2 and status = 'DRAFT'`,
      [id, organizerId],
    );
    return rows[0] ? toEvent(rows[0]) : null;
  }

  const { rows } = await db.query<EventRow>(
    `update events set ${assignments.join(", ")}
     where id = $1 and organizer_id = $2 and status = 'DRAFT'
     returning ${EVENT_COLUMNS}`,
    values,
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

export const PUBLIC_PAGE_SIZE = 20;

type PublicRow = EventRow & {
  price_from_cents: number | null;
  total: string;
};

const PERIOD_TIMEZONE = "America/Sao_Paulo";

const PUBLISHED_FILTER = `status = 'PUBLISHED'
       and ($1::text is null
            or strpos(unaccent(lower(title)), unaccent(lower($1))) > 0
            or strpos(unaccent(lower(venue_name)), unaccent(lower($1))) > 0)
       and ($2::text is null or unaccent(lower(city)) = unaccent(lower($2)))
       and ($3::text is null or lower(category) = lower($3))
       and ($4::date is null or starts_at >= ($4::date)::timestamp at time zone $6)
       and ($5::date is null or starts_at < (($5::date) + 1)::timestamp at time zone $6)`;

const filterValues = (filters: PublicSearchFilters) => [
  filters.q || null,
  filters.city || null,
  filters.category || null,
  filters.from || null,
  filters.to || null,
  PERIOD_TIMEZONE,
];

export async function searchPublished(
  filters: PublicSearchFilters,
  db: Executor = pool,
): Promise<{
  items: Array<EventRecord & { priceFromCents: number | null }>;
  total: number;
}> {
  const values = filterValues(filters);

  const { rows } = await db.query<PublicRow>(
    `select ${EVENT_COLUMNS},
       (select min(price_cents) from ticket_tiers t where t.event_id = events.id)
         as price_from_cents,
       count(*) over() as total
     from events
     where ${PUBLISHED_FILTER}
     order by starts_at, id
     limit $7 offset $8`,
    [...values, PUBLIC_PAGE_SIZE, filters.page * PUBLIC_PAGE_SIZE],
  );

  return {
    items: rows.map((row) => ({
      ...toEvent(row),
      priceFromCents: row.price_from_cents,
    })),
    total: await totalOf(rows, filters.page, () => countPublished(values, db)),
  };
}

async function totalOf(
  rows: Array<{ total: string }>,
  page: number,
  count: () => Promise<number>,
): Promise<number> {
  if (rows[0]) return Number(rows[0].total);
  return page > 0 ? count() : 0;
}

async function countPublished(
  values: unknown[],
  db: Executor,
): Promise<number> {
  const { rows } = await db.query<{ total: string }>(
    `select count(*)::text as total from events where ${PUBLISHED_FILTER}`,
    values,
  );
  return Number(rows[0].total);
}

export async function findPublished(
  id: string,
  db: Executor = pool,
): Promise<EventRecord | null> {
  const { rows } = await db.query<EventRow>(
    `select ${EVENT_COLUMNS} from events where id = $1 and status = 'PUBLISHED'`,
    [id],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function findPublishedCities(
  db: Executor = pool,
): Promise<string[]> {
  const { rows } = await db.query<{ city: string }>(
    `select distinct city, unaccent(lower(city)) collate "C" as ordem
     from events
     where status = 'PUBLISHED'
     order by ordem`,
  );
  return rows.map((row) => row.city);
}

export async function transition(
  id: string,
  organizerId: string,
  from: EventStatus[],
  to: EventStatus,
  db: Executor = pool,
): Promise<EventRecord | null> {
  const { rows } = await db.query<EventRow>(
    `update events set status = $4
     where id = $1 and organizer_id = $2 and status = any($3::event_status[])
     returning ${EVENT_COLUMNS}`,
    [id, organizerId, from, to],
  );
  return rows[0] ? toEvent(rows[0]) : null;
}