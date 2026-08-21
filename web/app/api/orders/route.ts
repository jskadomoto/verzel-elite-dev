import { envelope, forwardAuthed, jsonBody } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (body === null) {
    return envelope("VALIDATION_ERROR", "Corpo inválido.", 422);
  }
  return forwardAuthed("/orders", { method: "POST", body });
}
