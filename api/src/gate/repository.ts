import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type {
  GateVerdict,
  LoggedAttempt,
  NewValidationAttempt,
} from "./types";

type Executor = Pool | PoolClient;

export const LOG_LIMIT = 50;

type AttemptRow = {
  id: string;
  gate_user_id: string;
  ticket_id: string | null;
  result: GateVerdict;
  code_prefix: string | null;
  created_at: Date;
};

const toAttempt = (row: AttemptRow): LoggedAttempt => ({
  id: row.id,
  at: row.created_at.toISOString(),
  result: row.result,
  codePrefix: row.code_prefix,
  ticketId: row.ticket_id,
  gateUserId: row.gate_user_id,
});

export async function insertAssignment(
  eventId: string,
  gateUserId: string,
  db: PoolClient,
): Promise<void> {
  await db.query(
    `insert into gate_assignments (user_id, event_id)
     values ($1, $2)
     on conflict (user_id, event_id) do nothing`,
    [gateUserId, eventId],
  );
}

export async function findEventIdsOf(
  gateUserId: string,
  db: Executor = pool,
): Promise<string[]> {
  const { rows } = await db.query<{ event_id: string }>(
    `select event_id from gate_assignments where user_id = $1`,
    [gateUserId],
  );
  return rows.map((row) => row.event_id);
}

export async function isAssigned(
  gateUserId: string,
  eventId: string,
  db: Executor = pool,
): Promise<boolean> {
  const { rows } = await db.query(
    `select 1 from gate_assignments where user_id = $1 and event_id = $2`,
    [gateUserId, eventId],
  );
  return rows.length > 0;
}

export async function insertAttempt(
  attempt: NewValidationAttempt,
  db: PoolClient,
): Promise<void> {
  await db.query(
    `insert into validation_attempts
       (event_id, gate_user_id, ticket_id, result, code_prefix)
     values ($1, $2, $3, $4, $5)`,
    [
      attempt.eventId,
      attempt.gateUserId,
      attempt.ticketId,
      attempt.result,
      attempt.codePrefix,
    ],
  );
}

export async function findRecentAttempts(
  eventId: string,
  db: Executor = pool,
): Promise<LoggedAttempt[]> {
  const { rows } = await db.query<AttemptRow>(
    `select id, gate_user_id, ticket_id, result, code_prefix, created_at
     from validation_attempts
     where event_id = $1
     order by created_at desc
     limit $2`,
    [eventId, LOG_LIMIT],
  );
  return rows.map(toAttempt);
}
