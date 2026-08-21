import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Evento não encontrado</h1>
      <p className="text-muted">
        Este evento não existe, ou ainda não foi publicado no catálogo público.
      </p>
      <Link href="/" className="btn-quiet">
        Ver eventos publicados
      </Link>
    </main>
  );
}
