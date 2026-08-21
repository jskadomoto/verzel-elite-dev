"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";
import { HOME, type Role } from "@/lib/roles";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function entrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(messageFor(codeOf(payload)));
        setPending(false);
        return;
      }

      const role = payload?.user?.role as Role | undefined;
      router.replace(role ? (HOME[role] ?? "/") : "/");
      router.refresh();
    } catch {
      setError(messageFor("UPSTREAM_UNAVAILABLE"));
      setPending(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-11 w-full rounded border px-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 w-full rounded border px-3 text-base"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded border px-4 text-base disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
