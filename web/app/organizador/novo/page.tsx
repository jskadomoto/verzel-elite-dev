import Link from "next/link";
import { AreaShell } from "@/components/area-shell";
import { NewEventScreen } from "@/components/new-event-screen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function NewOrganizerEventPage() {
  return (
    <AreaShell>
      <div className="mt-4 flex flex-col gap-6">
        <Link
          href="/organizador"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Voltar aos meus eventos
        </Link>

        <NewEventScreen />
      </div>
    </AreaShell>
  );
}
