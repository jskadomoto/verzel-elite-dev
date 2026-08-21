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
  { headline: string; detail: string; panel: string; badge: string }
> = {
  VALID: {
    headline: "Pode entrar",
    detail: "Ingresso válido, consumido agora.",
    panel: "bg-emerald-400 text-neutral-950",
    badge: "bg-emerald-400 text-neutral-950",
  },
  ALREADY_USED: {
    headline: "Já utilizado",
    detail: "Este ingresso já entrou. Não libere a entrada.",
    panel: "bg-amber-300 text-neutral-950",
    badge: "bg-amber-300 text-neutral-950",
  },
  WRONG_EVENT: {
    headline: "Evento errado",
    detail: "Este ingresso é de outro evento. Não libere a entrada.",
    panel: "bg-sky-300 text-neutral-950",
    badge: "bg-sky-300 text-neutral-950",
  },
  CANCELLED: {
    headline: "Cancelado",
    detail: "Ingresso cancelado. Não libere a entrada.",
    panel: "bg-rose-500 text-neutral-50",
    badge: "bg-rose-500 text-neutral-50",
  },
  INVALID: {
    headline: "Inválido",
    detail: "Código não reconhecido. Confira e leia de novo.",
    panel: "bg-neutral-200 text-neutral-950",
    badge: "bg-neutral-200 text-neutral-950",
  },
};

export const MAX_CODE_LENGTH = 200;

export const isWorkable = (event: GateEvent) => event.status === "PUBLISHED";
