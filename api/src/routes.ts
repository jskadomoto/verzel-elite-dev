import { Router } from "express";

export const router = Router();
const startedAt = new Date().toDateString();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "verzel-elite-dev-api",
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || "local",
    startedAt,
    now: new Date().toISOString(),
  });
});
