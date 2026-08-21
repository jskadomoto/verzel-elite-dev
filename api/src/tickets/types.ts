import type { EventStatus } from "../events/types";

export type TicketStatus = "VALID" | "USED" | "CANCELLED";

export type NewTicket = {
  orderId: string;
  eventId: string;
  tierId: string;
  holderUserId: string;
  seatLabel: string;
};

export type TicketRecord = {
  id: string;
  orderId: string;
  eventId: string;
  tierId: string;
  seatLabel: string;
  status: TicketStatus;
  usedAt: string | null;
  createdAt: string;
};

export type TicketEvent = {
  id: string;
  status: EventStatus;
  title: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  address: string | null;
  city: string;
  state: string | null;
  country: string;
};

export type TicketTier = {
  id: string;
  name: string;
};

export type TicketSummary = {
  id: string;
  orderId: string;
  seatLabel: string;
  status: TicketStatus;
  usedAt: string | null;
  createdAt: string;
  event: TicketEvent;
  tier: TicketTier;
};

export type ShareLink = {
  expiresAt: string;
  openedCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
};

export type IssuedShareLink = ShareLink & { token: string };

export type OpenedShare = ShareLink & { ticketId: string };

export type TicketDetail = TicketSummary & {
  code: string;
  share: ShareLink | null;
};

export type SharedTicket = {
  code: string;
  seatLabel: string;
  status: TicketStatus;
  usedAt: string | null;
  tier: TicketTier;
  event: TicketEvent;
};
