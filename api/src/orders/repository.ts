import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  ExpirySweep,
  LockedOrder,
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

export async function findOwnedForUpdate(
  orderId: string,
  customerId: string,
  db: PoolClient,
): Promise<LockedOrder | null> {
  const { rows } = await db.query<OrderRow & { hold_expired: boolean }>(
    `select ${ORDER_COLUMNS}, hold_expires_at <= now() as hold_expired
     from orders
     where id = $1 and customer_id = $2
     for update`,
    [orderId, customerId],
  );
  if (!rows[0]) return null;
  return { order: toOrder(rows[0]), holdExpired: rows[0].hold_expired };
}

export const CUSTOMER_PAGE_SIZE = 20;

export async function findByCustomer(
  customerId: string,
  db: Executor = pool,
): Promise<{ items: OrderRecord[]; total: number }> {
  const { rows } = await db.query<OrderRow & { total: string }>(
    `select ${ORDER_COLUMNS}, count(*) over() as total
     from orders
     where customer_id = $1
     order by created_at desc, id
     limit $2`,
    [customerId, CUSTOMER_PAGE_SIZE],
  );

  return {
    items: rows.map(toOrder),
    total: rows[0] ? Number(rows[0].total) : 0,
  };
}

export async function findOwned(
  orderId: string,
  customerId: string,
  db: Executor = pool,
): Promise<OrderRecord | null> {
  const { rows } = await db.query<OrderRow>(
    `select ${ORDER_COLUMNS} from orders
     where id = $1 and customer_id = $2`,
    [orderId, customerId],
  );
  return rows[0] ? toOrder(rows[0]) : null;
}

export async function markPaid(
  orderId: string,
  db: PoolClient,
): Promise<OrderRecord> {
  const { rows } = await db.query<OrderRow>(
    `update orders set status = 'PAID', paid_at = now(), updated_at = now()
     where id = $1
     returning ${ORDER_COLUMNS}`,
    [orderId],
  );
  return toOrder(rows[0]);
}

export async function markCancelled(
  orderId: string,
  db: PoolClient,
): Promise<OrderRecord> {
  const { rows } = await db.query<OrderRow>(
    `update orders set status = 'CANCELLED', updated_at = now()
     where id = $1
     returning ${ORDER_COLUMNS}`,
    [orderId],
  );
  return toOrder(rows[0]);
}

export async function releaseItems(
  orderId: string,
  db: PoolClient,
): Promise<number> {
  const { rows } = await db.query<{ released_units: number }>(
    `with per_tier as materialized (
       select tier_id, sum(quantity)::int as quantity
       from order_items
       where order_id = $1
       group by tier_id
     ),
     locked_in_tier_order as materialized (
       select tier.id, per_tier.quantity
       from per_tier
       join ticket_tiers tier on tier.id = per_tier.tier_id
       order by tier.id
       for update of tier
     ),
     released as (
       update ticket_tiers tier
       set allocated = tier.allocated - locked_in_tier_order.quantity,
           updated_at = now()
       from locked_in_tier_order
       where tier.id = locked_in_tier_order.id
       returning locked_in_tier_order.quantity
     )
     select coalesce(sum(quantity), 0)::int as released_units from released`,
    [orderId],
  );
  return rows[0].released_units;
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

export async function findItemsOf(
  orderIds: string[],
  db: Executor = pool,
): Promise<Map<string, OrderItem[]>> {
  const byOrder = new Map<string, OrderItem[]>();
  if (!orderIds.length) return byOrder;

  const { rows } = await db.query<ItemRow>(
    `select ${ITEM_COLUMNS} from order_items
     where order_id = any($1::uuid[])
     order by order_id, tier_id`,
    [orderIds],
  );

  for (const row of rows) {
    const item = toItem(row);
    const existing = byOrder.get(item.orderId);
    if (existing) existing.push(item);
    else byOrder.set(item.orderId, [item]);
  }
  return byOrder;
}

export async function expireOverdueOrders(
  limit: number,
  db: PoolClient,
): Promise<ExpirySweep> {
  const { rows } = await db.query<{
    expired_orders: number;
    released_units: number;
  }>(
    `with overdue as materialized (
       select id from orders
       where status = 'PENDING' and hold_expires_at <= now()
       order by hold_expires_at
       limit $1
       for update skip locked
     ),
     per_tier as materialized (
       select item.tier_id, sum(item.quantity)::int as quantity
       from order_items item
       join overdue on overdue.id = item.order_id
       group by item.tier_id
     ),
     locked_in_tier_order as materialized (
       select tier.id, per_tier.quantity
       from per_tier
       join ticket_tiers tier on tier.id = per_tier.tier_id
       order by tier.id
       for update of tier
     ),
     released as (
       update ticket_tiers tier
       set allocated = tier.allocated - locked_in_tier_order.quantity,
           updated_at = now()
       from locked_in_tier_order
       where tier.id = locked_in_tier_order.id
       returning locked_in_tier_order.quantity
     ),
     expired as (
       update orders
       set status = 'EXPIRED', updated_at = now()
       from overdue
       where orders.id = overdue.id
       returning orders.id
     )
     select
       (select count(*) from expired)::int as expired_orders,
       (select coalesce(sum(quantity), 0) from released)::int as released_units`,
    [limit],
  );
  return {
    expiredOrders: rows[0].expired_orders,
    releasedUnits: rows[0].released_units,
  };
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
