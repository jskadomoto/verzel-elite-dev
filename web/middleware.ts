import { NextResponse, type NextRequest } from "next/server";
import { readSession, type Role } from "./lib/session";

const HOME: Record<Role, string> = {
  ORGANIZER: "/organizador",
  CUSTOMER: "/minha-conta",
  GATE: "/portaria",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request.cookies.get("session")?.value);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowed = HOME[session.role];
  if (!pathname.startsWith(allowed)) {
    return NextResponse.redirect(new URL(allowed, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/organizador/:path*", "/minha-conta/:path*", "/portaria/:path*"],
};
