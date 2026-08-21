import { forwardAuthed } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardAuthed(`/tickets/${encodeURIComponent(id)}/share`, {
    method: "POST",
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardAuthed(`/tickets/${encodeURIComponent(id)}/share`, {
    method: "DELETE",
  });
}
