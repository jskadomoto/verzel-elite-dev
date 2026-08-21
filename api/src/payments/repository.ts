import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  DeclineReason,
  NewPayment,
  PaymentRecord,
  PaymentStatus,
} from "./types";

type Executor = Pool | PoolClient;

const PAYMENT_COLUMNS = `id, order_id, status, card_last4, decline_reason, created_at`;

type PaymentRow = {
  id: string;
  order_id: string;
  status: PaymentStatus;
  card_last4: string | null;
  decline_reason: DeclineReason | null;
  created_at: Date;
};

const toPayment = (row: PaymentRow): PaymentRecord => ({
  id: row.id,
  orderId: row.order_id,
  status: row.status,
  cardLast4: row.card_last4,
  declineReason: row.decline_reason,
  createdAt: row.created_at.toISOString(),
});

export const storedKey = (
  customerId: string,
  orderId: string,
  idempotencyKey: string,
) => `${customerId}:${orderId}:${idempotencyKey}`;

export async function insertAttempt(
  input: NewPayment,
  db: PoolClient,
): Promise<PaymentRecord | null> {
  const { rows } = await db.query<PaymentRow>(
    `insert into payments (order_id, status, card_last4, decline_reason, idempotency_key)
     values ($1, $2, $3, $4, $5)
     on conflict (idempotency_key) do nothing
     returning ${PAYMENT_COLUMNS}`,
    [
      input.orderId,
      input.status,
      input.cardLast4,
      input.declineReason,
      storedKey(input.customerId, input.orderId, input.idempotencyKey),
    ],
  );
  return rows[0] ? toPayment(rows[0]) : null;
}

export async function findByKey(
  customerId: string,
  orderId: string,
  idempotencyKey: string,
  db: Executor = pool,
): Promise<PaymentRecord | null> {
  const { rows } = await db.query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments where idempotency_key = $1`,
    [storedKey(customerId, orderId, idempotencyKey)],
  );
  return rows[0] ? toPayment(rows[0]) : null;
}
