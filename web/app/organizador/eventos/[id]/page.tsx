import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaShell } from "@/components/area-shell";
import { EventActions } from "@/components/event-actions";
import { EventForm } from "@/components/event-form";
import { OrganizerEventView } from "@/components/organizer-event-view";
import { RetryButton } from "@/components/retry-button";
import { readAuthed } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import {
  eventFormFromEvent,
  STATUS_LABEL,
  STATUS_STYLE,
  type OrganizerEvent,
} from "@/lib/organizer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OrganizerEventPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const result = await readAuthed<OrganizerEvent>(
    `/organizer/events/${encodeURIComponent(id)}`,
  );

  if (!result.ok) {
    if (result.status === 404) notFound();

    return (
      <AreaShell>
        <div className="mt-5 flex flex-col items-start gap-4">
          <p className="text-muted">{messageFor(result.code)}</p>
          <RetryButton />
        </div>
      </AreaShell>
    );
  }

  const event = result.data;

  return (
    <AreaShell>
      <div className="mt-5 flex flex-col gap-6">
        <Link href="/organizador" className="back-link">
          ← Meus eventos
        </Link>

        <div className="flex flex-col items-start gap-2">
          <h2 className="text-xl font-semibold tracking-tight break-words">
            {event.title}
          </h2>
          <span className={`chip ${STATUS_STYLE[event.status]}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </div>

        <EventActions eventId={event.id} status={event.status} />

        {event.status === "DRAFT" ? (
          <EventForm
            mode="edit"
            eventId={event.id}
            initial={eventFormFromEvent(event)}
          />
        ) : (
          <OrganizerEventView event={event} />
        )}
      </div>
    </AreaShell>
  );
}
