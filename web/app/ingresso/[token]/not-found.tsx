import Link from "next/link";

export default function SharedTicketNotFound() {
  return (
    <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
      <h1 className="text-xl font-semibold">Link não encontrado</h1>
      <p>
        Este link não existe, foi revogado por quem compartilhou, ou já expirou.
        Peça um link novo a quem enviou.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded border px-4"
      >
        Ver eventos publicados
      </Link>
    </main>
  );
}
