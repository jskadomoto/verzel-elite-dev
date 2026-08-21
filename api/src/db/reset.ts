import { pool } from "./pool";
import { ENV } from "../env";
import { withTransaction } from "./transaction";

const STEPS = [
  "delete from validation_attempts",
  "delete from share_links",
  "delete from tickets",
  "delete from payments",
  "delete from order_items",
  "delete from orders",
  "update ticket_tiers set allocated = 0, issued_seq = 0, updated_at = now()",
] as const;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "endereço ilegível";
  }
};

async function main() {
  console.log(`\nApagando dados de compra em ${hostOf(ENV.DATABASE_URL)}.\n`);
  console.log("Usuários, eventos e setores permanecem.\n");

  const removed = await withTransaction(async (client) => {
    const counts: Array<[string, number]> = [];
    for (const step of STEPS) {
      const { rowCount } = await client.query(step);
      counts.push([step, rowCount ?? 0]);
    }
    return counts;
  });

  for (const [step, rows] of removed) {
    console.log(`  ${String(rows).padStart(5)}  ${step}`);
  }

  console.log("\nRode o seed para recriar a massa de demonstração.\n");
}

main()
  .catch((err) => {
    console.error("falha ao limpar:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
