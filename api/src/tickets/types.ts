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
  createdAt: string;
};
