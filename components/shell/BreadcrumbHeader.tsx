"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function BreadcrumbHeader() {
  const t = useTranslations();
  const pathname = usePathname();

  const pageKey = pathname.startsWith("/dashboard") ? "dashboard" : "customers";

  return (
    <header className="flex h-header items-center gap-2 border-b border-border px-page text-14 text-fg-muted">
      <span>{t("brand")}</span>
      <span>/</span>
      <span className="font-medium text-fg">{t(pageKey)}</span>
    </header>
  );
}
