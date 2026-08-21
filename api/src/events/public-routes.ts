import { Router } from "express";
import z from "zod";
import { param, validateParam, validateQuery } from "../http/validate";
import * as service from "./service";
import type { PublicSearchFilters } from "./types";

export const publicEventsRouter = Router();

const PERIODO_MINIMO = "1900-01-01";

const dataDoFiltro = z.iso
  .date()
  .refine((valor) => valor >= PERIODO_MINIMO, {
    message: "Data fora do período que o catálogo cobre.",
  });

const searchSchema = z
  .object({
    q: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().max(120).optional(),
    category: z.string().trim().max(60).optional(),
    from: dataDoFiltro.optional(),
    to: dataDoFiltro.optional(),
    page: z.coerce.number().int().min(0).max(500).default(0),
  })
  .refine(
    (filters) =>
      !filters.from ||
      !filters.to ||
      Date.parse(filters.to) >= Date.parse(filters.from),
    { message: "O fim do período não pode ser anterior ao início.", path: ["to"] },
  );

publicEventsRouter.get("/", validateQuery(searchSchema), async (req, res) => {
  res.json(await service.searchPublished(req.valid as PublicSearchFilters));
});

publicEventsRouter.get("/cities", async (_req, res) => {
  res.json(await service.listPublishedCities());
});

publicEventsRouter.get(
  "/:id",
  validateParam("id", z.uuid(), "Evento não encontrado."),
  async (req, res) => {
    res.json(await service.getPublished(param(req, "id")));
  },
);
