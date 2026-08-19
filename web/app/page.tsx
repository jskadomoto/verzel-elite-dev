'use client'
import { useEffect, useState } from "react";

export default function Home() {
  const [payload, setPayload] = useState<unknown>(null);
  const [state, setState] = useState("Carregando...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        setPayload(d);
        setState(d.ok ? "ok" : "falhou");
      })
      .catch(() => setState("falhou"));
  }, []);

  return (
    <main className="p-6 font-mono text-sm">
      <p>Api: {state}</p>
      <pre className="mt-2 overflow-x-auto">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
