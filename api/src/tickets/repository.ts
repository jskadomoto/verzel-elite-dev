import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type { NewTicket, TicketRecord, TicketStatus } from "./types";

type Executor = Pool | PoolClient;

const TICKET_COLUMNS = `id, order_id, event_id, tier_id, seat_label, status, created_at`;

type TicketRow = {
  id: string;
  order_id: string;
  event_id: string;
  tier_id: string;
  seat_label: string;
  status: TicketStatus;
  created_at: Date;
};

const toTicket = (row: TicketRow): TicketRecord => ({
  id: row.id,
  orderId: row.order_id,
  eventId: row.event_id,
  tierId: row.tier_id,
  seatLabel: row.seat_label,
  status: row.status,
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
