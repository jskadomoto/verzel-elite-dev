import Link from "next/link";
import { AREA_SHORTCUT, HOME, type Role } from "@/lib/roles";
import { BrandMark } from "./brand-mark";
import { LogoutButton } from "./logout-button";

export type HeaderIdentity = { name: string; role: Role };

type Surface = "public" | "area";

function shortcutFor(identity: HeaderIdentity, surface: Surface) {
  if (surface === "public") {
    return { href: HOME[identity.role], label: AREA_SHORTCUT[identity.role] };
  }
  if (identity.role === "GATE") return null;
  return { href: "/", label: "Catálogo" };
}

export function SiteHeader({
  identity,
  surface,
  width,
}: Readonly<{
  identity: HeaderIdentity | null;
  surface: Surface;
  width: string;
}>) {
  const shortcut = identity ? shortcutFor(identity, surface) : null;

  return (
    <header className="border-b border-line">
      <div
        className={`mx-auto flex w-full ${width} items-center justify-between gap-3 px-4 py-3`}
      >
        <div className="flex min-w-0 flex-col">
          <BrandMark />
          {identity ? (
            <p className="truncate text-sm text-faint">{identity.name}</p>
          ) : null}
        </div>

        {identity ? (
          <div className="flex shrink-0 items-center gap-3">
            {shortcut ? (
              <Link href={shortcut.href} className="back-link">
                {shortcut.label}
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        ) : (
          <Link href="/login" className="btn-quiet">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
