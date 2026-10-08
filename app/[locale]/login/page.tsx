import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/shell/LanguageToggle";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: `${t("signIn")} — ${t("brand")}` };
}

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen place-items-center bg-bg p-6">
      <LoginForm />
      <LanguageToggle className="absolute top-5 end-5" />
    </div>
  );
}
