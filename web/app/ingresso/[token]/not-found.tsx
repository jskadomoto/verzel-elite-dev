import Link from "next/link";

export default function SharedTicketNotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col items-start gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Link não encontrado</h1>
      <p className="text-muted">
        Este link não existe, foi revogado por quem compartilhou, ou já expirou.
        Peça um link novo a quem enviou.
      </p>
      <Link
        href="/"
        className="btn-quiet"
      >
        Ver eventos publicados
      </Link>
    </main>
  );
}
