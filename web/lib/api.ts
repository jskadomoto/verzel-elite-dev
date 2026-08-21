
import { cookies } from "next/headers";
import { codeOf } from "./errors";

const UPSTREAM_TIMEOUT_MS = 45_000;

export function envelope(code: string, message: string, status: number) {
  return Response.json({ error: { code, message, details: {} } }, { status });
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  search?: URLSearchParams;
};

export function forward(path: string, options: Options = {}) {
  return call(path, options);
}

export async function forwardAuthed(path: string, options: Options = {}) {
  const token = (await cookies()).get("session")?.value;
  if (!token) {
    return envelope("UNAUTHENTICATED", "Sessão ausente.", 401);
  }
  return call(path, options, token);
}

export type ReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string };

export async function readAuthed<T>(path: string): Promise<ReadResult<T>> {
  const response = await forwardAuthed(path);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      code: codeOf(payload) ?? "INTERNAL_ERROR",
    };
  }
  return { ok: true, data: payload as T };
}

export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function searchOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

function parsed(status: number, raw: string, path: string) {
  try {
    return Response.json(JSON.parse(raw), { status });
  } catch {
    console.error(
      `BFF: resposta não-JSON de ${path} (status ${status}):`,
      raw.slice(0, 200),
    );
    return envelope(
      "UPSTREAM_INVALID_RESPONSE",
      "O serviço respondeu em formato inesperado.",
      502,
    );
  }
}

async function call(path: string, options: Options, token?: string) {
  const base = process.env.API_URL;
  if (!base) {
    return envelope("INTERNAL_ERROR", "API_URL ausente.", 500);
  }

  const query = options.search?.toString();
  const hasBody = options.body !== undefined;

  try {
    const url = base + path + (query ? "?" + query : "");
    const upstream = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(hasBody ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (upstream.status === 204) {
      return new Response(null, { status: 204 });
    }
    return parsed(upstream.status, await upstream.text(), path);
  } catch {
    return envelope(
      "UPSTREAM_UNAVAILABLE",
      "Serviço temporariamente indisponível. Tente novamente.",
      502,
    );
  }
}
