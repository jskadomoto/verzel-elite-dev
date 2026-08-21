import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { validateBody } from "../http/validate";
import * as service from "./service";
import type { CreateOrderInput } from "./types";

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole("CUSTOMER"));

const createSchema = z.object({
  eventId: z.uuid(),
  items: z
    .array(
      z.object({
        tierId: z.uuid(),
        quantity: z.number().int().min(1).max(6),
      }),
    )
    .min(1)
    .max(6),
  idempotencyKey: z.string().trim().min(8).max(120),
});

ordersRouter.post("/", validateBody(createSchema), async (req, res) => {
  const input = req.valid as CreateOrderInput;
  const { order, created } = await service.create(req.session!.sub, input);
  res.status(created ? 201 : 200).json(order);
});
