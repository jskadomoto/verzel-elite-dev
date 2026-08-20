import { envelope, forwardAuthed, jsonBody } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  return forwardAuthed(`/organizer/events/${encodeURIComponent(id)}`);
}

export async function PATCH(request: Request, { params }: Context) {
  const body = await jsonBody(request);
  if (body === null) {
    return envelope("VALIDATION_ERROR", "Corpo inválido.", 422);
  }
  const { id } = await params;
  return forwardAuthed(`/organizer/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });
}
