import { forward, searchOf } from "@/lib/api";

// Sem cache: a listagem carrega preço a partir de, e disponibilidade servida de
// cache mostra o que já acabou.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return forward("/events", { search: searchOf(request) });
}
