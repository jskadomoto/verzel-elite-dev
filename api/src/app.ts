import express from "express";
import { errorHandler } from "./http/error-handler";
import { authRouter } from "./auth/routes";
import { catalogRouter } from "./catalog/route";
import { eventsRouter } from "./events/routes";
import { publicEventsRouter } from "./events/public-routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.use("/", require("./routes").router);
  app.use("/auth", authRouter);
  app.use("/catalog", catalogRouter);
  // O catálogo público vem antes do organizador e num caminho disjunto. Não há
  // guarda de autenticação em nível de aplicação: requireAuth só existe dentro
  // de cada router, então nenhum middleware de sessão alcança /events.
  app.use("/events", publicEventsRouter);
  app.use("/organizer/events", eventsRouter);

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
  });

  app.use(errorHandler);
  return app;
}
