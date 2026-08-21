import { randomUUID } from "node:crypto";
import { pool } from "./pool";
import { hash } from "../auth/password";
import * as users from "../auth/repository";
import { ENV } from "../env";
import * as events from "../events/service";
import type { EventWithTiers } from "../events/types";
import * as gate from "../gate/service";
import * as orders from "../orders/service";
import * as payments from "../payments/service";
import * as tickets from "../tickets/repository";
import { codeFor, share } from "../tickets/service";
import type { TicketRecord } from "../tickets/types";

const PASSWORD = "senha123";
const BUYER_EMAIL = "cliente1@demo.com";
const GATE_EMAIL = "portaria@demo.com";
const SEED_QUANTITY = 2;
const SHARE_PATH = "/ingresso";

const SEED_CARD = {
  number: "4242 4242 4242 4242",
  holder: "CLIENTE UM",
  expiry: "12/30",
  cvc: "123",
};

const SEED_EVENT_TIMEZONE = "America/Sao_Paulo";
const SEED_EVENT_START_TIME = "20:00:00";
const DAYS_AHEAD = 90;
const MIN_DAYS_AHEAD = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const SEED_EVENT = {
  title: "Festival Elite Dev",
  description:
    "Festival de demonstração com dois setores, criado pelo seed para percorrer catálogo, compra e portaria.",
  category: "musica",
  imageUrl: null,
  timezone: SEED_EVENT_TIMEZONE,
  venueName: "Arena Elite",
  address: "Av. das Nações, 1000",
  city: "São Paulo",
  state: "SP",
  country: "BR",
  tiers: [
    { name: "Pista", priceCents: 12000, capacity: 300 },
    { name: "Camarote", priceCents: 35000, capacity: 40 },
  ],
};

function nextStartsAt(): string {
  const instant = new Date(Date.now() + DAYS_AHEAD * DAY_IN_MS);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SEED_EVENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(instant);

  const partOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const offset = partOf("timeZoneName").replace("GMT", "") || "+00:00";

  return `${partOf("year")}-${partOf("month")}-${partOf("day")}T${SEED_EVENT_START_TIME}${offset}`;
}

const startsTooSoon = (event: EventWithTiers) =>
  Date.parse(event.startsAt) < Date.now() + MIN_DAYS_AHEAD * DAY_IN_MS;

async function findSeedEvent(
  organizerId: string,
): Promise<EventWithTiers | null> {
  let page = 0;

  for (;;) {
    const { items, pageSize, total } = await events.listOwned(organizerId, page);
    const found = items.find(
      (event) => event.title === SEED_EVENT.title && event.status !== "CANCELLED",
    );
    if (found) return found;

    page += 1;
    if (page * pageSize >= total) return null;
  }
}

async function usableSeedEvent(
  organizerId: string,
): Promise<EventWithTiers | null> {
  const existing = await findSeedEvent(organizerId);
  if (!existing) return null;
  if (!startsTooSoon(existing)) return existing;

  if (existing.status !== "DRAFT") {
    await events.cancel(existing.id, organizerId);
    return null;
  }

  return events.update(existing.id, organizerId, { startsAt: nextStartsAt() });
}

const createSeedEvent = (organizerId: string) =>
  events.create(organizerId, { ...SEED_EVENT, startsAt: nextStartsAt() });

const publishIfDraft = async (event: EventWithTiers, organizerId: string) =>
  event.status === "DRAFT" ? events.publish(event.id, organizerId) : event;

async function seedPublishedEvent(
  organizerId: string,
): Promise<EventWithTiers> {
  const event = (await usableSeedEvent(organizerId)) ?? (await createSeedEvent(organizerId));
  return publishIfDraft(event, organizerId);
}

const seededTicketsOf = async (eventId: string, holderUserId: string) =>
  (await tickets.findByHolder(holderUserId))
    .filter((ticket) => ticket.eventId === eventId)
    .sort((one, other) => one.seatLabel.localeCompare(other.seatLabel));

async function seedPaidTickets(
  event: EventWithTiers,
  buyerId: string,
): Promise<TicketRecord[]> {
  const owned = await seededTicketsOf(event.id, buyerId);
  if (owned.length) return owned;

  const { order } = await orders.create(buyerId, {
    eventId: event.id,
    items: [{ tierId: event.tiers[0].id, quantity: SEED_QUANTITY }],
    idempotencyKey: `seed-${randomUUID()}`,
  });

  await payments.pay(buyerId, order.id, {
    card: SEED_CARD,
    idempotencyKey: `seed-${randomUUID()}`,
  });

  return seededTicketsOf(event.id, buyerId);
}

const asBrl = (priceCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    priceCents / 100,
  );

const asLocalDateTime = (instant: string, timezone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(instant));

type Seeded = {
  users: Array<{ role: string; email: string }>;
  event: EventWithTiers;
  issued: TicketRecord[];
  shared: TicketRecord;
  shareUrl: string;
};

const seatOf = (ticket: TicketRecord, event: EventWithTiers) =>
  `${event.tiers.find((tier) => tier.id === ticket.tierId)?.name ?? "?"} ${ticket.seatLabel}`;

function printSummary({ users: seeded, event, issued, shared, shareUrl }: Seeded) {
  console.log("\nUsuários semeados, senha única:", PASSWORD, "\n");
  for (const user of seeded) {
    console.log(`${user.role.padEnd(10)} ${user.email}`);
  }

  console.log("\nEvento publicado:\n");
  console.log(`  ${event.title}`);
  console.log(
    `  ${asLocalDateTime(event.startsAt, event.timezone)}  (${event.timezone})`,
  );
  console.log(`  ${event.venueName}, ${event.city}`);
  console.log();
  for (const tier of event.tiers) {
    console.log(
      `  ${tier.name.padEnd(10)} ${asBrl(tier.priceCents).padStart(10)}   ${String(
        tier.capacity,
      ).padStart(3)} lugares`,
    );
  }

  console.log(`\n  portaria do evento: ${GATE_EMAIL}`);

  console.log(`\nIngressos pagos de ${BUYER_EMAIL}:\n`);
  for (const ticket of issued) {
    console.log(`  ${seatOf(ticket, event).padEnd(16)} ${ticket.status}`);
  }

  const forGate = issued.find((ticket) => ticket.status === "VALID");

  console.log("\nCódigo para colar na portaria:\n");
  console.log(
    forGate
      ? `  ${codeFor(forGate.id)}   (${seatOf(forGate, event)})`
      : "  nenhum ingresso semeado continua válido; todos já foram validados",
  );

  console.log("\nLink de compartilhamento:\n");
  console.log(`  ${shareUrl}   (${seatOf(shared, event)})`);
  console.log(
    "\n  cada execução do seed gera um link novo e revoga o anterior\n",
  );
}

async function main() {
  const passwordHash = await hash(PASSWORD);

  const seeded = await Promise.all([
    users.upsertByEmail({
      name: "Organizador Demo",
      email: "organizador@demo.com",
      passwordHash,
      role: "ORGANIZER",
    }),
    users.upsertByEmail({
      name: "Cliente Um",
      email: "cliente1@demo.com",
      passwordHash,
      role: "CUSTOMER",
    }),
    users.upsertByEmail({
      name: "Cliente Dois",
      email: "cliente2@demo.com",
      passwordHash,
      role: "CUSTOMER",
    }),
    users.upsertByEmail({
      name: "Portaria Demo",
      email: "portaria@demo.com",
      passwordHash,
      role: "GATE",
    }),
  ]);

  const [organizer, buyer] = seeded;

  const event = await seedPublishedEvent(organizer.id);
  await gate.assignGateUser(event.id, organizer.id, { email: GATE_EMAIL });

  const issued = await seedPaidTickets(event, buyer.id);
  const shared = issued.at(-1);
  if (!shared) {
    throw new Error(`Nenhum ingresso emitido para ${BUYER_EMAIL}.`);
  }

  const { token } = await share(shared.id, buyer.id);

  printSummary({
    users: seeded,
    event,
    issued,
    shared,
    shareUrl: `${ENV.WEB_URL}${SHARE_PATH}/${token}`,
  });
}

main()
  .catch((err) => {
    console.error("falha no seed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
