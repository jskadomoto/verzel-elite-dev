import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  NewTicket,
  OpenedShare,
  ShareLink,
  TicketClaim,
  TicketRecord,
  TicketStatus,
} from "./types";

type Executor = Pool | PoolClient;

const TICKET_COLUMNS = `id, order_id, event_id, tier_id, seat_label, status,
  used_at, created_at`;

const SHARE_COLUMNS = `expires_at, opened_count, last_opened_at, created_at`;

const SHARE_IS_ACTIVE = `revoked_at is null and expires_at > now()`;

const CLAIM_COLUMNS = `status, used_at, used_by`;

type TicketRow = {
  id: string;
  order_id: string;
  event_id: string;
  tier_id: string;
  seat_label: string;
  status: TicketStatus;
  used_at: Date | null;
  created_at: Date;
};

type ShareRow = {
  expires_at: Date;
  opened_count: number;
  last_opened_at: Date | null;
  created_at: Date;
};

type ClaimRow = {
  status: TicketStatus;
  used_at: Date | null;
  used_by: string | null;
};

const toClaim = (row: ClaimRow): TicketClaim => ({
  status: row.status,
  usedAt: row.used_at?.toISOString() ?? null,
  usedBy: row.used_by,
});

const toShare = (row: ShareRow): ShareLink => ({
  expiresAt: row.expires_at.toISOString(),
  openedCount: row.opened_count,
  lastOpenedAt: row.last_opened_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

const toTicket = (row: TicketRow): TicketRecord => ({
  id: row.id,
  orderId: row.order_id,
  eventId: row.event_id,
  tierId: row.tier_id,
  seatLabel: row.seat_label,
  status: row.status,
  usedAt: row.used_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

export async function insertMany(
  tickets: NewTicket[],
  db: PoolClient,
): Promise<TicketRecord[]> {
  if (!tickets.length) return [];

  const values: unknown[] = [];
  const placeholders = tickets.map((ticket) => {
    values.push(
      ticket.orderId,
      ticket.eventId,
      ticket.tierId,
      ticket.holderUserId,
      ticket.seatLabel,
    );
    const base = values.length - 4;
    return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  const { rows } = await db.query<TicketRow>(
    `insert into tickets (order_id, event_id, tier_id, holder_user_id, seat_label)
     values ${placeholders.join(", ")}
     returning ${TICKET_COLUMNS}`,
    values,
  );
  return rows.map(toTicket);
}

export async function findByOrder(
  orderId: string,
  db: Executor = pool,
): Promise<TicketRecord[]> {
  const { rows } = await db.query<TicketRow>(
    `select ${TICKET_COLUMNS} from tickets
     where order_id = $1
     order by tier_id, seat_label`,
    [orderId],
  );
  return rows.map(toTicket);
}

export async function findByOrders(
  orderIds: string[],
  db: Executor = pool,
): Promise<Map<string, TicketRecord[]>> {
  const byOrder = new Map<string, TicketRecord[]>();
  if (!orderIds.length) return byOrder;

  const { rows } = await db.query<TicketRow>(
    `select ${TICKET_COLUMNS} from tickets
     where order_id = any($1::uuid[])
     order by order_id, tier_id, seat_label`,
    [orderIds],
  );

  for (const row of rows) {
    const ticket = toTicket(row);
    const existing = byOrder.get(ticket.orderId);
    if (existing) existing.push(ticket);
    else byOrder.set(ticket.orderId, [ticket]);
  }
  return byOrder;
}

export const HOLDER_PAGE_SIZE = 60;

export async function findByHolder(
  holderUserId: string,
  db: Executor = pool,
): Promise<{ items: TicketRecord[]; total: number }> {
  const { rows } = await db.query<TicketRow & { total: string }>(
    `select ${TICKET_COLUMNS}, count(*) over() as total
     from tickets
     where holder_user_id = $1
     order by created_at desc, seat_label
     limit $2`,
    [holderUserId, HOLDER_PAGE_SIZE],
  );

  return {
    items: rows.map(toTicket),
    total: rows[0] ? Number(rows[0].total) : 0,
  };
}

export async function findOwned(
  id: string,
  holderUserId: string,
  db: Executor = pool,
): Promise<TicketRecord | null> {
  const { rows } = await db.query<TicketRow>(
    `select ${TICKET_COLUMNS} from tickets
     where id = $1 and holder_user_id = $2`,
    [id, holderUserId],
  );
  return rows[0] ? toTicket(rows[0]) : null;
}

export async function findOwnedForUpdate(
  id: string,
  holderUserId: string,
  db: PoolClient,
): Promise<TicketRecord | null> {
  const { rows } = await db.query<TicketRow>(
    `select ${TICKET_COLUMNS} from tickets
     where id = $1 and holder_user_id = $2
     for update`,
    [id, holderUserId],
  );
  return rows[0] ? toTicket(rows[0]) : null;
}

export async function findById(
  id: string,
  db: Executor = pool,
): Promise<TicketRecord | null> {
  const { rows } = await db.query<TicketRow>(
    `select ${TICKET_COLUMNS} from tickets where id = $1`,
    [id],
  );
  return rows[0] ? toTicket(rows[0]) : null;
}

export async function claim(
  id: string,
  gateUserId: string,
  db: PoolClient,
): Promise<TicketClaim | null> {
  const { rows } = await db.query<ClaimRow>(
    `update tickets
     set status = 'USED', used_at = now(), used_by = $2, updated_at = now()
     where id = $1 and status = 'VALID'
     returning ${CLAIM_COLUMNS}`,
    [id, gateUserId],
  );
  return rows[0] ? toClaim(rows[0]) : null;
}

export async function findClaim(
  id: string,
  db: Executor = pool,
): Promise<TicketClaim | null> {
  const { rows } = await db.query<ClaimRow>(
    `select ${CLAIM_COLUMNS} from tickets where id = $1`,
    [id],
  );
  return rows[0] ? toClaim(rows[0]) : null;
}

export async function cancelOf(
  orderId: string,
  db: PoolClient,
): Promise<TicketRecord[]> {
  const { rows } = await db.query<TicketRow>(
    `update tickets set status = 'CANCELLED', updated_at = now()
     where order_id = $1 and status = 'VALID'
     returning ${TICKET_COLUMNS}`,
    [orderId],
  );
  return rows.map(toTicket);
}

export async function countUsedOf(
  orderId: string,
  db: Executor = pool,
): Promise<number> {
  const { rows } = await db.query<{ used: number }>(
    `select count(*)::int as used from tickets
     where order_id = $1 and status = 'USED'`,
    [orderId],
  );
  return rows[0].used;
}

export async function revokeSharesOf(
  ticketId: string,
  db: PoolClient,
): Promise<number> {
  const { rowCount } = await db.query(
    `update share_links set revoked_at = now(), updated_at = now()
     where ticket_id = $1 and revoked_at is null`,
    [ticketId],
  );
  return rowCount ?? 0;
}

export async function insertShare(
  ticketId: string,
  tokenHash: string,
  eventStartsAt: string,
  hoursAfterStart: number,
  minimumHours: number,
  db: PoolClient,
): Promise<ShareLink> {
  const { rows } = await db.query<ShareRow>(
    `insert into share_links (ticket_id, token_hash, expires_at)
     values ($1, $2, greatest(
       $3::timestamptz + make_interval(hours => $4),
       now() + make_interval(hours => $5)
     ))
     returning ${SHARE_COLUMNS}`,
    [ticketId, tokenHash, eventStartsAt, hoursAfterStart, minimumHours],
  );
  return toShare(rows[0]);
}

export async function openByTokenHash(
  tokenHash: string,
  db: PoolClient,
): Promise<OpenedShare | null> {
  const { rows } = await db.query<ShareRow & { ticket_id: string }>(
    `update share_links
     set opened_count = opened_count + 1, last_opened_at = now(),
         updated_at = now()
     where token_hash = $1 and ${SHARE_IS_ACTIVE}
     returning ticket_id, ${SHARE_COLUMNS}`,
    [tokenHash],
  );
  return rows[0] ? { ...toShare(rows[0]), ticketId: rows[0].ticket_id } : null;
}

export async function findActiveShareOf(
  ticketId: string,
  db: Executor = pool,
): Promise<ShareLink | null> {
  const { rows } = await db.query<ShareRow>(
    `select ${SHARE_COLUMNS} from share_links
     where ticket_id = $1 and ${SHARE_IS_ACTIVE}
     order by created_at desc
     limit 1`,
    [ticketId],
  );
  return rows[0] ? toShare(rows[0]) : null;
}
