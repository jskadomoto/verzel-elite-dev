"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { messageFor } from "@/lib/errors";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sair() {
    setPending(true);
    setError(null);

    const encerrou = await fetch("/api/auth/logout", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false);

    if (!encerrou) {
      setError(messageFor("UPSTREAM_UNAVAILABLE"));
      setPending(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={sair}
        disabled={pending}
        className="btn-quiet"
      >
        {pending ? "Saindo…" : "Sair"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
