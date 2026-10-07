"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LanguageToggle } from "./LanguageToggle";
import { SignOutButton } from "./SignOutButton";

const NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", glyph: "▦" },
  { key: "customers", href: "/customers", glyph: "◉" },
] as const;

export function Sidebar({ userEmail }: { userEmail: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-sidebar flex-col gap-5 border-e border-border bg-bg p-3">
      <div className="flex items-center gap-2.5 p-2">
        <div className="grid size-logo-sidebar place-items-center rounded-control bg-primary text-13 font-semibold text-on-primary">
          C
        </div>
        <div className="text-14 font-semibold">{t("brand")}</div>
      </div>

      <nav className="flex flex-col gap-0.5">
        <div className="px-2 py-1.5 text-12 font-medium text-fg-muted">
          {t("menu")}
        </div>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "focus-ring flex h-nav-item items-center gap-2.5 rounded-control px-2 text-14",
                active
                  ? "bg-primary-subtle font-medium text-primary-strong"
                  : "text-fg-secondary hover:bg-primary-subtle-hover hover:text-primary-strong",
              )}
            >
              <span className="grid size-4 place-items-center font-mono text-12">
                {item.glyph}
              </span>
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2">
        <LanguageToggle className="w-full" />
      </div>

      <div className="flex items-center gap-2.5 border-t border-border pt-3 ps-2 pe-1">
        <div className="grid size-avatar shrink-0 place-items-center rounded-pill bg-border text-12 font-semibold">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden text-13 text-ellipsis whitespace-nowrap">
          {userEmail}
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
