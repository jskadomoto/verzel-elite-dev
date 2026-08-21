import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { withTransaction } from "../db/transaction";
import { ENV } from "../env";
import * as events from "../events/repository";
import type { EventRecord, Tier } from "../events/types";
import { notFound } from "../http/errors";
import * as repository from "./repository";
import type {
  IssuedShareLink,
  ReadCode,
  SharedTicket,
  TicketDetail,
  TicketEvent,
  TicketRecord,
  TicketSummary,
  TicketTier,
} from "./types";

export const CODE_VERSION = "v1";
export const CODE_SEPARATOR = ".";
export const SIGNATURE_BYTES = 16;
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_HOURS_AFTER_START = 12;
export const SHARE_MINIMUM_HOURS = 1;

export const SIGNATURE_LENGTH = Math.ceil((SIGNATURE_BYTES * 4) / 3);
const IDENTIFIER_PATTERN = /^[0-9a-f]{32}$/;
const IDENTIFIER_GROUPS = [8, 12, 16, 20];

const withoutSeparators = (ticketId: string) => ticketId.replaceAll("-", "");

const withSeparators = (identifier: string) =>
  IDENTIFIER_GROUPS.reduceRight(
    (formatted, at) => `${formatted.slice(0, at)}-${formatted.slice(at)}`,
    identifier,
  );

const signatureFor = (signed: string) =>
  createHmac("sha256", ENV.TICKET_SECRET)
    .update(signed)
    .digest()
    .subarray(0, SIGNATURE_BYTES)
    .toString("base64url");

export function codeFor(ticketId: string): string {
  const signed = [CODE_VERSION, withoutSeparators(ticketId)].join(
    CODE_SEPARATOR,
  );
  return [signed, signatureFor(signed)].join(CODE_SEPARATOR);
}

function signatureMatches(signed: string, signature: string): boolean {
  const expected = Buffer.from(signatureFor(signed));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const UNREADABLE: ReadCode = { prefix: null, ticketId: null };

export function readCode(code: string): ReadCode {
  const [version, identifier, signature, ...rest] = code.split(CODE_SEPARATOR);

  if (rest.length || version !== CODE_VERSION) return UNREADABLE;
  if (!IDENTIFIER_PATTERN.test(identifier ?? "")) return UNREADABLE;
  if (signature?.length !== SIGNATURE_LENGTH) return UNREADABLE;

  const signed = [version, identifier].join(CODE_SEPARATOR);

  return {
    prefix: signed,
    ticketId: signatureMatches(signed, signature)
      ? withSeparators(identifier)
      : null,
  };
}

const toTicketEvent = (event: EventRecord): TicketEvent => ({
  id: event.id,
  status: event.status,
  title: event.title,
  startsAt: event.startsAt,
  timezone: event.timezone,
  venueName: event.venueName,
  address: event.address,
  city: event.city,
  state: event.state,
  country: event.country,
});

const toTicketTier = (tier: Tier): TicketTier => ({
  id: tier.id,
  name: tier.name,
});

function toSummary(
  ticket: TicketRecord,
  event: EventRecord,
  tier: Tier,
): TicketSummary {
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    seatLabel: ticket.seatLabel,
    status: ticket.status,
    usedAt: ticket.usedAt,
    createdAt: ticket.createdAt,
    event: toTicketEvent(event),
    tier: toTicketTier(tier),
  };
}

function eventOf(
  event: EventRecord | null | undefined,
  ticket: TicketRecord,
): EventRecord {
  if (!event) {
    throw new Error(
      `Ingresso ${ticket.id} aponta para evento inexistente: ${ticket.eventId}`,
    );
  }
  return event;
}

function tierOf(tier: Tier | null | undefined, ticket: TicketRecord): Tier {
  if (!tier) {
    throw new Error(
      `Ingresso ${ticket.id} aponta para setor inexistente: ${ticket.tierId}`,
    );
  }
  return tier;
}

const tiersById = (byEvent: Map<string, Tier[]>) => {
  const byId = new Map<string, Tier>();
  for (const tiers of byEvent.values()) {
    for (const tier of tiers) byId.set(tier.id, tier);
  }
  return byId;
};

export async function listOwned(
  holderUserId: string,
): Promise<{ tickets: TicketSummary[] }> {
  const owned = await repository.findByHolder(holderUserId);
  if (!owned.length) return { tickets: [] };

  const eventIds = [...new Set(owned.map((ticket) => ticket.eventId))];
  const [byEventId, tiersByEvent] = await Promise.all([
    events.findByIds(eventIds),
    events.findTiersOf(eventIds),
  ]);
  const byTierId = tiersById(tiersByEvent);

  return {
    tickets: owned.map((ticket) =>
      toSummary(
        ticket,
        eventOf(byEventId.get(ticket.eventId), ticket),
        tierOf(byTierId.get(ticket.tierId), ticket),
      ),
    ),
  };
}

const hashOf = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function share(
  ticketId: string,
  holderUserId: string,
): Promise<IssuedShareLink> {
  const token = randomBytes(SHARE_TOKEN_BYTES).toString("base64url");

  return withTransaction(async (client) => {
    const ticket = await repository.findOwnedForUpdate(
      ticketId,
      holderUserId,
      client,
    );
    if (!ticket) throw notFound("Ingresso não encontrado.");

    const event = eventOf(
      await events.findById(ticket.eventId, client),
      ticket,
    );

    await repository.revokeSharesOf(ticket.id, client);
    const link = await repository.insertShare(
      ticket.id,
      hashOf(token),
      event.startsAt,
      SHARE_HOURS_AFTER_START,
      SHARE_MINIMUM_HOURS,
      client,
    );

    return { ...link, token };
  });
}

export async function revokeShare(
  ticketId: string,
  holderUserId: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const ticket = await repository.findOwnedForUpdate(
      ticketId,
      holderUserId,
      client,
    );
    if (!ticket) throw notFound("Ingresso não encontrado.");

    await repository.revokeSharesOf(ticket.id, client);
  });
}

export async function openShared(token: string): Promise<SharedTicket> {
  return withTransaction(async (client) => {
    const opened = await repository.openByTokenHash(hashOf(token), client);
    if (!opened) throw notFound("Link não encontrado.");

    const ticket = await repository.findById(opened.ticketId, client);
    if (!ticket) {
      throw new Error(
        `Link de compartilhamento aponta para ingresso inexistente: ${opened.ticketId}`,
      );
    }

    const [event, tier] = await Promise.all([
      events.findById(ticket.eventId, client),
      events.findTierById(ticket.tierId, client),
    ]);

    return {
      code: codeFor(ticket.id),
      seatLabel: ticket.seatLabel,
      status: ticket.status,
      usedAt: ticket.usedAt,
      tier: toTicketTier(tierOf(tier, ticket)),
      event: toTicketEvent(eventOf(event, ticket)),
    };
  });
}

export async function getOwned(
  ticketId: string,
  holderUserId: string,
): Promise<TicketDetail> {
  const ticket = await repository.findOwned(ticketId, holderUserId);
  if (!ticket) throw notFound("Ingresso não encontrado.");

  const [event, tier, share] = await Promise.all([
    events.findById(ticket.eventId),
    events.findTierById(ticket.tierId),
    repository.findActiveShareOf(ticket.id),
  ]);

  return {
    ...toSummary(ticket, eventOf(event, ticket), tierOf(tier, ticket)),
    code: codeFor(ticket.id),
    share,
  };
}
