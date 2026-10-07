"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("errEmail"));
      return;
    }
    if (password.length < 8) {
      setError(t("errPassword"));
      return;
    }

    setError(null);
    setSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // The server never distinguishes "no such account" from "wrong
      // password" in the error it returns — only a malformed email and a
      // rate-limit trip get their own codes — so there is nothing to leak
      // beyond these three copy strings.
      if (result.code === "invalid_email") {
        setError(t("errEmail"));
      } else if (result.code === "rate_limited") {
        setError(t("auth.rateLimited"));
      } else {
        setError(t("errPassword"));
      }
      setSubmitting(false);
      return;
    }

    router.push("/dashboard", { locale });
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-[380px] flex-col gap-5 rounded-card border border-border bg-surface p-7 shadow-card"
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid size-logo-login place-items-center rounded-tile bg-primary text-15 font-semibold text-on-primary">
          C
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-22 font-semibold tracking-heading">
            {t("signIn")}
          </h1>
          <p className="m-0 text-14 text-fg-muted">{t("loginSub")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <label htmlFor={emailId} className="flex flex-col gap-1.5 text-14 font-medium">
          {t("email")}
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            placeholder="you@company.com"
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <label htmlFor={passwordId} className="flex flex-col gap-1.5 text-14 font-medium">
          {t("password")}
          <Input
            id={passwordId}
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        {error ? (
          <p id={errorId} role="alert" className="m-0 text-13 text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {t("signIn")}
      </Button>
      <p className="m-0 text-center text-12 text-fg-muted">{t("demo")}</p>
    </form>
  );
}
