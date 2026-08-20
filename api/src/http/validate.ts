import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "./errors";

declare global {
  namespace Express {
    interface Request {
      valid?: unknown;
    }
  }
}

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          "VALIDATION_ERROR",
          "Dados inválidos.",
          422,
          result.error.flatten(),
        ),
      );
    }
    req.valid = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success)
      return next(
        new AppError(
          "VALIDATION_ERROR",
          "Parâmetros inválidos",
          422,
          result.error.flatten(),
        ),
      );

    req.valid = result.data;
    next();
  };
