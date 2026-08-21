import { readAuthed, type ReadResult } from "./api";
import type { GateEvent, ValidationAttempt } from "./gate";

export const loadGateEvents = (): Promise<
  ReadResult<{ events: GateEvent[] }>
> => readAuthed<{ events: GateEvent[] }>("/gate/events");

export const loadGateLog = (
  eventId: string,
): Promise<ReadResult<{ attempts: ValidationAttempt[] }>> =>
  readAuthed<{ attempts: ValidationAttempt[] }>(
    "/gate/log",
    new URLSearchParams({ eventId }),
  );
