// A tela escolhe a mensagem pelo `code`, nunca pelo texto: o texto da API é
// legível mas não é contrato, e pode mudar sem aviso. O código é estável.
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Sua conta não tem acesso a esta área.",
  NOT_FOUND: "Não encontramos o que você procura.",
  VALIDATION_ERROR: "Confira os dados informados.",
  UPSTREAM_UNAVAILABLE:
    "Serviço indisponível no momento. Tente novamente em instantes.",
  UPSTREAM_INVALID_RESPONSE:
    "Serviço indisponível no momento. Tente novamente em instantes.",
};

const FALLBACK = "Não foi possível concluir. Tente novamente.";

export function messageFor(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || FALLBACK;
}

// Lê o `code` do envelope sem confiar que a resposta tem o formato esperado:
// um proxy no meio do caminho pode devolver qualquer coisa.
export function codeOf(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
