import type { PublicUser } from "../auth/types";
import type { EventStatus } from "../events/types";

export type NewGateUserInput = {
  email: string;
  name: string;
  password: string;
};

export type ExistingGateUserInput = {
  email: string;
  name?: undefined;
  password?: undefined;
};

export type AssignGateUserInput = NewGateUserInput | ExistingGateUserInput;

export type GateAssignment = {
  eventId: string;
  user: PublicUser;
};

export type GateEvent = {
  id: string;
  status: EventStatus;
  title: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  city: string;
};

export type GateEventsResult = {
  events: GateEvent[];
};

export type GateVerdict =
  | "VALID"
  | "INVALID"
  | "WRONG_EVENT"
  | "ALREADY_USED"
  | "CANCELLED";

export type ValidateInput = {
  eventId: string;
  code: string;
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

export type NewValidationAttempt = {
  eventId: string;
  gateUserId: string;
  ticketId: string | null;
  result: GateVerdict;
  codePrefix: string | null;
};

export type ValidationAttempt = {
  id: string;
  at: string;
  result: GateVerdict;
  codePrefix: string | null;
  ticketId: string | null;
  by: GateOperator;
};

export type LoggedAttempt = Omit<ValidationAttempt, "by"> & {
  gateUserId: string;
};

export type GateLogResult = {
  attempts: ValidationAttempt[];
};
