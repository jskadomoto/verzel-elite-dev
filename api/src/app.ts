import express from "express";
import { errorHandler } from "./http/error-handler";
import { authRouter } from "./auth/routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));

  app.use("/", require("./routes").router);

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
  });

  app.use(errorHandler);
  app.use("/auth", authRouter);
  return app;
}
