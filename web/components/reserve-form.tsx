"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AvailabilityBar } from "@/components/availability-bar";
import {
  checkoutHref,
  chosenTiers,
  newIdempotencyKey,
  orderIdOf,
  quantitiesFor,
  seatsOf,
  totalOf,
  type ChosenQuantities,
} from "@/lib/checkout";
import { codeOf, messageFor } from "@/lib/errors";
import type { Tier } from "@/lib/events";
import { availabilityLabel, formatBrl } from "@/lib/format";

export function ReserveForm({
  eventId,
  tiers,
}: {
  eventId: string;
  tiers: Tier[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<ChosenQuantities>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const attemptKey = useRef<string | null>(null);

  const seats = seatsOf(chosen);
  const total = totalOf(tiers, chosen);

  const choose = (tierId: string, quantity: number) => {
    attemptKey.current = null;
    setProblem(null);
    setChosen((current) => ({ ...current, [tierId]: quantity }));
  };

  const reserve = async () => {
    if (reserving || seats === 0) return;

    setReserving(true);
    setProblem(null);
    attemptKey.current ??= newIdempotencyKey();

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: chosenTiers(chosen),
          idempotencyKey: attemptKey.current,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setProblem(messageFor(codeOf(payload)));
        setReserving(false);
        router.refresh();
        return;
      }

      const orderId = orderIdOf(payload);
      if (!orderId) {
        setProblem(messageFor(null));
        setReserving(false);
        return;
      }

      attemptKey.current = null;
      router.push(checkoutHref(orderId));
    } catch {
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
      setReserving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {tiers.map((tier) => {
          const soldOut = tier.available === 0;

          return (
            <li
              key={tier.id}
              className={`card flex flex-col gap-2 ${soldOut ? "opacity-60" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium break-words">{tier.name}</p>
                <p className="text-lg font-bold whitespace-nowrap text-gold">
                  {formatBrl(tier.priceCents)}
                </p>
              </div>

              <AvailabilityBar
                available={tier.available}
                capacity={tier.capacity}
              />

              <p className="text-sm text-muted">
                {availabilityLabel(tier.available, tier.capacity)}
              </p>

              {soldOut ? null : (
                <label className="flex min-h-11 items-center justify-between gap-3">
                  <span className="label">Quantidade</span>
                  <select
                    value={chosen[tier.id] ?? 0}
                    disabled={reserving}
                    onChange={(event) =>
                      choose(tier.id, Number(event.target.value))
                    }
                    className="field w-auto"
                  >
                    {quantitiesFor(tier.available).map((quantity) => (
                      <option key={quantity} value={quantity}>
                        {quantity}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <div className="card flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted">
            {seats === 0
              ? "Nenhum ingresso selecionado"
              : `${seats} ${seats === 1 ? "ingresso" : "ingressos"}`}
          </p>
          <p className="text-xl font-bold whitespace-nowrap text-gold">
            {formatBrl(total)}
          </p>
        </div>

        <button
          type="button"
          disabled={reserving || seats === 0}
          onClick={reserve}
          className="btn-primary"
        >
          {reserving ? "Reservando…" : "Reservar"}
        </button>

        <p className="text-sm text-faint">
          A reserva segura os ingressos por dez minutos para você pagar.
        </p>

        {problem ? (
          <p role="alert" className="alert">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}
