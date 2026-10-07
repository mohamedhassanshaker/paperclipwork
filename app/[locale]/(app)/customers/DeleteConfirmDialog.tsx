"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/lib/repository/customer";

export interface DeleteConfirmDialogProps {
  customer: Customer;
  onClose: () => void;
  onDeleted: (customer: Customer) => void;
}

export function DeleteConfirmDialog({ customer, onClose, onDeleted }: DeleteConfirmDialogProps) {
  const t = useTranslations();
  const titleId = useId();
  const descId = useId();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        setError(t("errGeneric"));
        setDeleting(false);
        return;
      }
      onDeleted(customer);
    } catch {
      setError(t("errGeneric"));
      setDeleting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} titleId={titleId} descriptionId={descId} size="sm">
      <div className="flex flex-col gap-1.5">
        <h3 id={titleId} className="m-0 text-18 font-semibold">
          {t("deleteTitle")}
        </h3>
        <p id={descId} className="m-0 text-pretty text-14 text-fg-muted">
          {t("deleteMsg", { name: customer.name })}
        </p>
      </div>
      {error ? (
        <p role="alert" className="m-0 mt-2 text-13 text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4.5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="button" variant="destructive" disabled={deleting} onClick={handleConfirm}>
          {t("delete")}
        </Button>
      </div>
    </Dialog>
  );
}
