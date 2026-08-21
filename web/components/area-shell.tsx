import { redirect } from "next/navigation";
import { readAuthed } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { AREA_TITLE, type Role } from "@/lib/roles";
import { RetryButton } from "./retry-button";
import { SiteHeader } from "./site-header";

type Me = { id: string; name: string; email: string; role: Role };

export async function AreaShell({ children }: { children?: React.ReactNode }) {
  const result = await readAuthed<Me>("/auth/me");

  if (!result.ok) {
    if (result.status === 401) {
      redirect("/login");
    }

    return (
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-start gap-5 px-4 py-6">
        <h1 className="text-xl font-semibold">Área indisponível</h1>
        <p className="text-muted">{messageFor(result.code)}</p>
        <RetryButton />
      </main>
    );
  }

  const me = result.data;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader
        identity={{ name: me.name, role: me.role }}
        surface="area"
        width="max-w-3xl"
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-xl font-bold">{AREA_TITLE[me.role]}</h1>
        <p className="mt-1 truncate text-sm text-muted">{me.email}</p>
        {children}
      </main>
    </div>
  );
}
