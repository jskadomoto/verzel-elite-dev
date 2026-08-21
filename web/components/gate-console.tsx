"use client";

import { useCallback, useRef, useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";
import { formatClockTime, formatEventDateTime } from "@/lib/format";
import {
  isWorkable,
  MAX_CODE_LENGTH,
  VERDICT,
  type GateEvent,
  type ValidationAttempt,
  type ValidationResult,
} from "@/lib/gate";
import { GateScanner } from "./gate-scanner";

const COOLDOWN_MS = 3000;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 text-base";

const fieldClass =
  "min-h-11 rounded border bg-neutral-900 px-3 font-mono text-base text-neutral-50";

export function GateConsole({
  events,
  startOn,
  startLog,
}: Readonly<{
  events: GateEvent[];
  startOn: string;
  startLog: ValidationAttempt[];
}>) {
  const [eventId, setEventId] = useState(startOn);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<ValidationResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [log, setLog] = useState<ValidationAttempt[]>(startLog);
  const lastCode = useRef<{ code: string; at: number } | null>(null);
  const busyRef = useRef(false);

  const selected = events.find((event) => event.id === eventId) ?? null;
  const workable = selected !== null && isWorkable(selected);

  const refreshLog = useCallback(async (id: string) => {
    try {
      const response = await fetch(
        `/api/gate/log?eventId=${encodeURIComponent(id)}`,
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        attempts: ValidationAttempt[];
      };
      setLog(payload.attempts);
    } catch {
      return;
    }
  }, []);

  function chooseEvent(chosen: string) {
    lastCode.current = null;
    setLog([]);
    setVerdict(null);
    setProblem(null);
    setEventId(chosen);
    if (chosen) refreshLog(chosen);
  }

  const validate = useCallback(
    async (code: string, source: "camera" | "manual") => {
      const trimmed = code.trim();
      if (!eventId || !trimmed || busyRef.current) return;

      const last = lastCode.current;
      if (
        source === "camera" &&
        last?.code === trimmed &&
        Date.now() - last.at < COOLDOWN_MS
      ) {
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setProblem(null);
      lastCode.current = { code: trimmed, at: Date.now() };

      try {
        const response = await fetch("/api/gate/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, code: trimmed }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          setProblem(messageFor(codeOf(payload)));
          return;
        }

        setVerdict(payload as ValidationResult);
        setTyped("");
        refreshLog(eventId);
      } catch {
        setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eventId, refreshLog],
  );

  const onCode = useCallback(
    (code: string) => {
      validate(code, "camera");
    },
    [validate],
  );

  function next() {
    lastCode.current = null;
    setVerdict(null);
    setProblem(null);
  }

  if (!events.length) {
    return (
      <section className="mt-4 flex flex-col gap-2">
        <p>Nenhum evento atribuído à sua portaria.</p>
        <p className="text-sm text-neutral-400">
          O organizador do evento precisa atribuir esta conta antes da entrada.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <label htmlFor="gate-event" className="text-sm text-neutral-400">
          Evento em que você está trabalhando
        </label>
        <select
          id="gate-event"
          value={eventId}
          onChange={(event) => chooseEvent(event.target.value)}
          className={`${fieldClass} font-sans`}
        >
          <option value="">Selecione o evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} ·{" "}
              {formatEventDateTime(event.startsAt, event.timezone)}
            </option>
          ))}
        </select>

        {selected ? (
          <p className="text-sm text-neutral-400">
            {selected.venueName}, {selected.city}
          </p>
        ) : null}

        {selected && !workable ? (
          <p role="alert" className="rounded border p-3 text-sm font-medium">
            Este evento está{" "}
            {selected.status === "CANCELLED" ? "cancelado" : "em rascunho"} e não
            recebe leitura. Selecione outro evento.
          </p>
        ) : null}
      </section>

      {verdict ? (
        <section
          role="status"
          aria-live="assertive"
          className={`flex flex-col gap-3 rounded p-4 ${VERDICT[verdict.verdict].panel}`}
        >
          <p className="text-3xl font-bold">
            {VERDICT[verdict.verdict].headline}
          </p>
          <p className="text-base">{VERDICT[verdict.verdict].detail}</p>

          {verdict.ticket ? (
            <p className="text-lg break-words">
              {verdict.ticket.tier.name}
              <span className="font-mono"> {verdict.ticket.seatLabel}</span>
            </p>
          ) : null}

          {verdict.verdict === "ALREADY_USED" && verdict.usedAt ? (
            <p className="text-sm">
              Primeira leitura às{" "}
              {formatClockTime(verdict.usedAt, selected?.timezone ?? "UTC")}
              {verdict.usedBy ? `, por ${verdict.usedBy.name}` : ""}.
            </p>
          ) : null}

          <button
            type="button"
            onClick={next}
            className="inline-flex min-h-11 items-center justify-center rounded border border-current px-4 text-base font-semibold"
          >
            Próxima leitura
          </button>
        </section>
      ) : null}

      {workable ? (
        <GateScanner paused={busy || verdict !== null} onCode={onCode} />
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          validate(typed, "manual");
        }}
      >
        <label htmlFor="gate-code" className="text-sm text-neutral-400">
          Código do ingresso, digitado ou colado
        </label>
        <input
          id="gate-code"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={MAX_CODE_LENGTH}
          placeholder="v1.…"
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={busy || !workable || !typed.trim()}
          className={`${buttonClass} disabled:opacity-60`}
        >
          {busy ? "Validando…" : "Validar código"}
        </button>
      </form>

      {problem ? (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-neutral-400">Últimas leituras</h2>

        {log.length ? (
          <ul className="flex flex-col gap-1">
            {log.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded border px-3 py-2 text-sm"
              >
                <span className="font-mono whitespace-nowrap">
                  {formatClockTime(attempt.at, selected?.timezone ?? "UTC")}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${VERDICT[attempt.result].badge}`}
                >
                  {VERDICT[attempt.result].headline}
                </span>
                <span className="w-full truncate font-mono text-xs text-neutral-400">
                  {attempt.codePrefix ?? "leitura ilegível"} · {attempt.by.name}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">
            Nenhuma leitura neste evento ainda.
          </p>
        )}
      </section>
    </div>
  );
}
