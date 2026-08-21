import Link from "next/link";
import { notFound } from "next/navigation";
import { ReserveForm } from "@/components/reserve-form";
import { RetryButton } from "@/components/retry-button";
import { read } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import type { PublicEventDetail, Tier } from "@/lib/events";
import {
  availabilityLabel,
  formatBrl,
  formatEventDateTimeLong,
} from "@/lib/format";
import type { Role } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function EventPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const [result, session] = await Promise.all([
    read<PublicEventDetail>(`/events/${encodeURIComponent(id)}`),
    getSession(),
  ]);

  if (!result.ok) {
    if (result.status === 404) notFound();

    return (
      <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Evento indisponível</h1>
        <p>{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const event = result.data;
  const place = event.state ? `${event.city}, ${event.state}` : event.city;

  return (
    <main className="flex min-h-full flex-col gap-6 px-4 py-6">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm underline">
        Voltar ao catálogo
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold break-words">{event.title}</h1>
        <p>{formatEventDateTimeLong(event.startsAt, event.timezone)}</p>
        <p className="break-words">{`${event.venueName} · ${place}`}</p>
        {event.address ? (
          <p className="text-sm break-words">{event.address}</p>
        ) : null}
        <p className="text-sm opacity-70">{event.category}</p>
      </header>

      {event.description ? (
        <p className="break-words whitespace-pre-line">{event.description}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Setores</h2>

        {event.tiers.length === 0 ? (
          <p>Este evento ainda não tem setores à venda.</p>
        ) : session?.role === "CUSTOMER" ? (
          <ReserveForm eventId={event.id} tiers={event.tiers} />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {event.tiers.map((tier) => (
                <li key={tier.id}>
                  <TierRow tier={tier} />
                </li>
              ))}
            </ul>
            <WhoCanBuy role={session?.role ?? null} />
          </>
        )}
      </section>
    </main>
  );
}

function WhoCanBuy({ role }: Readonly<{ role: Role | null }>) {
  if (role) {
    return (
      <p className="rounded border p-4 text-sm">
        A compra é feita com conta de cliente. Você está em uma conta de{" "}
        {role === "ORGANIZER" ? "organizador" : "portaria"}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border p-4">
      <p>Entre com sua conta de cliente para escolher a quantidade e reservar.</p>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center rounded border px-4 text-base"
      >
        Entrar para comprar
      </Link>
    </div>
  );
}

function TierRow({ tier }: Readonly<{ tier: Tier }>) {
  const soldOut = tier.available === 0;

  return (
    <div
      className={`flex flex-col gap-1 rounded border p-4 ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium break-words">{tier.name}</p>
        <p className="whitespace-nowrap">{formatBrl(tier.priceCents)}</p>
      </div>
      <p className="text-sm">
        {availabilityLabel(tier.available, tier.capacity)}
      </p>
    </div>
  );
}
