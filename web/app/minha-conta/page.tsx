import { AreaShell } from "@/components/area-shell";

// Sem cache: o conteúdo depende da sessão de quem abriu.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AreaShell />;
}
