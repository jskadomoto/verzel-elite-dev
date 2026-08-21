import type { PoolClient } from "pg";
import { withTransaction } from "../db/transaction";
import * as events from "../events/repository";
import { AppError, conflict, notFound } from "../http/errors";
import * as orders from "../orders/repository";
import type { LockedOrder, OrderRecord } from "../orders/types";
import * as tickets from "../tickets/repository";
import type { NewTicket } from "../tickets/types";
import * as repository from "./repository";
import type {
  Authorization,
  DeclineReason,
  PaymentResult,
  PayOrderInput,
} from "./types";

export const DECLINING_CARDS = new Map<string, DeclineReason>([
  ["4000000000000002", "CARD_DECLINED"],
  ["4000000000009995", "INSUFFICIENT_FUNDS"],
  ["4000000000000069", "EXPIRED_CARD"],
  ["4000000000000127", "LOST_CARD"],
]);

const DECLINE_MESSAGE: Record<DeclineReason, string> = {
  INVALID_NUMBER: "Número de cartão inválido.",
  CARD_DECLINED: "Cartão recusado pelo emissor.",
  INSUFFICIENT_FUNDS: "Saldo insuficiente.",
  EXPIRED_CARD: "Cartão vencido.",
  LOST_CARD: "Cartão bloqueado por perda ou roubo.",
};

const digitsOf = (value: string) => value.replace(/\D/g, "");

function passesCheckDigit(digits: string): boolean {
  let sum = 0;
  let doubling = false;

  for (let position = digits.length - 1; position >= 0; position--) {
    let value = Number(digits[position]);
    if (doubling) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubling = !doubling;
  }

  return digits.length > 0 && sum % 10 === 0;
}

export function authorize(cardNumber: string): Authorization {
  const digits = digitsOf(cardNumber);

  if (!passesCheckDigit(digits)) {
    return { status: "DECLINED", declineReason: "INVALID_NUMBER" };
  }

  const known = DECLINING_CARDS.get(digits);
  return known
    ? { status: "DECLINED", declineReason: known }
    : { status: "APPROVED", declineReason: null };
}

const declined = (reason: DeclineReason) =>
  new AppError("PAYMENT_DECLINED", DECLINE_MESSAGE[reason], 402, { reason });

const seatLabel = (seatNumber: number) => String(seatNumber).padStart(4, "0");

const byTierId = <T extends { tierId: string }>(items: T[]) =>
  [...items].sort((left, right) => left.tierId.localeCompare(right.tierId));

const isPayable = ({ order, holdExpired }: LockedOrder) =>
  order.status === "PENDING" && !holdExpired;

function refusalFor({ order }: LockedOrder): AppError {
  if (order.status === "PAID" || order.status === "CANCELLED") {
    return conflict(
      "ORDER_NOT_PENDING",
      "Este pedido não está aguardando pagamento.",
      { status: order.status },
    );
  }

  return conflict(
    "HOLD_EXPIRED",
    "A reserva expirou e o estoque voltou para a venda.",
  );
}

async function recordedAttempt(
  order: OrderRecord,
  customerId: string,
  idempotencyKey: string,
  db: PoolClient,
): Promise<PaymentResult | null> {
  const previous = await repository.findByKey(
    customerId,
    order.id,
    idempotencyKey,
    db,
  );
  if (!previous) return null;

  return {
    payment: previous,
    order,
    tickets: await tickets.findByOrder(order.id, db),
    created: false,
  };
}

async function issueTickets(
  order: OrderRecord,
  customerId: string,
  db: PoolClient,
): Promise<NewTicket[]> {
  const items = byTierId(await orders.findItems(order.id, db));
  const issued: NewTicket[] = [];

  for (const item of items) {
    const lastSeat = await events.takeSeatNumbers(item.tierId, item.quantity, db);
    for (let seat = lastSeat - item.quantity + 1; seat <= lastSeat; seat++) {
      issued.push({
        orderId: order.id,
        eventId: order.eventId,
        tierId: item.tierId,
        holderUserId: customerId,
        seatLabel: seatLabel(seat),
      });
    }
  }

  return issued;
}

export async function pay(
  customerId: string,
  orderId: string,
  input: PayOrderInput,
): Promise<PaymentResult> {
  const result = await withTransaction(async (client) => {
    const locked = await orders.findOwnedForUpdate(orderId, customerId, client);
    if (!locked) throw notFound("Pedido não encontrado.");

    if (!isPayable(locked)) {
      const recorded = await recordedAttempt(
        locked.order,
        customerId,
        input.idempotencyKey,
        client,
      );
      if (recorded) return recorded;
      throw refusalFor(locked);
    }

    const authorization = authorize(input.card.number);
    const attempt = await repository.insertAttempt(
      {
        orderId,
        customerId,
        idempotencyKey: input.idempotencyKey,
        status: authorization.status,
        cardLast4: digitsOf(input.card.number).slice(-4),
        declineReason: authorization.declineReason,
      },
      client,
    );

    if (!attempt) {
      const recorded = await recordedAttempt(
        locked.order,
        customerId,
        input.idempotencyKey,
        client,
      );
      if (!recorded) {
        throw new Error(
          `Chave de idempotência em conflito sem pagamento correspondente: ${input.idempotencyKey}`,
        );
      }
      return recorded;
    }

    if (attempt.status === "DECLINED") {
      return {
        payment: attempt,
        order: locked.order,
        tickets: [],
        created: true,
      };
    }

    const issued = await issueTickets(locked.order, customerId, client);

    return {
      payment: attempt,
      order: await orders.markPaid(orderId, client),
      tickets: await tickets.insertMany(issued, client),
      created: true,
    };
  });

  if (result.payment.declineReason) {
    throw declined(result.payment.declineReason);
  }

  return result;
}
