import type { OrderRecord } from "../orders/types";
import type { TicketRecord } from "../tickets/types";

export type PaymentStatus = "APPROVED" | "DECLINED";

export type DeclineReason =
  | "INVALID_NUMBER"
  | "CARD_DECLINED"
  | "INSUFFICIENT_FUNDS"
  | "EXPIRED_CARD"
  | "LOST_CARD";

export type CardInput = {
  number: string;
  holder: string;
  expiry: string;
  cvc: string;
};

export type PayOrderInput = {
  card: CardInput;
  idempotencyKey: string;
};

export type Authorization =
  | { status: "APPROVED"; declineReason: null }
  | { status: "DECLINED"; declineReason: DeclineReason };

export type NewPayment = {
  orderId: string;
  customerId: string;
  idempotencyKey: string;
  status: PaymentStatus;
  cardLast4: string;
  declineReason: DeclineReason | null;
};

export type PaymentRecord = {
  id: string;
  orderId: string;
  status: PaymentStatus;
  cardLast4: string | null;
  declineReason: DeclineReason | null;
  createdAt: string;
};

export type PaymentResult = {
  payment: PaymentRecord;
  order: OrderRecord;
  tickets: TicketRecord[];
  created: boolean;
};
