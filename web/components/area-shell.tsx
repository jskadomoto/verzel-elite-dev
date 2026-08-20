import { redirect } from "next/navigation";
import { readAuthed } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { AREA_TITLE, type Role } from "@/lib/roles";
import { LogoutButton } from "./logout-button";
import { RetryButton } from "./retry-button";

type Me = { id: string; name: string; email: string; role: Role };

// Casca comum das três áreas. Componente de servidor: o único pedaço de
// cliente é o botão de sair, e o de tentar de novo quando a API não responde.
export async function AreaShell({ children }: { children?: React.ReactNode }) {
  // O middleware garante que existe cookie, não que ele vale: ele só decodifica
  // o token, sem conferir assinatura nem validade. Quem recusa de verdade é a
  // API, e é por isso que o nome vem daqui e não do cookie.
  const result = await readAuthed<Me>("/auth/me");

  if (!result.ok) {
    // Só sessão recusada manda para o login. Indisponibilidade preserva a
    // sessão e oferece nova tentativa: expulsar alguém porque o backend está
    // hibernando transformaria lentidão em logout.
    if (result.status === 401) {
      redirect("/login");
    }

    return (
      <main className="flex min-h-full flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Área indisponível</h1>
        <p>{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const me = result.data;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        {/* min-w-0 com truncate: nome longo encolhe em vez de empurrar o botão
            para fora e criar rolagem horizontal numa tela de 320px. */}
        <div className="min-w-0">
          <p className="truncate font-medium">{me.name}</p>
          <p className="truncate text-sm opacity-70">{me.email}</p>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold">{AREA_TITLE[me.role]}</h1>
        {children}
      </main>
    </div>
  );
}
