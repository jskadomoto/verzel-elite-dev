const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Sua conta não tem acesso a esta área.",
  NOT_FOUND: "Não encontramos o que você procura.",
  VALIDATION_ERROR: "Confira os dados informados.",
  EVENT_WITHOUT_TIERS:
    "Adicione ao menos um setor antes de publicar o evento.",
  EVENT_STARTS_IN_THE_PAST:
    "A data do evento já passou. Ajuste a data antes de publicar.",
  EVENT_NOT_DRAFT:
    "Só rascunho pode ser editado. Recarregue a página para ver o estado atual.",
  EVENT_ALREADY_CANCELLED:
    "Este evento já está cancelado. Recarregue a página para ver o estado atual.",
  DUPLICATE_TIER_NAME: "Há dois setores com o mesmo nome.",
  CATALOG_ITEM_NOT_FOUND:
    "Este item saiu do catálogo externo. Busque novamente ou preencha os campos à mão.",
  UPSTREAM_UNAVAILABLE:
    "Serviço indisponível no momento. Tente novamente em instantes.",
  UPSTREAM_INVALID_RESPONSE:
    "Serviço indisponível no momento. Tente novamente em instantes.",
};

const FALLBACK = "Não foi possível concluir. Tente novamente.";

export function messageFor(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || FALLBACK;
}

export function fieldErrorsOf(payload: unknown): Record<string, string[]> {
  const details = detailsOf(payload);
  if (!details) return {};

  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (typeof fieldErrors !== "object" || fieldErrors === null) return {};

  const marked: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (Array.isArray(messages)) {
      marked[field] = messages.filter(
        (message): message is string => typeof message === "string",
      );
    }
  }
  return marked;
}

function detailsOf(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  return (error as { details?: unknown }).details;
}

export function codeOf(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
