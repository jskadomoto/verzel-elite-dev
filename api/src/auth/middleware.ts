import type { RequestHandler } from "express";
import { AppError } from "../http/errors";
import { verify, type Session } from "./token";

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("UNAUTHENTICATED", "Sessão ausente.", 401));
  }
  try {
    req.session = verify(header.slice(7));
    next();
  } catch {
    next(new AppError("UNAUTHENTICATED", "Sessão inválida.", 401));
  }
};

export const requireRole =
  (...roles: Session["role"][]): RequestHandler =>
  (req, _res, next) => {
    if (!req.session)
      return next(new AppError("UNAUTHENTICATED", "Sessão ausente.", 401));
    if (!roles.includes(req.session.role)) {
      return next(
        new AppError("FORBIDDEN", "Papel sem permissão para esta ação.", 403),
      );
    }
    next();
  };
