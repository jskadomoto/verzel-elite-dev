import { redirect } from "next/navigation";
import { AreaShell } from "@/components/area-shell";
import { OrganizerEventList } from "@/components/organizer-event-list";
import { readAuthed } from "@/lib/api";
import { organizerHref, type OrganizerListResult } from "@/lib/organizer";
import { lastPageOf } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OrganizerPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const page = pageFrom((await searchParams).page);

  const search = new URLSearchParams();
  if (page > 0) search.set("page", String(page));

  const listing = await readAuthed<OrganizerListResult>(
    "/organizer/events",
    search,
  );

  if (listing.ok && listing.data.items.length === 0 && listing.data.total > 0) {
    redirect(organizerHref(lastPageOf(listing.data.pageSize, listing.data.total)));
  }

  return (
    <AreaShell>
      <div className="mt-8">
        <OrganizerEventList page={page} listing={listing} />
      </div>
    </AreaShell>
  );
}

function pageFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
