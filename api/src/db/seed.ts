import { pool } from "./pool";
import { hash } from "../auth/password";
import * as users from "../auth/repository";

const PASSWORD = "senha123";

async function main() {
  const passwordHash = await hash(PASSWORD);

  const seeded = await Promise.all([
    users.upsertByEmail({
      name: "Organizador Demo",
      email: "organizador@demo.com",
      passwordHash,
      role: "ORGANIZER",
    }),
    users.upsertByEmail({
      name: "Cliente Um",
      email: "cliente1@demo.com",
      passwordHash,
      role: "CUSTOMER",
    }),
    users.upsertByEmail({
      name: "Cliente Dois",
      email: "cliente2@demo.com",
      passwordHash,
      role: "CUSTOMER",
    }),
    users.upsertByEmail({
      name: "Portaria Demo",
      email: "portaria@demo.com",
      passwordHash,
      role: "GATE",
    }),
  ]);

  console.log("\nUsuários semeados, senha única:", PASSWORD, "\n");
  for (const user of seeded) {
    console.log(`${user.role.padEnd(10)} ${user.email}`);
  }
  console.log();
}

main()
  .catch((err) => {
    console.error("falha no seed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
