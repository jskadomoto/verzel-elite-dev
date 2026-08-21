import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-5 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Página não encontrada</h1>
      <p className="text-muted">
        Este endereço não existe, ou o evento não está publicado no catálogo.
      </p>
      <Link href="/" className="btn-quiet">
        Ver eventos publicados
      </Link>
    </main>
  );
}
