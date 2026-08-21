"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";
import type { EventStatus } from "@/lib/organizer";

export function EventActions({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [running, setRunning] = useState(false);

  const run = async (action: "publish" | "cancel") => {
    setProblem(null);
    setRunning(true);

    try {
      const response = await fetch(
        `/api/organizer/events/${eventId}/${action}`,
        { method: "POST" },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setProblem(messageFor(codeOf(payload)));
        return;
      }

      setConfirmingCancel(false);
      router.refresh();
    } catch {
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
    } finally {
      setRunning(false);
    }
  };

  if (status === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {status === "DRAFT" ? (
          <button
            type="button"
            disabled={running}
            onClick={() => run("publish")}
            className="btn-primary"
          >
            Publicar evento
          </button>
        ) : null}

        {confirmingCancel ? null : (
          <button
            type="button"
            disabled={running}
            onClick={() => setConfirmingCancel(true)}
            className="btn-danger"
          >
            Cancelar evento
          </button>
        )}
      </div>

      {confirmingCancel ? (
        <div className="card flex flex-col gap-2 border-danger/40">
          <p>
            Cancelar tira o evento do catálogo público e não tem volta: um evento
            cancelado não pode ser editado nem publicado de novo.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={running}
              onClick={() => run("cancel")}
              className="btn-danger"
            >
              {running ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => setConfirmingCancel(false)}
              className="btn-quiet"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
