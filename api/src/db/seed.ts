import { pool } from "./pool";
import { hash } from "../auth/password";
import * as users from "../auth/repository";
import * as events from "../events/service";
import type { EventWithTiers } from "../events/types";

const PASSWORD = "senha123";

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

function printCredentials(
  seeded: Array<{ role: string; email: string }>,
  event: EventWithTiers,
) {
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
  console.log();
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

  const [organizer] = seeded;

  printCredentials(seeded, await seedPublishedEvent(organizer.id));
}

main()
  .catch((err) => {
    console.error("falha no seed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
