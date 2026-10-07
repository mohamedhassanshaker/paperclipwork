"use client";

import { useTranslations, useLocale } from "next-intl";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      title={t("signOut")}
      onClick={() => {
        void signOut({ redirectTo: `/${locale}/login` });
      }}
    >
      {t("signOut")}
    </Button>
  );
}
