import Link from "next/link";

export default function OrganizerEventNotFound() {
  return (
    <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">Evento não encontrado</h1>
      <p>Este evento não existe ou não pertence à sua conta.</p>
      <Link
        href="/organizador"
        className="inline-flex min-h-11 items-center rounded border px-4"
      >
        Voltar aos meus eventos
      </Link>
    </main>
  );
}
