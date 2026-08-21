import { forwardAuthed } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return forwardAuthed(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}
