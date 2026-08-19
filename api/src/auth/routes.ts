import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../http/validate";
import { requireAuth } from "./middleware";
import * as service from "./service";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  res
    .status(201)
    .json(await service.register(req.valid as z.infer<typeof registerSchema>));
});

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  res.json(await service.login(req.valid as z.infer<typeof loginSchema>));
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await service.me(req.session!.sub));
});
