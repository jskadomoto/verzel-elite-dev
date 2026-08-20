import { Router } from "express";
import z from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import * as service from "./service";
import { validateQuery } from "../http/validate";

export const catalogRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  page: z.coerce.number().int().min(0).max(50).default(0),
});

catalogRouter.get(
  "/search",
  requireAuth,
  requireRole("ORGANIZER"),
  validateQuery(searchSchema),
  async (req, res) => {
    const { q, page } = req.valid as z.infer<typeof searchSchema>;
    res.json(await service.search(q, page));
  },
);
