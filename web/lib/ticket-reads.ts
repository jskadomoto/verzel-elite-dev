import { read, readAuthed, type ReadResult } from "./api";
import type { SharedTicket, TicketDetail, TicketSummary } from "./tickets";

export const loadTickets = (): Promise<
  ReadResult<{ tickets: TicketSummary[] }>
> => readAuthed<{ tickets: TicketSummary[] }>("/me/tickets");

export const loadTicket = (
  ticketId: string,
): Promise<ReadResult<TicketDetail>> =>
  readAuthed<TicketDetail>(`/tickets/${encodeURIComponent(ticketId)}`);

export const loadSharedTicket = (
  token: string,
): Promise<ReadResult<SharedTicket>> =>
  read<SharedTicket>(`/share/${encodeURIComponent(token)}`);
