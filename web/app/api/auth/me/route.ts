import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const token = (await cookies()).get("session")?.value;
  if (!token)
    return Response.json(
      { error: { code: "UNAUTHENTICATED" } },
      { status: 401 },
    );

  const upstream = await fetch(`${process.env.API_URL}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return Response.json(await upstream.json(), { status: upstream.status });
}
