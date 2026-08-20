// Só roda no servidor: lê cookie e a variável privada API_URL. Importar isto de
// um componente de cliente vazaria a URL da API para o browser.

import { cookies } from "next/headers";
import { codeOf } from "./errors";

// Abaixo do maxDuration de 60s dos handlers, para que quem estoure primeiro
// seja este código e a resposta seja o 502 com mensagem própria, em vez de a
// plataforma matar a função sem resposta nenhuma. A folga é larga porque o
// plano gratuito do Render hiberna, e a primeira requisição depois disso pode
// levar perto de um minuto.
const UPSTREAM_TIMEOUT_MS = 45_000;

// O BFF responde no mesmo envelope da API, para que a tela escolha a mensagem
// pelo `code` sem precisar saber qual das duas camadas respondeu.
export function envelope(code: string, message: string, status: number) {
  return Response.json({ error: { code, message, details: {} } }, { status });
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  search?: URLSearchParams;
};

// Repassa sem sessão. Existe para que a rota pública também atravesse o BFF:
// chamar a API direto do browser exporia API_URL, que é o que este desenho
// inteiro evita.
export function forward(path: string, options: Options = {}) {
  return call(path, options);
}

// Repassa injetando o token do cookie. Sem cookie a requisição não chega a
// sair daqui, e o 401 vem do BFF com o mesmo código que a API usaria.
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

// Componente de servidor precisa do dado, não de uma Response. Reusa
// `forwardAuthed` inteiro, então tempo limite, envelope, 401 sem cookie e
// tratamento de corpo não-JSON valem exatamente igual.
//
// Devolve status e código, e não apenas ausência de dado, porque colapsar tudo
// em `null` faria a tela confundir sessão inválida com backend fora do ar. As
// duas pedem reação oposta: uma manda para o login, a outra precisa preservar a
// sessão e deixar tentar de novo. Com o Render hibernando, colapsar as duas
// expulsaria o usuário por indisponibilidade.
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

// Corpo malformado devolve null. Nenhuma rota daqui aceita `null` como corpo
// legítimo, então quem chama trata os dois casos junto.
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

// Resposta não-JSON tem causa diferente de rede indisponível: costuma ser
// página de erro de proxy durante o cold start. Sem código próprio os dois
// casos ficariam indistinguíveis para a tela, e o corpo bruto, que é a única
// pista do que aconteceu, sumiria sem deixar registro.
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

    // 204 não tem corpo, e `.json()` sobre corpo vazio lança.
    if (upstream.status === 204) {
      return new Response(null, { status: 204 });
    }
    // `parsed` nunca lança, então este try cobre apenas rede e leitura do
    // corpo, e não a interpretação dele.
    return parsed(upstream.status, await upstream.text(), path);
  } catch {
    // Rede caída, ou tempo limite estourado acima. 502 diz que o problema está
    // a montante, e não na requisição de quem chamou.
    return envelope(
      "UPSTREAM_UNAVAILABLE",
      "Serviço temporariamente indisponível. Tente novamente.",
      502,
    );
  }
}
