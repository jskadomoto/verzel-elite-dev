import Link from "next/link";

export default function OrganizerEventNotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Evento não encontrado</h1>
      <p className="text-muted">Este evento não existe ou não pertence à sua conta.</p>
      <Link
        href="/organizador"
        className="btn-quiet"
      >
        Voltar aos meus eventos
      </Link>
    </main>
  );
}
