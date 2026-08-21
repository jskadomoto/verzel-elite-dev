import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import {
  param,
  validateBody,
  validateParam,
  validateQuery,
} from "../http/validate";
import * as service from "./service";
import type { CreateEventInput, UpdateEventInput } from "./types";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireRole("ORGANIZER"));

const tierSchema = z.object({
  name: z.string().min(1).max(60),
  priceCents: z.number().int().max(10_000_000),
  capacity: z.number().int().min(1).max(200_000),
});

const tiersSchema = z.array(tierSchema).min(1).max(6);

const eventFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  imageUrl: z.url().nullable().optional(),
  startsAt: z.iso
    .datetime({ offset: true })
    .refine((value) => value >= "1900-01-01", {
      message: "Data de início anterior ao mínimo aceito.",
    })
    .optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  venueName: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().length(2).optional(),
});

const createSchema = eventFieldsSchema.extend({
  externalId: z.string().trim().min(1).max(120).optional(),
  tiers: tiersSchema.optional(),
});

const updateSchema = eventFieldsSchema.extend({
  tiers: tiersSchema.optional(),
});

const validateId = validateParam("id", z.uuid(), "Evento não encontrado.");
const listSchema = z.object({
  page: z.coerce.number().int().min(0).max(500).default(0),
});

eventsRouter.get("/", validateQuery(listSchema), async (req, res) => {
  const { page } = req.valid as z.infer<typeof listSchema>;
  res.json(await service.listOwned(req.session!.sub, page));
});

eventsRouter.post("/", validateBody(createSchema), async (req, res) => {
  const input = req.valid as CreateEventInput;
  res.status(201).json(await service.create(req.session!.sub, input));
});

eventsRouter.get("/:id", validateId, async (req, res) => {
  res.json(await service.getOwned(param(req, "id"), req.session!.sub));
});

eventsRouter.patch(
  "/:id",
  validateId,
  validateBody(updateSchema),
  async (req, res) => {
    const input = req.valid as UpdateEventInput;
    res.json(await service.update(param(req, "id"), req.session!.sub, input));
  },
);

eventsRouter.post("/:id/publish", validateId, async (req, res) => {
  res.json(await service.publish(param(req, "id"), req.session!.sub));
});

eventsRouter.post("/:id/cancel", validateId, async (req, res) => {
  res.json(await service.cancel(param(req, "id"), req.session!.sub));
});
