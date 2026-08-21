import { AreaShell } from "@/components/area-shell";
import { GateConsole } from "@/components/gate-console";
import { RetryButton } from "@/components/retry-button";
import { messageFor } from "@/lib/errors";
import { loadGateEvents, loadGateLog } from "@/lib/gate-reads";
import type { ValidationAttempt } from "@/lib/gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Page() {
  const result = await loadGateEvents();

  if (!result.ok) {
    return (
      <AreaShell>
        <section className="mt-4 flex flex-col items-start gap-3">
          <p>{messageFor(result.code)}</p>
          <RetryButton />
        </section>
      </AreaShell>
    );
  }

  const { events } = result.data;
  const startOn = events.length === 1 ? events[0].id : "";

  let startLog: ValidationAttempt[] = [];
  if (startOn) {
    const log = await loadGateLog(startOn);
    if (log.ok) startLog = log.data.attempts;
  }

  return (
    <AreaShell>
      <GateConsole events={events} startOn={startOn} startLog={startLog} />
    </AreaShell>
  );
}
