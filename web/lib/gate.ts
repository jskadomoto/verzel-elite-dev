export type GateVerdict =
  | "VALID"
  | "INVALID"
  | "WRONG_EVENT"
  | "ALREADY_USED"
  | "CANCELLED";

export type GateEvent = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  title: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  city: string;
};

export type GateOperator = {
  id: string;
  name: string;
};

export type ValidatedTicket = {
  id: string;
  seatLabel: string;
  tier: { id: string; name: string };
};

export type ValidationResult = {
  verdict: GateVerdict;
  ticket: ValidatedTicket | null;
  usedAt: string | null;
  usedBy: GateOperator | null;
};

export type ValidationAttempt = {
  id: string;
  at: string;
  result: GateVerdict;
  codePrefix: string | null;
  ticketId: string | null;
  by: GateOperator;
};

export const VERDICT: Record<
  GateVerdict,
  { headline: string; detail: string; mark: string; panel: string; badge: string }
> = {
  VALID: {
    headline: "Pode entrar",
    detail: "Ingresso válido, consumido agora.",
    mark: "M4.5 12.5l5 5 10-11",
    panel: "bg-success text-on-status",
    badge: "border-success/40 bg-success/15 text-success",
  },
  ALREADY_USED: {
    headline: "Já utilizado",
    detail: "Este ingresso já entrou. Não libere a entrada.",
    mark: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 7.5V12l3 2",
    panel: "bg-attention text-on-status",
    badge: "border-attention/40 bg-attention/15 text-attention",
  },
  WRONG_EVENT: {
    headline: "Evento errado",
    detail: "Este ingresso é de outro evento. Não libere a entrada.",
    mark: "M4 8.5h12M13 5.5l3 3-3 3M20 15.5H8M11 12.5l-3 3 3 3",
    panel: "bg-info text-on-status",
    badge: "border-info/40 bg-info/15 text-info",
  },
  CANCELLED: {
    headline: "Cancelado",
    detail: "Ingresso cancelado. Não libere a entrada.",
    mark: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M6 6l12 12",
    panel: "bg-danger text-on-status",
    badge: "border-danger/50 bg-danger/15 text-danger",
  },
  INVALID: {
    headline: "Inválido",
    detail: "Código não reconhecido. Confira e leia de novo.",
    mark: "M6.5 6.5l11 11M17.5 6.5l-11 11",
    panel: "bg-inert text-on-status",
    badge: "border-inert/40 bg-inert/15 text-inert",
  },
};

export const MAX_CODE_LENGTH = 200;

export const isWorkable = (event: GateEvent) => event.status === "PUBLISHED";
