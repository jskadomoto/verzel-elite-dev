"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Refaz a renderização no servidor, que é onde a chamada à API acontece.
// Recarregar a página inteira funcionaria, mas descartaria o estado de tudo
// que estiver montado em volta.
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
        // O refresh não devolve promessa; soltar o botão depois de um instante
        // evita que ele fique travado se o servidor responder rápido demais.
        setTimeout(() => setPending(false), 1500);
      }}
      className="min-h-11 rounded border px-4 text-base disabled:opacity-60"
    >
      {pending ? "Tentando…" : "Tentar novamente"}
    </button>
  );
}
