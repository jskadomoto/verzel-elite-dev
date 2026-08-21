"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";
import { sharePath, type IssuedShareLink, type ShareLink } from "@/lib/tickets";

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded border px-4 text-base";

const openedLabel = (openedCount: number) =>
  openedCount === 1 ? "1 abertura" : `${openedCount} aberturas`;

export function ShareControls({
  ticketId,
  share,
  expiresLabel,
  lastOpenedLabel,
}: Readonly<{
  ticketId: string;
  share: ShareLink | null;
  expiresLabel: string;
  lastOpenedLabel: string | null;
}>) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function send(method: "POST" | "DELETE") {
    setWorking(true);
    setProblem(null);
    setCopied(false);
    setToken(null);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/share`, {
        method,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setProblem(messageFor(codeOf(payload)));
        return;
      }

      if (method === "POST") {
        setToken(((await response.json()) as IssuedShareLink).token);
      }
      router.refresh();
    } catch {
      setProblem(messageFor("UPSTREAM_UNAVAILABLE"));
    } finally {
      setWorking(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const url = token ? `${window.location.origin}${sharePath(token)}` : null;

  return (
    <section className="flex flex-col gap-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Compartilhar</h2>

      <p className="text-sm">
        Quem tem o link tem o ingresso: ele abre sem senha e sem conta. Se duas
        pessoas apresentarem o mesmo ingresso, a primeira leitura na portaria
        vence. Revogue o link se ele sair do seu controle.
      </p>

      {share ? (
        <p className="text-sm opacity-80">
          Link ativo, {openedLabel(share.openedCount)}
          {lastOpenedLabel ? `, última ${lastOpenedLabel}` : ""}. Expira em{" "}
          {expiresLabel}.
        </p>
      ) : (
        <p className="text-sm opacity-80">Nenhum link ativo.</p>
      )}

      {url ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm" htmlFor="share-url">
            Link gerado, copie agora: ele não é exibido de novo.
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="bg-background text-foreground min-h-11 rounded border px-3 text-base"
          />
          <button
            type="button"
            onClick={() => copy(url)}
            className={buttonClass}
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-sm font-medium">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={working}
          onClick={() => send("POST")}
          className={`${buttonClass} disabled:opacity-60`}
        >
          {share ? "Gerar link novo" : "Gerar link"}
        </button>

        {share ? (
          <button
            type="button"
            disabled={working}
            onClick={() => send("DELETE")}
            className={`${buttonClass} disabled:opacity-60`}
          >
            Revogar link
          </button>
        ) : null}
      </div>

      {share ? (
        <p className="text-sm opacity-80">
          Gerar um link novo revoga o anterior.
        </p>
      ) : null}
    </section>
  );
}
