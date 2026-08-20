import { forward } from "@/lib/api";

// Sem cache: o detalhe expõe disponibilidade por setor, lida no momento.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forward(`/events/${encodeURIComponent(id)}`);
}
