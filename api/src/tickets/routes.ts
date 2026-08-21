import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { param, validateParam } from "../http/validate";
import * as service from "./service";

export const myTicketsRouter = Router();
export const ticketsRouter = Router();

myTicketsRouter.use(requireAuth, requireRole("CUSTOMER"));
ticketsRouter.use(requireAuth, requireRole("CUSTOMER"));

const validateId = validateParam("id", z.uuid(), "Ingresso não encontrado.");

myTicketsRouter.get("/", async (req, res) => {
  res.json(await service.listOwned(req.session!.sub));
});

ticketsRouter.get("/:id", validateId, async (req, res) => {
  res.json(await service.getOwned(param(req, "id"), req.session!.sub));
});
