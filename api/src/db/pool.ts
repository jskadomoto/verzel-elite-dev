import { Pool } from "pg";
import { ENV } from "../env";

const SSL_MODES = /[?&]sslmode=(require|verify-ca|verify-full)(&|$)/;

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl: SSL_MODES.test(ENV.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
});
