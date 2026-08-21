import * as catalog from "../catalog/service";
import type { CatalogItem } from "../catalog/types";
import { withTransaction } from "../db/transaction";
import { badRequest, conflict, notFound } from "../http/errors";
import * as repository from "./repository";
import {
  toPublicEvent,
  type CreateEventInput,
  type EventWithTiers,
  type NewEvent,
  type OrganizerListResult,
  type PublicCitiesResult,
  type PublicEventDetail,
  type PublicSearchFilters,
  type PublicSearchResult,
  type TierInput,
  type UpdateEventInput,
} from "./types";

function prepareTiers(tiers: TierInput[]): TierInput[] {
  const seen = new Set<string>();

  return tiers.map((tier) => {
    const name = tier.name.trim();
    const key = name.toLowerCase();

    if (!name) {
      throw badRequest("VALIDATION_ERROR", "Setor sem nome.");
    }
    if (seen.has(key)) {
      throw conflict("DUPLICATE_TIER_NAME", `Setor repetido: ${name}.`);
    }
    seen.add(key);

    if (!Number.isInteger(tier.priceCents) || tier.priceCents < 0) {
      throw badRequest(
        "VALIDATION_ERROR",
        `Preço do setor ${name} deve ser inteiro de centavos, não negativo.`,
      );
    }
    if (!Number.isInteger(tier.capacity) || tier.capacity <= 0) {
      throw badRequest(
        "VALIDATION_ERROR",
        `Capacidade do setor ${name} deve ser inteiro positivo.`,
      );
    }

    return { name, priceCents: tier.priceCents, capacity: tier.capacity };
  });
}

const REQUIRED = ["title", "category", "startsAt", "venueName", "city"] as const;

const trim = (value: string | undefined) => value?.trim();

function resolve(
  organizerId: string,
  input: CreateEventInput,
  item: CatalogItem | null,
): NewEvent {
  const resolved = {
    organizerId,
    title: trim(input.title) ?? item?.title,
    description:
      input.description !== undefined
        ? input.description
        : (item?.description ?? null),
    category: trim(input.category) ?? item?.category,
    imageUrl:
      input.imageUrl !== undefined ? input.imageUrl : (item?.imageUrl ?? null),
    startsAt: trim(input.startsAt) ?? item?.startsAt,
    timezone: trim(input.timezone) ?? item?.timezone ?? "America/Sao_Paulo",
    venueName: trim(input.venueName) ?? item?.venueName,
    address:
      input.address !== undefined ? input.address : (item?.address ?? null),
    city: trim(input.city) ?? item?.city,
    state: input.state !== undefined ? input.state : (item?.state ?? null),
    country: trim(input.country) ?? item?.country ?? "BR",
    externalSource: item?.source ?? null,
    externalId: item?.externalId ?? null,
    externalSnapshot: item,
  };

  const missing = REQUIRED.filter((key) => !resolved[key]);
  if (missing.length) {
    throw badRequest(
      "VALIDATION_ERROR",
      "Evento sem campos obrigatórios. Informe no corpo ou importe do catálogo.",
      { missing },
    );
  }

  if (Number.isNaN(Date.parse(resolved.startsAt as string))) {
    throw badRequest("VALIDATION_ERROR", "Data de início inválida.");
  }

  return resolved as NewEvent;
}

export async function create(
  organizerId: string,
  input: CreateEventInput,
): Promise<EventWithTiers> {
  const tiers = prepareTiers(input.tiers ?? []);

  const item = input.externalId ? await catalog.getById(input.externalId) : null;
  if (input.externalId && !item) {
    throw notFound("Item do catálogo não encontrado.");
  }

  const fields = resolve(organizerId, input, item);

  return withTransaction(async (client) => {
    const event = await repository.insertEvent(fields, client);
    return {
      ...event,
      tiers: await repository.insertTiers(event.id, tiers, client),
    };
  });
}

export async function getOwned(
  id: string,
  organizerId: string,
): Promise<EventWithTiers> {
  const event = await repository.findOwned(id, organizerId);
  if (!event) {
    throw notFound("Evento não encontrado.");
  }
  return { ...event, tiers: await repository.findTiers(id) };
}

export async function listOwned(
  organizerId: string,
  page: number,
): Promise<OrganizerListResult> {
  const { items, total } = await repository.findByOrganizer(organizerId, page);

  const tiersByEvent = await repository.findTiersOf(items.map(({ id }) => id));

  return {
    items: items.map((event) => ({
      ...event,
      tiers: tiersByEvent.get(event.id) ?? [],
    })),
    page,
    pageSize: repository.ORGANIZER_PAGE_SIZE,
    total,
  };
}

export async function searchPublished(
  filters: PublicSearchFilters,
): Promise<PublicSearchResult> {
  const { items, total } = await repository.searchPublished(filters);

  return {
    items: items.map(({ priceFromCents, ...event }) => ({
      ...toPublicEvent(event),
      priceFromCents,
    })),
    page: filters.page,
    pageSize: repository.PUBLIC_PAGE_SIZE,
    total,
  };
}

export async function listPublishedCities(): Promise<PublicCitiesResult> {
  return { cities: await repository.findPublishedCities() };
}

export async function getPublished(id: string): Promise<PublicEventDetail> {
  const event = await repository.findPublished(id);
  if (!event) {
    throw notFound("Evento não encontrado.");
  }
  return { ...toPublicEvent(event), tiers: await repository.findTiers(id) };
}

export async function update(
  id: string,
  organizerId: string,
  input: UpdateEventInput,
): Promise<EventWithTiers> {
  const { tiers: tierInput, ...fields } = input;
  const tiers = tierInput ? prepareTiers(tierInput) : null;

  return withTransaction(async (client) => {
    const event = await repository.findOwnedForUpdate(id, organizerId, client);
    if (!event) {
      throw notFound("Evento não encontrado.");
    }
    if (event.status !== "DRAFT") {
      throw conflict("EVENT_NOT_DRAFT", "Apenas rascunho pode ser editado.");
    }

    const updated = await repository.updateOwnedDraft(
      id,
      organizerId,
      fields,
      client,
    );
    if (!updated) {
      throw new Error(`Evento ${id} mudou de estado sob bloqueio.`);
    }

    return {
      ...updated,
      tiers: tiers
        ? await repository.replaceTiers(id, tiers, client)
        : await repository.findTiers(id, client),
    };
  });
}

export async function publish(
  id: string,
  organizerId: string,
): Promise<EventWithTiers> {
  return withTransaction(async (client) => {
    const event = await repository.findOwnedForUpdate(id, organizerId, client);
    if (!event) {
      throw notFound("Evento não encontrado.");
    }

    const tiers = await repository.findTiers(id, client);

    if (!tiers.length) {
      throw conflict(
        "EVENT_WITHOUT_TIERS",
        "Evento sem setor não pode ser publicado.",
      );
    }
    if (Date.parse(event.startsAt) <= Date.now()) {
      throw conflict(
        "EVENT_STARTS_IN_THE_PAST",
        "Evento com data no passado não pode ser publicado.",
      );
    }

    const published = await repository.transition(
      id,
      organizerId,
      ["DRAFT"],
      "PUBLISHED",
      client,
    );
    if (!published) {
      throw conflict("EVENT_NOT_DRAFT", "Apenas rascunho pode ser publicado.");
    }

    return { ...published, tiers };
  });
}

export async function cancel(
  id: string,
  organizerId: string,
): Promise<EventWithTiers> {
  return withTransaction(async (client) => {
    const event = await repository.findOwnedForUpdate(id, organizerId, client);
    if (!event) {
      throw notFound("Evento não encontrado.");
    }

    const cancelled = await repository.transition(
      id,
      organizerId,
      ["DRAFT", "PUBLISHED"],
      "CANCELLED",
      client,
    );
    if (!cancelled) {
      throw conflict("EVENT_ALREADY_CANCELLED", "Evento já está cancelado.");
    }

    return { ...cancelled, tiers: await repository.findTiers(id, client) };
  });
}
