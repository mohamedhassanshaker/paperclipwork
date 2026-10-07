"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createCustomerSchema } from "@/lib/validation";
import type { Customer, CustomerStatus } from "@/lib/repository/customer";

type FormValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: CustomerStatus;
};

const EMPTY_FORM: FormValues = { name: "", email: "", phone: "", company: "", status: "active" };

function toFormValues(customer: Customer): FormValues {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    company: customer.company ?? "",
    status: customer.status,
  };
}

/** Maps a `fields` error code (interface-contract §4) to an i18n message key. */
function fieldMessageKey(code: string): string {
  switch (code) {
    case "required":
      return "errName";
    case "invalid_email":
      return "errEmail";
    case "invalid_phone":
      return "errInvalidPhone";
    case "too_long":
      return "errTooLong";
    default:
      return "errGeneric";
  }
}

export interface CustomerFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  customer?: Customer;
  onClose: () => void;
  onSaved: (customer: Customer, mode: "create" | "edit") => void;
}

export function CustomerFormDialog({ open, mode, customer, onClose, onSaved }: CustomerFormDialogProps) {
  const t = useTranslations();
  const titleId = useId();
  const descId = useId();

  const [form, setForm] = useState<FormValues>(() => (customer ? toFormValues(customer) : EMPTY_FORM));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset(nextCustomer?: Customer) {
    setForm(nextCustomer ? toFormValues(nextCustomer) : EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);
  }

  function field(key: keyof FormValues) {
    return (event: { target: { value: string } }) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
      setFieldErrors((prev) => ({ ...prev, [key]: "" }));
      setFormError(null);
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = createCustomerSchema.safeParse({
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      status: form.status,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!(key in errors)) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        mode === "edit" && customer ? `/api/customers/${customer.id}` : "/api/customers",
        {
          method: mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error: string; fields?: Record<string, string> }
          | null;
        if (response.status === 422 && body?.fields) {
          const errors: Record<string, string> = {};
          for (const [key, code] of Object.entries(body.fields)) {
            errors[key] = code;
          }
          setFieldErrors(errors);
        } else if (response.status === 409) {
          setFieldErrors({ email: "email_taken" });
        } else {
          setFormError(t("errGeneric"));
        }
        setSubmitting(false);
        return;
      }

      const saved = (await response.json()) as Customer;
      onSaved(saved, mode);
    } catch {
      setFormError(t("errGeneric"));
      setSubmitting(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  const nameErrorId = fieldErrors.name ? `${titleId}-name-error` : undefined;
  const emailErrorId = fieldErrors.email ? `${titleId}-email-error` : undefined;
  const phoneErrorId = fieldErrors.phone ? `${titleId}-phone-error` : undefined;
  const companyErrorId = fieldErrors.company ? `${titleId}-company-error` : undefined;

  return (
    <Dialog open={open} onClose={handleClose} titleId={titleId} descriptionId={descId}>
      {/* noValidate: the browser's native type="email" check would otherwise
          silently block the submit event (and show an unstyled native
          tooltip) before our Zod validation and its styled inline error ever
          run. */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-1">
          <h3 id={titleId} className="m-0 text-18 font-semibold">
            {mode === "edit" ? t("editTitle") : t("addTitle")}
          </h3>
          <p id={descId} className="m-0 text-14 text-fg-muted">
            {mode === "edit" ? t("editDesc") : t("addDesc")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <label className="col-span-2 flex flex-col gap-1.5 text-14 font-medium">
            {t("fullName")}
            <Input
              value={form.name}
              onChange={field("name")}
              placeholder="Jane Cooper"
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={nameErrorId}
            />
            {fieldErrors.name ? (
              <span id={nameErrorId} role="alert" className="text-13 text-danger">
                {t(fieldMessageKey(fieldErrors.name))}
              </span>
            ) : null}
          </label>

          <label className="col-span-2 flex flex-col gap-1.5 text-14 font-medium">
            {t("email")}
            <Input
              type="email"
              value={form.email}
              onChange={field("email")}
              placeholder="jane@company.com"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={emailErrorId}
            />
            {fieldErrors.email ? (
              <span id={emailErrorId} role="alert" className="text-13 text-danger">
                {t(fieldErrors.email === "email_taken" ? "errEmailTaken" : fieldMessageKey(fieldErrors.email))}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-14 font-medium">
            {t("phone")}
            <Input
              value={form.phone}
              onChange={field("phone")}
              placeholder="+1 555 0100"
              dir="ltr"
              aria-invalid={fieldErrors.phone ? true : undefined}
              aria-describedby={phoneErrorId}
            />
            {fieldErrors.phone ? (
              <span id={phoneErrorId} role="alert" className="text-13 text-danger">
                {t(fieldMessageKey(fieldErrors.phone))}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-14 font-medium">
            {t("status")}
            <Select value={form.status} onChange={field("status")}>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </Select>
          </label>

          <label className="col-span-2 flex flex-col gap-1.5 text-14 font-medium">
            {t("company")}
            <Input
              value={form.company}
              onChange={field("company")}
              placeholder="Acme Inc."
              aria-invalid={fieldErrors.company ? true : undefined}
              aria-describedby={companyErrorId}
            />
            {fieldErrors.company ? (
              <span id={companyErrorId} role="alert" className="text-13 text-danger">
                {t(fieldMessageKey(fieldErrors.company))}
              </span>
            ) : null}
          </label>
        </div>

        {formError ? (
          <p role="alert" className="m-0 text-13 text-danger">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={submitting}>
            {mode === "edit" ? t("saveChanges") : t("create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
