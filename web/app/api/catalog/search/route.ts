import { forwardAuthed, searchOf } from "@/lib/api";

// Sem cache aqui: o cache do catálogo externo já existe no backend, com chave
// por termo e página. Repetir em cima congelaria o resultado por mais tempo sem
// ganho nenhum.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return forwardAuthed("/catalog/search", { search: searchOf(request) });
}
