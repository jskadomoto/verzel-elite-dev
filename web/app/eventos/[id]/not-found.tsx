import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">Evento não encontrado</h1>
      <p>
        Este evento não existe, ou ainda não foi publicado no catálogo público.
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded border px-4">
        Ver eventos publicados
      </Link>
    </main>
  );
}
