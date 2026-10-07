"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className={cn(
        "focus-ring h-toggle cursor-pointer rounded-control border border-border bg-surface px-3 text-13 font-medium text-fg hover:bg-border-subtle",
        className,
      )}
    >
      {t("switchLang")}
    </button>
  );
}
