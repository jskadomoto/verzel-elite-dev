import { createApp } from "./app";
import { ENV } from "./env";
import { migrate } from "./db/migrate";
import { startExpirySweeper } from "./orders/service";

async function main() {
  await migrate();

  const app = createApp();

  const server = app.listen(ENV.PORT, "0.0.0.0", () => {
    console.log(`Api ouvindo em :${ENV.PORT} (${ENV.NODE_ENV})`);
  });

  const stopExpirySweeper = startExpirySweeper();

  for (const sinal of ["SIGTERM", "SIGINT"] as const) {
    process.on(sinal, () => {
      stopExpirySweeper();
      server.close(() => process.exit(0));
    });
  }
}

main().catch((err) => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});
