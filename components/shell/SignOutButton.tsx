"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const t = useTranslations();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      title={t("signOut")}
      onClick={() => {
        // TODO(TAH-19): call the real Auth.js sign-out once authentication lands.
      }}
    >
      {t("signOut")}
    </Button>
  );
}
