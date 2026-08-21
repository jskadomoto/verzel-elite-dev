import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="inline-flex min-h-11 items-center self-start">
        <BrandMark />
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted">
          Use a conta de cliente para comprar, a de organizador para publicar, e
          a de portaria para validar na entrada.
        </p>
      </div>

      <LoginForm />

      <Link href="/" className="back-link self-start">
        ← Voltar ao catálogo
      </Link>
    </main>
  );
}
