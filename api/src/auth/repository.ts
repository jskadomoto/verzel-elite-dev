import type { Pool, PoolClient } from "pg";
import { pool } from "../db/pool";
import type { Role, User } from "./types";

type Executor = Pool | PoolClient;

type Row = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
};

const toUser = (row: Row): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.password_hash,
  role: row.role,
});

export async function findByEmail(
  email: string,
  db: Executor = pool,
): Promise<User | null> {
  const { rows } = await db.query<Row>(
    "select id, name, email, password_hash, role from users where email = $1",
    [email],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findById(
  id: string,
  db: Executor = pool,
): Promise<User | null> {
  const { rows } = await db.query<Row>(
    "select id, name, email, password_hash, role from users where id = $1",
    [id],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function create(
  input: { name: string; email: string; passwordHash: string; role: Role },
  db: Executor = pool,
): Promise<User | null> {
  const { rows } = await db.query<Row>(
    `insert into users (name, email, password_hash, role)
     values ($1, $2, $3, $4)
     on conflict (email) do nothing
     returning id, name, email, password_hash, role`,
    [input.name, input.email, input.passwordHash, input.role],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function upsertByEmail(
  input: { name: string; email: string; passwordHash: string; role: Role },
  db: Executor = pool,
): Promise<User> {
  const { rows } = await db.query<Row>(
    `insert into users (name, email, password_hash, role)
     values ($1, $2, $3, $4)
     on conflict (email) do update set name = excluded.name, role = excluded.role
     returning id, name, email, password_hash, role`,
    [input.name, input.email, input.passwordHash, input.role],
  );
  return toUser(rows[0]);
}
