import { redirect } from "next/navigation";
import { readAuthed } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { AREA_TITLE, type Role } from "@/lib/roles";
import { BrandMark } from "./brand-mark";
import { LogoutButton } from "./logout-button";
import { RetryButton } from "./retry-button";

type Me = { id: string; name: string; email: string; role: Role };

export async function AreaShell({ children }: { children?: React.ReactNode }) {
  const result = await readAuthed<Me>("/auth/me");

  if (!result.ok) {
    if (result.status === 401) {
      redirect("/login");
    }

    return (
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-start gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Área indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const me = result.data;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <BrandMark />
            <p className="truncate text-sm text-faint">{me.email}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {AREA_TITLE[me.role]}
        </h1>
        <p className="mt-1 text-sm text-muted">{me.name}</p>
        {children}
      </main>
    </div>
  );
}
