import express from "express";
import { errorHandler } from "./http/error-handler";
import { authRouter } from "./auth/routes";
import { catalogRouter } from "./catalog/route";
import { eventsRouter } from "./events/routes";
import { publicEventsRouter } from "./events/public-routes";
import { gateRouter } from "./gate/routes";
import { ordersRouter } from "./orders/routes";
import { myTicketsRouter, shareRouter, ticketsRouter } from "./tickets/routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.use("/", require("./routes").router);
  app.use("/auth", authRouter);
  app.use("/catalog", catalogRouter);
  app.use("/events", publicEventsRouter);
  app.use("/share", shareRouter);
  app.use("/organizer/events", eventsRouter);
  app.use("/orders", ordersRouter);
  app.use("/me/tickets", myTicketsRouter);
  app.use("/tickets", ticketsRouter);
  app.use("/gate", gateRouter);

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
  });

  app.use(errorHandler);
  return app;
}
