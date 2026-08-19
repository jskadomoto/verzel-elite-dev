import { join } from "node:path";
import { pool } from "./pool";
import { readdirSync, readFileSync } from "node:fs";

const dir = join(__dirname, "migrations");

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
            create table if not exists schema_migrations (
                name text primary key,
                applied_at timestamptz not null default now()
            )
            `);

    const applied = new Set(
      (
        await client.query<{ name: string }>(
          "select name from schema_migrations",
        )
      ).rows.map((r) => r.name),
    );

    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [
          file,
        ]);
        await client.query("commit");
        console.log(`Migração aplicada: ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(
          `Falha na migração do arquivo: ${file} - ${(err as Error).message}`,
        );
      }
    }
  } finally {
    client.release();
  }
}
