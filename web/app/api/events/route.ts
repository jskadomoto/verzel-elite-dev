import { forward, searchOf } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return forward("/events", { search: searchOf(request) });
}
