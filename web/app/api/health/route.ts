export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const base = process.env.API_URL;
  if (!base) {
    return Response.json(
      { ok: false, error: "API_URL Ausente" },
      { status: 500 },
    );
  }
  try {
    const upstream = await fetch(`${base}/health`, { cache: "no-store" });
    return Response.json(await upstream.json(), { status: upstream.status });
  } catch {
    return Response.json(
      { ok: false, error: "Falha no servidor" },
      { status: 502 },
    );
  }
}
