import Link from "next/link";
import { AreaShell } from "@/components/area-shell";
import { NewEventScreen } from "@/components/new-event-screen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function NewOrganizerEventPage() {
  return (
    <AreaShell>
      <div className="mt-8 flex flex-col gap-8">
        <Link href="/organizador" className="back-link">
          ← Meus eventos
        </Link>

        <NewEventScreen />
      </div>
    </AreaShell>
  );
}
