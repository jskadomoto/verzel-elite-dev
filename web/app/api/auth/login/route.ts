import { cookies } from "next/headers";

export async function POST(request: Request) {
  const upstream = await fetch(`${process.env.API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application.json" },
    body: JSON.stringify(await request.json()),
    cache: "no-store",
  });

  const data = await upstream.json();

  if (!upstream.ok) return Response.json(data, { status: upstream.status });

  (await cookies()).set("session", data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return Response.json({ user: data.user });
}
