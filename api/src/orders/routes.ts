import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { param, validateBody, validateParam } from "../http/validate";
import * as payments from "../payments/service";
import type { PayOrderInput } from "../payments/types";
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

const cardSchema = z.object({
  number: z
    .string()
    .trim()
    .max(25)
    .regex(/^[0-9 ]+$/)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19;
    }),
  holder: z.string().trim().min(2).max(80),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  cvc: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/),
});

const paySchema = z.object({
  card: cardSchema,
  idempotencyKey: z.string().trim().min(8).max(120),
});

const validateId = validateParam("id", z.uuid(), "Pedido não encontrado.");

ordersRouter.post("/", validateBody(createSchema), async (req, res) => {
  const input = req.valid as CreateOrderInput;
  const { order, created } = await service.create(req.session!.sub, input);
  res.status(created ? 201 : 200).json(order);
});

ordersRouter.get("/", async (req, res) => {
  res.json(await service.listOwned(req.session!.sub));
});

ordersRouter.get("/:id", validateId, async (req, res) => {
  res.json(await service.getOwned(req.session!.sub, param(req, "id")));
});

ordersRouter.post("/:id/cancel", validateId, async (req, res) => {
  res.json(await service.cancel(req.session!.sub, param(req, "id")));
});

ordersRouter.post(
  "/:id/payment",
  validateId,
  validateBody(paySchema),
  async (req, res) => {
    const input = req.valid as PayOrderInput;
    const { created, ...result } = await payments.pay(
      req.session!.sub,
      param(req, "id"),
      input,
    );
    res.status(created ? 201 : 200).json(result);
  },
);
