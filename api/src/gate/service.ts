import type { PoolClient } from "pg";
import { hash } from "../auth/password";
import * as users from "../auth/repository";
import { toPublic, type User } from "../auth/types";
import { withTransaction } from "../db/transaction";
import * as events from "../events/repository";
import type { EventRecord } from "../events/types";
import { conflict, notFound } from "../http/errors";
import * as tickets from "../tickets/repository";
import { readCode } from "../tickets/service";
import type { ReadCode, TicketClaim, TicketRecord } from "../tickets/types";
import * as repository from "./repository";
import type {
  AssignGateUserInput,
  GateAssignment,
  GateEvent,
  GateEventsResult,
  GateLogResult,
  GateOperator,
  GateVerdict,
  ValidateInput,
  ValidationResult,
  ValidatedTicket,
} from "./types";

type PreparedGateUser = {
  name: string;
  email: string;
  passwordHash: string;
};

async function createGateUser(
  prepared: PreparedGateUser,
  db: PoolClient,
): Promise<User> {
  const created = await users.create({ ...prepared, role: "GATE" }, db);
  if (created) return created;

  throw conflict(
    "EMAIL_TAKEN",
    "Este e-mail já tem conta. Envie apenas o e-mail para atribuir a conta existente.",
  );
}

async function assignableGateUser(email: string, db: PoolClient): Promise<User> {
  const user = await users.findByEmail(email, db);
  if (!user) {
    throw notFound(
      "Conta de portaria não encontrada. Envie nome e senha para criar uma.",
    );
  }
  if (user.role !== "GATE") {
    throw conflict(
      "GATE_ROLE_CONFLICT",
      "Este e-mail pertence a uma conta que não é de portaria.",
    );
  }
  return user;
}

export async function assignGateUser(
  eventId: string,
  organizerId: string,
  input: AssignGateUserInput,
): Promise<GateAssignment> {
  const prepared: PreparedGateUser | null = input.password
    ? {
        name: input.name,
        email: input.email,
        passwordHash: await hash(input.password),
      }
    : null;

  return withTransaction(async (client) => {
    const event = await events.findOwned(eventId, organizerId, client);
    if (!event) throw notFound("Evento não encontrado.");

    const user = prepared
      ? await createGateUser(prepared, client)
      : await assignableGateUser(input.email, client);

    await repository.insertAssignment(event.id, user.id, client);

    return { eventId: event.id, user: toPublic(user) };
  });
}

const toGateEvent = (event: EventRecord): GateEvent => ({
  id: event.id,
  status: event.status,
  title: event.title,
  startsAt: event.startsAt,
  timezone: event.timezone,
  venueName: event.venueName,
  city: event.city,
});

function eventOf(
  event: EventRecord | undefined,
  eventId: string,
  gateUserId: string,
): EventRecord {
  if (!event) {
    throw new Error(
      `Portaria ${gateUserId} atribuída a evento inexistente: ${eventId}`,
    );
  }
  return event;
}

export async function listAssignedEvents(
  gateUserId: string,
): Promise<GateEventsResult> {
  const eventIds = await repository.findEventIdsOf(gateUserId);
  const byId = await events.findByIds(eventIds);

  return {
    events: eventIds
      .map((eventId) => eventOf(byId.get(eventId), eventId, gateUserId))
      .sort((one, other) => one.startsAt.localeCompare(other.startsAt))
      .map(toGateEvent),
  };
}

async function assertAssigned(
  gateUserId: string,
  eventId: string,
): Promise<void> {
  if (!(await repository.isAssigned(gateUserId, eventId))) {
    throw notFound("Evento não encontrado.");
  }
}

function operatorOf(
  user: User | null | undefined,
  gateUserId: string,
): GateOperator {
  if (!user) {
    throw new Error(`Operação de portaria sem operador: ${gateUserId}`);
  }
  return { id: user.id, name: user.name };
}

async function validatedTicket(
  ticket: TicketRecord,
  db: PoolClient,
): Promise<ValidatedTicket> {
  const tier = await events.findTierById(ticket.tierId, db);
  if (!tier) {
    throw new Error(
      `Ingresso ${ticket.id} aponta para setor inexistente: ${ticket.tierId}`,
    );
  }
  return {
    id: ticket.id,
    seatLabel: ticket.seatLabel,
    tier: { id: tier.id, name: tier.name },
  };
}

type Outcome = {
  result: ValidationResult;
  ticketId: string | null;
};

const refused = (
  verdict: GateVerdict,
  ticketId: string | null = null,
): Outcome => ({
  result: { verdict, ticket: null, usedAt: null, usedBy: null },
  ticketId,
});

async function settled(
  verdict: GateVerdict,
  ticket: TicketRecord,
  claim: TicketClaim,
  db: PoolClient,
): Promise<Outcome> {
  return {
    result: {
      verdict,
      ticket: await validatedTicket(ticket, db),
      usedAt: claim.usedAt,
      usedBy: claim.usedBy
        ? operatorOf(await users.findById(claim.usedBy, db), claim.usedBy)
        : null,
    },
    ticketId: ticket.id,
  };
}

async function decide(
  read: ReadCode,
  eventId: string,
  gateUserId: string,
  db: PoolClient,
): Promise<Outcome> {
  if (!read.ticketId) return refused("INVALID");

  const ticket = await tickets.findById(read.ticketId, db);
  if (!ticket) return refused("INVALID");
  if (ticket.eventId !== eventId) return refused("WRONG_EVENT", ticket.id);

  const claimed = await tickets.claim(ticket.id, gateUserId, db);
  if (claimed) return settled("VALID", ticket, claimed, db);

  const current = await tickets.findClaim(ticket.id, db);
  if (current?.status === "USED") {
    return settled("ALREADY_USED", ticket, current, db);
  }
  if (current?.status === "CANCELLED") {
    return settled("CANCELLED", ticket, current, db);
  }

  throw new Error(
    `Reivindicação do ingresso ${ticket.id} não afetou linha e o estado atual é ${current?.status}.`,
  );
}

export async function validate(
  gateUserId: string,
  input: ValidateInput,
): Promise<ValidationResult> {
  await assertAssigned(gateUserId, input.eventId);

  const read = readCode(input.code);

  return withTransaction(async (client) => {
    const outcome = await decide(read, input.eventId, gateUserId, client);

    await repository.insertAttempt(
      {
        eventId: input.eventId,
        gateUserId,
        ticketId: outcome.ticketId,
        result: outcome.result.verdict,
        codePrefix: read.prefix,
      },
      client,
    );

    return outcome.result;
  });
}

export async function listRecentAttempts(
  gateUserId: string,
  eventId: string,
): Promise<GateLogResult> {
  await assertAssigned(gateUserId, eventId);

  const logged = await repository.findRecentAttempts(eventId);
  const operators = await users.findByIds([
    ...new Set(logged.map((attempt) => attempt.gateUserId)),
  ]);

  return {
    attempts: logged.map(({ gateUserId: operatorId, ...attempt }) => ({
      ...attempt,
      by: operatorOf(operators.get(operatorId), operatorId),
    })),
  };
}
