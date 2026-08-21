import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { param, validateParam } from "../http/validate";
import * as service from "./service";

export const myTicketsRouter = Router();
export const ticketsRouter = Router();
export const shareRouter = Router();

myTicketsRouter.use(requireAuth, requireRole("CUSTOMER"));
ticketsRouter.use(requireAuth, requireRole("CUSTOMER"));

const validateId = validateParam("id", z.uuid(), "Ingresso não encontrado.");

const validateToken = validateParam(
  "token",
  z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  "Link não encontrado.",
);

myTicketsRouter.get("/", async (req, res) => {
  res.json(await service.listOwned(req.session!.sub));
});

ticketsRouter.get("/:id", validateId, async (req, res) => {
  res.json(await service.getOwned(param(req, "id"), req.session!.sub));
});

ticketsRouter.post("/:id/share", validateId, async (req, res) => {
  res.status(201).json(await service.share(param(req, "id"), req.session!.sub));
});

ticketsRouter.delete("/:id/share", validateId, async (req, res) => {
  await service.revokeShare(param(req, "id"), req.session!.sub);
  res.status(204).end();
});

shareRouter.get("/:token", validateToken, async (req, res) => {
  res.json(await service.openShared(param(req, "token")));
});
