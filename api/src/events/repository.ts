import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  EventFields,
  EventRecord,
  EventStatus,
  NewEvent,
  Tier,
  TierInput,
} from "./types";

type Executor = Pool | PoolClient;

// `external_snapshot` fica fora da projeção: é o item bruto do catálogo, só
// serve para auditoria da importação e ninguém que lê evento precisa dele.
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

// A disponibilidade nasce aqui, na fronteira do banco, para que `allocated` não
// tenha caminho até a resposta.
const toTier = (row: TierRow): Tier => ({
  id: row.id,
  eventId: row.event_id,
  name: row.name,
  priceCents: row.price_cents,
  capacity: row.capacity,
  available: row.capacity - row.allocated,
});

// `snapshot_at` é derivado do próprio snapshot, na mesma escrita, para que não
// exista linha com data sem item nem item sem data.
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

// Exige PoolClient em vez de aceitar o pool: são duas escritas, e falha entre o
// delete e o insert deixaria o evento sem setor nenhum. Sem valor padrão, o
// compilador recusa a chamada fora de transação.
// Só faz sentido com o evento em rascunho, onde nenhum pedido referencia um
// setor. Fora disso, apagar setor arrastaria order_items junto.
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

// Trava a linha do evento até o fim da transação, para que precondição lida
// não mude antes da escrita que depende dela. Exige PoolClient: `for update`
// fora de transação trava e solta na mesma instrução, sem proteger nada.
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

// A condição de rascunho viaja no where, não numa leitura anterior. Devolver
// null cobre os três casos de linha não afetada: inexistente, de outro
// organizador, ou já fora de rascunho. Quem chama distingue.
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

// O estado de origem vai na cláusula where. Sem select antes: entre a leitura e
// a escrita cabe outra transição, e a linha afetada é o que decide.
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
