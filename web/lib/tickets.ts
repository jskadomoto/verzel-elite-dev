export type TicketStatus = "VALID" | "USED" | "CANCELLED";

export type TicketEvent = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
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

export const STATUS_LABEL: Record<TicketStatus, string> = {
  VALID: "Válido",
  USED: "Utilizado",
  CANCELLED: "Cancelado",
};

export const STATUS_CHIP: Record<TicketStatus, string> = {
  VALID: "border-success/40 bg-success/15 text-success",
  USED: "border-attention/40 bg-attention/15 text-attention",
  CANCELLED: "border-danger/50 bg-danger/15 text-danger",
};

export const ticketHref = (ticketId: string) =>
  `/minha-conta/ingressos/${encodeURIComponent(ticketId)}`;

export const sharePath = (token: string) =>
  `/ingresso/${encodeURIComponent(token)}`;

export type TicketGroup = {
  event: TicketEvent;
  tickets: TicketSummary[];
};

export function groupByEvent(tickets: TicketSummary[]): TicketGroup[] {
  const groups = new Map<string, TicketGroup>();

  for (const ticket of tickets) {
    const group = groups.get(ticket.event.id);
    if (group) {
      group.tickets.push(ticket);
    } else {
      groups.set(ticket.event.id, { event: ticket.event, tickets: [ticket] });
    }
  }

  return [...groups.values()]
    .map((group) => ({
      event: group.event,
      tickets: group.tickets.sort((one, other) =>
        one.seatLabel.localeCompare(other.seatLabel),
      ),
    }))
    .sort((one, other) =>
      one.event.startsAt.localeCompare(other.event.startsAt),
    );
}
