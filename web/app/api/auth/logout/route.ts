import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export async function POST() {
  (await cookies()).delete("session");
  return new Response(null, { status: 204 });
}
