import { cookies } from "next/headers";

export type Role = "ORGANIZER" | "CUSTOMER" | "GATE";
export type Session = { sub: string; role: Role; name: string };

// Decodifica sem verificar assinatura.
// Serve apenas para decidir o que renderizar e para onde redirecionar.
// Autorização de verdade acontece no backend, a cada requisição, contra o token assinado.
export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return readSession((await cookies()).get("session")?.value);
}
