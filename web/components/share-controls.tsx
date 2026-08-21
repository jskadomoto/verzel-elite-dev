"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeOf, messageFor } from "@/lib/errors";
import { sharePath, type IssuedShareLink, type ShareLink } from "@/lib/tickets";

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
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold">Compartilhar</h2>
        <span className="chip">
          {share
            ? `Link ativo · ${openedLabel(share.openedCount)}`
            : "Nenhum link ativo"}
        </span>
      </div>

      <p className="text-sm text-muted">
        Quem tem o link tem o ingresso: ele abre sem senha e sem conta. Se duas
        pessoas apresentarem o mesmo ingresso, a primeira leitura na portaria
        vence. Revogue o link se ele sair do seu controle.
      </p>

      {share ? (
        <p className="text-sm text-faint">
          Expira em {expiresLabel}
          {lastOpenedLabel ? `, última abertura ${lastOpenedLabel}` : ""}.
        </p>
      ) : null}

      {url ? (
        <div className="flex flex-col gap-2 rounded-md border border-brand/40 bg-brand/10 p-3">
          <label className="label" htmlFor="share-url">
            Link gerado, copie agora: ele não é exibido de novo.
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            className="field font-mono"
          />
          <button
            type="button"
            onClick={() => copy(url)}
            className="btn-primary"
          >
            {copied ? "Link copiado" : "Copiar link"}
          </button>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="alert">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={working}
          onClick={() => send("POST")}
          className={share ? "btn-quiet" : "btn-primary"}
        >
          {share ? "Gerar link novo" : "Gerar link"}
        </button>

        {share ? (
          <button
            type="button"
            disabled={working}
            onClick={() => send("DELETE")}
            className="btn-danger"
          >
            Revogar link
          </button>
        ) : null}
      </div>

      {share ? (
        <p className="text-sm text-faint">Gerar um link novo revoga o anterior.</p>
      ) : null}
    </section>
  );
}
