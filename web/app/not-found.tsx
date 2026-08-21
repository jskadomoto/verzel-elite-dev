import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p>
        Este endereço não existe, ou o evento não está publicado no catálogo.
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded border px-4">
        Ver eventos publicados
      </Link>
    </main>
  );
}
