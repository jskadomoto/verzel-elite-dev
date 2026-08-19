import { Pool } from "pg";
import { ENV } from "../env";

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  ssl:
    ENV.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
