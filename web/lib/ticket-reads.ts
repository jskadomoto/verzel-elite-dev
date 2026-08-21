import { readAuthed, type ReadResult } from "./api";
import type { TicketDetail, TicketSummary } from "./tickets";

export const loadTickets = (): Promise<
  ReadResult<{ tickets: TicketSummary[] }>
> => readAuthed<{ tickets: TicketSummary[] }>("/me/tickets");

export const loadTicket = (
  ticketId: string,
): Promise<ReadResult<TicketDetail>> =>
  readAuthed<TicketDetail>(`/tickets/${encodeURIComponent(ticketId)}`);
