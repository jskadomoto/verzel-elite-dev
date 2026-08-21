"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  confirmationHref,
  formatRemaining,
  newIdempotencyKey,
  remainingMsOf,
  settledStatusOf,
  TEST_CARDS,
  type CheckoutBlock,
} from "@/lib/checkout";
import { codeOf, declineMessageFor, messageFor } from "@/lib/errors";
import { CheckoutBlocked } from "./checkout-blocked";

const EMPTY_CARD = { number: "", holder: "", expiry: "", cvc: "" };

type CardField = keyof typeof EMPTY_CARD;

function blockedBy(code: string | undefined, payload: unknown): CheckoutBlock {
  if (code === "HOLD_EXPIRED") return "EXPIRED";

  const settled = settledStatusOf(payload);
  if (settled === "PAID" || settled === "CANCELLED" || settled === "EXPIRED") {
    return settled;
  }
  return "SETTLED";
}

export function CheckoutPayment({
  orderId,
  eventId,
  holdExpiresAt,
  children,
}: Readonly<{
  orderId: string;
  eventId: string;
  holdExpiresAt: string;
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [card, setCard] = useState(EMPTY_CARD);
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<CheckoutBlock | null>(null);
  const attemptKey = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = remainingMsOf(holdExpiresAt, now);
  const state = blocked ?? (remaining === 0 ? "EXPIRED" : null);
  const incomplete = Object.values(card).some((value) => !value.trim());

  const change = (field: CardField, value: string) => {
    setProblem(null);
    setCard((current) => ({ ...current, [field]: value }));
  };

  const fillWith = (number: string) => {
    setProblem(null);
    setCard((current) => ({
      number,
      holder: current.holder || "CLIENTE DEMO",
      expiry: current.expiry || "12/30",
      cvc: current.cvc || "123",
    }));
  };

  const pay = async (submit: React.FormEvent<HTMLFormElement>) => {
    submit.preventDefault();
    if (paying || state || incomplete) return;

    setPaying(true);
    setProblem(null);
    attemptKey.current ??= newIdempotencyKey();

    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ card, idempotencyKey: attemptKey.current }),
      });
      const payload = await response.json().catch(() => null);

      if (response.status >= 500) {
        setProblem(messageFor(codeOf(payload)));
        setPaying(false);
        return;
      }

      attemptKey.current = null;

      if (!response.ok) {
        const code = codeOf(payload);

        if (code === "HOLD_EXPIRED" || code === "ORDER_NOT_PENDING") {
          setBlocked(blockedBy(code, payload));
          setPaying(false);
          router.refresh();
          return;
        }

        setProblem(
          code === "PAYMENT_DECLINED"
            ? declineMessageFor(payload)
            : messageFor(code),
        );
        setPaying(false);
        return;
      }

      router.push(confirmationHref(orderId));
    } catch {
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
      setPaying(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {state ? (
        <CheckoutBlocked block={state} orderId={orderId} eventId={eventId} />
      ) : (
        <div className="card flex items-baseline justify-between gap-3 border-gold/40 bg-gold/10">
          <span className="text-muted">Reserva válida por</span>
          <span
            suppressHydrationWarning
            className="font-mono text-2xl font-bold tabular-nums text-gold"
          >
            {formatRemaining(remaining)}
          </span>
        </div>
      )}

      {children}

      {state ? null : (
        <>
          <section className="card flex flex-col gap-2">
            <h2 className="font-medium">Cartões de teste</h2>
            <p className="text-sm text-muted">
              Toque em um deles para preencher o formulário.
            </p>
            <ul className="flex flex-col gap-2">
              {TEST_CARDS.map((testCard) => (
                <li key={testCard.number}>
                  <button
                    type="button"
                    disabled={paying}
                    onClick={() => fillWith(testCard.number)}
                    className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-line bg-surface-raised px-3 py-2 text-left text-sm hover:border-brand disabled:opacity-55"
                  >
                    <span className="font-mono">{testCard.number}</span>
                    <span className="text-muted">{testCard.outcome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={pay} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1" htmlFor="card-number">
              <span className="label">Número do cartão</span>
              <input
                id="card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={25}
                value={card.number}
                disabled={paying}
                onChange={(event) => change("number", event.target.value)}
                className="field"
              />
            </label>

            <label className="flex flex-col gap-1" htmlFor="card-holder">
              <span className="label">Nome impresso no cartão</span>
              <input
                id="card-holder"
                autoComplete="cc-name"
                maxLength={80}
                value={card.holder}
                disabled={paying}
                onChange={(event) => change("holder", event.target.value)}
                className="field"
              />
            </label>

            <div className="flex gap-3">
              <label
                className="flex flex-1 flex-col gap-1"
                htmlFor="card-expiry"
              >
                <span className="label">Validade</span>
                <input
                  id="card-expiry"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  maxLength={5}
                  value={card.expiry}
                  disabled={paying}
                  onChange={(event) => change("expiry", event.target.value)}
                  className="field"
                />
              </label>

              <label className="flex flex-1 flex-col gap-1" htmlFor="card-cvc">
                <span className="label">Código</span>
                <input
                  id="card-cvc"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  value={card.cvc}
                  disabled={paying}
                  onChange={(event) => change("cvc", event.target.value)}
                  className="field"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={paying || incomplete}
              className="btn-primary"
            >
              {paying ? "Pagando…" : "Pagar"}
            </button>
          </form>
        </>
      )}

      {problem ? (
        <p role="alert" className="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
