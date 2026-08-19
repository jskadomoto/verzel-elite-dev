import { createApp } from "./app";
import { ENV } from "./env";

const app = createApp();

const server = app.listen(ENV.PORT, "0.0.0.0", () => {
  console.log(`Api ouvindo na porta: ${ENV.PORT} (${ENV.NODE_ENV})`);
});

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, () => {
    server.close(() => process.exit(0));
  });
}
