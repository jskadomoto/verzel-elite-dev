import { withTransaction } from "../db/transaction";
import * as events from "../events/repository";
import { badRequest, conflict } from "../http/errors";
import * as repository from "./repository";
import type {
  CreatedOrder,
  CreateOrderInput,
  ExpirySweep,
  OrderItemInput,
  PricedItem,
} from "./types";

export const HOLD_MINUTES = 10;
export const SWEEP_LIMIT = 200;
export const SWEEP_INTERVAL_MS = 60_000;

export async function expireOverdue(): Promise<ExpirySweep> {
  return withTransaction((client) =>
    repository.expireOverdueOrders(SWEEP_LIMIT, client),
  );
}

async function attemptExpirySweep(): Promise<void> {
  try {
    await expireOverdue();
  } catch (err) {
    console.warn("Varredura de expiração falhou.", (err as Error).message);
  }
}

export function startExpirySweeper(): () => void {
  const timer = setInterval(attemptExpirySweep, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

function requireDistinctTiers(items: OrderItemInput[]) {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.tierId)) {
      throw badRequest(
        "VALIDATION_ERROR",
        "O mesmo setor aparece duas vezes no pedido.",
        { tierId: item.tierId },
      );
    }
    seen.add(item.tierId);
  }
}

const byTierId = (items: OrderItemInput[]) =>
  [...items].sort((left, right) => left.tierId.localeCompare(right.tierId));

const totalOf = (items: PricedItem[]) =>
  items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

export async function create(
  customerId: string,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  requireDistinctTiers(input.items);
  await attemptExpirySweep();

  return withTransaction(async (client) => {
    const repeated = await repository.findByKey(
      customerId,
      input.idempotencyKey,
      client,
    );
    if (repeated) {
      return {
        order: {
          ...repeated,
          items: await repository.findItems(repeated.id, client),
        },
        created: false,
      };
    }

    const event = await events.findPublishedForShare(input.eventId, client);
    if (!event) {
      throw conflict(
        "EVENT_NOT_PUBLISHED",
        "Este evento não está aberto para compra.",
      );
    }

    const tiers = await events.findTiers(input.eventId, client);
    const known = new Set(tiers.map((tier) => tier.id));
    const foreign = input.items.filter((item) => !known.has(item.tierId));
    if (foreign.length) {
      throw conflict(
        "TIER_NOT_IN_EVENT",
        "Setor informado não pertence a este evento.",
        { tierIds: foreign.map((item) => item.tierId) },
      );
    }

    const created = await repository.insertPending(
      {
        eventId: input.eventId,
        customerId,
        idempotencyKey: input.idempotencyKey,
        holdMinutes: HOLD_MINUTES,
      },
      client,
    );

    if (!created) {
      const committed = await repository.findByKey(
        customerId,
        input.idempotencyKey,
        client,
      );
      if (!committed) {
        throw new Error(
          `Chave de idempotência em conflito sem pedido correspondente: ${input.idempotencyKey}`,
        );
      }
      return {
        order: {
          ...committed,
          items: await repository.findItems(committed.id, client),
        },
        created: false,
      };
    }

    const priced: PricedItem[] = [];
    for (const item of byTierId(input.items)) {
      const unitPriceCents = await events.allocate(
        item.tierId,
        input.eventId,
        item.quantity,
        client,
      );

      if (unitPriceCents === null) {
        const tier = tiers.find((candidate) => candidate.id === item.tierId);
        throw conflict(
          "SOLD_OUT",
          `Não há ingressos suficientes no setor ${tier?.name ?? item.tierId}.`,
          {
            tierId: item.tierId,
            tierName: tier?.name ?? null,
            requested: item.quantity,
          },
        );
      }

      priced.push({ ...item, unitPriceCents });
    }

    const items = await repository.insertItems(created.id, priced, client);
    const order = await repository.updateTotal(
      created.id,
      totalOf(priced),
      client,
    );

    return { order: { ...order, items }, created: true };
  });
}
