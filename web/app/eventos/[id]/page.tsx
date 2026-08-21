import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBar } from "@/components/availability-bar";
import { ReserveForm } from "@/components/reserve-form";
import { RetryButton } from "@/components/retry-button";
import { SiteHeader } from "@/components/site-header";
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
      <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-start gap-5 px-4 py-6">
        <h1 className="text-xl font-bold">Evento indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const event = result.data;
  const place = event.state ? `${event.city}, ${event.state}` : event.city;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader identity={session} surface="public" width="max-w-2xl" />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
        <Link href="/" className="back-link">
          ← Catálogo
        </Link>

        <header className="flex flex-col gap-3">
          <span className="chip self-start">{event.category}</span>
          <h1 className="text-2xl font-extrabold break-words">{event.title}</h1>
          <p className="font-medium text-gold">
            {formatEventDateTimeLong(event.startsAt, event.timezone)}
          </p>
          <p className="break-words">{`${event.venueName} · ${place}`}</p>
          {event.address ? (
            <p className="text-sm break-words text-muted">{event.address}</p>
          ) : null}
        </header>

        {event.description ? (
          <p className="break-words whitespace-pre-line text-muted">
            {event.description}
          </p>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Setores</h2>

          {event.tiers.length === 0 ? (
            <p className="notice">Este evento ainda não tem setores à venda.</p>
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
    </div>
  );
}

function WhoCanBuy({ role }: Readonly<{ role: Role | null }>) {
  if (role) {
    return (
      <p className="notice">
        A compra é feita com conta de cliente. Você está em uma conta de{" "}
        {role === "ORGANIZER" ? "organizador" : "portaria"}.
      </p>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <p>Entre com sua conta de cliente para escolher a quantidade e reservar.</p>
      <Link href="/login" className="btn-primary">
        Entrar para comprar
      </Link>
    </div>
  );
}

function TierRow({ tier }: Readonly<{ tier: Tier }>) {
  const soldOut = tier.available === 0;

  return (
    <div className={`card flex flex-col gap-2 ${soldOut ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium break-words">{tier.name}</p>
        <p className="text-lg font-bold whitespace-nowrap text-gold">
          {formatBrl(tier.priceCents)}
        </p>
      </div>
      <AvailabilityBar available={tier.available} capacity={tier.capacity} />
      <p className="text-sm text-muted">
        {availabilityLabel(tier.available, tier.capacity)}
      </p>
    </div>
  );
}
