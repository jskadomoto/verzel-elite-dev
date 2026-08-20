import type { Request, RequestHandler } from "express";
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

// Parâmetro de rota fora do formato responde 404, e não 422 como body e query:
// um id que não casa com o formato não identifica recurso nenhum, e dar o mesmo
// veredito de um id válido inexistente impede distinguir os dois de fora.
// Não escreve em `req.valid` de propósito, para não conflitar com o body na
// mesma rota; use `param` para ler o valor já validado.
export const validateParam =
  (
    name: string,
    schema: ZodType,
    message = "Recurso não encontrado.",
  ): RequestHandler =>
  (req, _res, next) => {
    if (!schema.safeParse(req.params[name]).success) {
      return next(new AppError("NOT_FOUND", message, 404));
    }
    next();
  };

// Express 5 tipa params como `string | string[]`. Depois de validateParam o
// valor só pode ser string, porque array não passa em schema de string; isto é
// estreitamento para o compilador, não checagem.
export const param = (req: Request, name: string): string =>
  String(req.params[name]);
