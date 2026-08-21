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
      className="btn-quiet"
    >
      {pending ? "Tentando…" : "Tentar novamente"}
    </button>
  );
}
