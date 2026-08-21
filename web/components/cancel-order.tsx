"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";

export function CancelOrder({ orderId }: Readonly<{ orderId: string }>) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function cancel() {
    setProblem(null);
    setRunning(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setProblem(messageFor(codeOf(payload)));
        return;
      }

      setConfirming(false);
      router.refresh();
    } catch {
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {confirming ? (
        <div className="card flex flex-col gap-2 border-danger/40">
          <p>
            Cancelar devolve os lugares para a venda e invalida os ingressos
            deste pedido. Não tem volta: para ir ao evento você precisará comprar
            de novo, se ainda houver lugar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={running}
              onClick={cancel}
              className="btn-danger"
            >
              {running ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => setConfirming(false)}
              className="btn-quiet"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={running}
          onClick={() => setConfirming(true)}
          className="btn-danger"
        >
          Cancelar pedido
        </button>
      )}

      {problem ? (
        <p role="alert" className="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
