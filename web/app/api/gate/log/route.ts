import { forwardAuthed, searchOf } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return forwardAuthed("/gate/log", { search: searchOf(request) });
}
