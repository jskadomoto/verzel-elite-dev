import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  NewOrder,
  OrderItem,
  OrderRecord,
  OrderStatus,
  PricedItem,
} from "./types";

type Executor = Pool | PoolClient;

const ORDER_COLUMNS = `id, event_id, customer_id, status, total_cents,
  hold_expires_at, paid_at, created_at, updated_at`;

const ITEM_COLUMNS = `id, order_id, tier_id, quantity, unit_price_cents`;

type OrderRow = {
  id: string;
  event_id: string;
  customer_id: string;
  status: OrderStatus;
  total_cents: number;
  hold_expires_at: Date;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type ItemRow = {
  id: string;
  order_id: string;
  tier_id: string;
  quantity: number;
  unit_price_cents: number;
};

const toOrder = (row: OrderRow): OrderRecord => ({
  id: row.id,
  eventId: row.event_id,
  customerId: row.customer_id,
  status: row.status,
  totalCents: row.total_cents,
  holdExpiresAt: row.hold_expires_at.toISOString(),
  paidAt: row.paid_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toItem = (row: ItemRow): OrderItem => ({
  id: row.id,
  orderId: row.order_id,
  tierId: row.tier_id,
  quantity: row.quantity,
  unitPriceCents: row.unit_price_cents,
});

export const storedKey = (customerId: string, idempotencyKey: string) =>
  `${customerId}:${idempotencyKey}`;

export async function insertPending(
  input: NewOrder,
  db: PoolClient,
): Promise<OrderRecord | null> {
  const { rows } = await db.query<OrderRow>(
    `insert into orders (event_id, customer_id, idempotency_key, hold_expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))
     on conflict (idempotency_key) do nothing
     returning ${ORDER_COLUMNS}`,
    [
      input.eventId,
      input.customerId,
      storedKey(input.customerId, input.idempotencyKey),
      input.holdMinutes,
    ],
  );
  return rows[0] ? toOrder(rows[0]) : null;
}

export async function findByKey(
  customerId: string,
  idempotencyKey: string,
  db: Executor = pool,
): Promise<OrderRecord | null> {
  const { rows } = await db.query<OrderRow>(
    `select ${ORDER_COLUMNS} from orders where idempotency_key = $1`,
    [storedKey(customerId, idempotencyKey)],
  );
  return rows[0] ? toOrder(rows[0]) : null;
}

export async function insertItems(
  orderId: string,
  items: PricedItem[],
  db: PoolClient,
): Promise<OrderItem[]> {
  if (!items.length) return [];

  const values: unknown[] = [orderId];
  const placeholders = items.map((item) => {
    values.push(item.tierId, item.quantity, item.unitPriceCents);
    const base = values.length - 2;
    return `($1, $${base}, $${base + 1}, $${base + 2})`;
  });

  const { rows } = await db.query<ItemRow>(
    `insert into order_items (order_id, tier_id, quantity, unit_price_cents)
     values ${placeholders.join(", ")}
     returning ${ITEM_COLUMNS}`,
    values,
  );
  return rows.map(toItem);
}

export async function findItems(
  orderId: string,
  db: Executor = pool,
): Promise<OrderItem[]> {
  const { rows } = await db.query<ItemRow>(
    `select ${ITEM_COLUMNS} from order_items
     where order_id = $1
     order by tier_id`,
    [orderId],
  );
  return rows.map(toItem);
}

export async function updateTotal(
  orderId: string,
  totalCents: number,
  db: PoolClient,
): Promise<OrderRecord> {
  const { rows } = await db.query<OrderRow>(
    `update orders set total_cents = $2, updated_at = now()
     where id = $1
     returning ${ORDER_COLUMNS}`,
    [orderId, totalCents],
  );
  return toOrder(rows[0]);
}
