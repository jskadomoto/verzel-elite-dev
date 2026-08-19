import { ErrorRequestHandler } from "express";
import { AppError } from "./errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      },
    });
    return;
  }

  console.error("Erro nao tratado", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno.", details: {} },
  });
};
