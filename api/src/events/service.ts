import type { PoolClient } from "pg";
import * as catalog from "../catalog/service";
import type { CatalogItem } from "../catalog/types";
import { pool } from "../db/pool";
import { badRequest, conflict, notFound } from "../http/errors";
import * as repository from "./repository";
import type {
  CreateEventInput,
  EventWithTiers,
  NewEvent,
  TierInput,
  UpdateEventInput,
} from "./types";

// A linha do evento é o ponto de serialização das operações do organizador.
// Criação à parte, porque a linha ainda não existe, todo caminho que escreve em
// `events` ou nos `ticket_tiers` de um evento trava essa linha com `for update`
// antes de decidir qualquer coisa. É o que impede que duas operações
// simultâneas decidam sobre leituras diferentes do mesmo evento.

// Helper local por enquanto. Quando orders e payments precisarem do mesmo,
// sobe para src/db e passa a ser infraestrutura compartilhada.
async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// Valida e devolve os setores já normalizados. O nome vai aparado porque o
// único do banco é sensível a espaço e a caixa, e " Pista" e "Pista" passariam
// os dois enquanto para quem compra são o mesmo setor.
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

// Texto obrigatório vem aparado antes da checagem: sem isso um título só com
// espaços passa pelo filtro de obrigatórios e o evento nasce em branco.
// Aparar antes do `??` também garante que espaço em branco não seja tratado
// como ausência e caia no valor importado, porque `??` só cede a nulo.
const trim = (value: string | undefined) => value?.trim();

// O item importado só preenche o que o organizador deixou de fora. Definir
// data, local, capacidade e preço é atribuição dele, então o que ele mandou
// prevalece sobre o que veio da fonte externa.
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
    // O item inteiro, não só o campo `raw`: o snapshot registra o que foi
    // importado, e depois dele o evento não depende mais da fonte.
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

  // O snapshot é buscado aqui, no servidor, e nunca aceito pronto do cliente:
  // receber o item permitiria ao organizador reescrever a origem da importação.
  // Fica fora da transação de propósito, porque getById pode ir à rede e
  // segurar conexão do pool esperando API alheia é como se esgota o pool.
  const item = input.externalId ? await catalog.getById(input.externalId) : null;
  if (input.externalId && !item) {
    throw notFound("Item do catálogo não encontrado.");
  }

  const fields = resolve(organizerId, input, item);

  // Evento e setores nascem na mesma transação: evento sem setor seria estado
  // intermediário visível.
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
  // 404 e não 403 quando o evento é de outro organizador: 403 confirmaria que
  // o id existe, e a existência de evento alheio não é informação dele.
  if (!event) {
    throw notFound("Evento não encontrado.");
  }
  return { ...event, tiers: await repository.findTiers(id) };
}

export async function update(
  id: string,
  organizerId: string,
  input: UpdateEventInput,
): Promise<EventWithTiers> {
  const { tiers: tierInput, ...fields } = input;
  const tiers = tierInput ? prepareTiers(tierInput) : null;

  return withTransaction(async (client) => {
    // O bloqueio vem antes de qualquer escrita, e não só para editar campo:
    // um PATCH que envie apenas setores não tocaria em `events` e correria em
    // paralelo com uma publicação, que decidiria sobre setores já apagados.
    // A leitura travada também é o que separa 404 de 409 aqui.
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

    // Enviar `tiers` troca o id de todos os setores, porque a substituição
    // apaga e reinsere. Em rascunho ninguém referencia esses ids, mas a tela do
    // organizador não pode guardá-los entre uma edição e outra.
    return {
      ...updated,
      tiers: tiers
        ? await repository.replaceTiers(id, tiers, client)
        : await repository.findTiers(id, client),
    };
  });
}

// Publica com a linha do evento travada até o fim da transação. O estado de
// origem no where protege a transição, mas não protege as precondições de
// negócio: sem o bloqueio, um PATCH concorrente removeria os setores ou jogaria
// a data para o passado entre a validação e a escrita, e o evento seria
// publicado violando as duas.
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
    // A posse já foi conferida acima, então linha não afetada aqui só pode ser
    // estado: o evento não está em rascunho.
    if (!published) {
      throw conflict("EVENT_NOT_DRAFT", "Apenas rascunho pode ser publicado.");
    }

    return { ...published, tiers };
  });
}

// Cancelamento não tem precondição de negócio além do próprio estado, que o
// where já garante. Trava a linha mesmo assim para entrar na mesma fila de
// publish e update: sem isso, um cancelamento e uma publicação simultâneos
// decidiriam sobre leituras diferentes do mesmo evento.
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
