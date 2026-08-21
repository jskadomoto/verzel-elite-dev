import { cookies } from "next/headers";
import type { Role } from "./roles";

export type { Role };
export type Session = { sub: string; role: Role; name: string };

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
