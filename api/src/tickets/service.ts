import { createHmac } from "node:crypto";
import { ENV } from "../env";
import * as events from "../events/repository";
import type { EventRecord, Tier } from "../events/types";
import { notFound } from "../http/errors";
import * as repository from "./repository";
import type {
  TicketDetail,
  TicketEvent,
  TicketRecord,
  TicketSummary,
  TicketTier,
} from "./types";

export const CODE_VERSION = "v1";
export const CODE_SEPARATOR = ".";
export const SIGNATURE_BYTES = 16;

const withoutSeparators = (ticketId: string) => ticketId.replaceAll("-", "");

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

export async function getOwned(
  ticketId: string,
  holderUserId: string,
): Promise<TicketDetail> {
  const ticket = await repository.findOwned(ticketId, holderUserId);
  if (!ticket) throw notFound("Ingresso não encontrado.");

  const [event, tier] = await Promise.all([
    events.findById(ticket.eventId),
    events.findTierById(ticket.tierId),
  ]);

  return {
    ...toSummary(ticket, eventOf(event, ticket), tierOf(tier, ticket)),
    code: codeFor(ticket.id),
  };
}
