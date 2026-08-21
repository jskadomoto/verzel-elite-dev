import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { validateBody, validateQuery } from "../http/validate";
import * as service from "./service";
import type { ValidateInput } from "./types";

export const gateRouter = Router();

gateRouter.use(requireAuth, requireRole("GATE"));

const validateSchema = z.object({
  eventId: z.uuid(),
  code: z.string().trim().min(1).max(200),
});

const logSchema = z.object({
  eventId: z.uuid(),
});

gateRouter.get("/events", async (req, res) => {
  res.json(await service.listAssignedEvents(req.session!.sub));
});

gateRouter.post("/validate", validateBody(validateSchema), async (req, res) => {
  res.json(await service.validate(req.session!.sub, req.valid as ValidateInput));
});

gateRouter.get("/log", validateQuery(logSchema), async (req, res) => {
  const { eventId } = req.valid as z.infer<typeof logSchema>;
  res.json(await service.listRecentAttempts(req.session!.sub, eventId));
});
