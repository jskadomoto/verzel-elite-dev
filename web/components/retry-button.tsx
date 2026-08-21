"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        router.refresh();
        setTimeout(() => setPending(false), 1500);
      }}
      className="min-h-11 rounded border px-4 text-base disabled:opacity-60"
    >
      {pending ? "Tentando…" : "Tentar novamente"}
    </button>
  );
}
