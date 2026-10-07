"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { Customer } from "@/lib/repository/customer";

const SEARCH_DEBOUNCE_MS = 300;

type DialogState = { mode: "create" } | { mode: "edit"; customer: Customer };

export interface CustomersScreenProps {
  initialItems: Customer[];
  total: number;
  totalAll: number;
  initialQuery: string;
  page: number;
  totalPages: number;
}

export function CustomersScreen({
  initialItems,
  total,
  totalAll,
  initialQuery,
  page,
  totalPages,
}: CustomersScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  const [searchValue, setSearchValue] = useState(initialQuery);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The query value of our own in-flight `router.replace` navigation, so the
  // sync effect below can tell "the server caught up with what we typed"
  // apart from "the URL changed under us" (back/forward, a pasted link) —
  // otherwise a server round-trip can land after further typing and stomp it.
  const pendingQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingQueryRef.current !== null) {
      const matchedOwnNavigation = pendingQueryRef.current === initialQuery;
      pendingQueryRef.current = null;
      if (matchedOwnNavigation) return;
    }
    setSearchValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function navigate(params: { q?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.page && params.page > 1) query.set("page", String(params.page));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingQueryRef.current = value;
      navigate({ q: value });
    }, SEARCH_DEBOUNCE_MS);
  }

  function handlePageChange(nextPage: number) {
    navigate({ q: initialQuery, page: nextPage });
  }

  function handleSaved(_customer: Customer, mode: "create" | "edit") {
    setDialogState(null);
    showToast(mode === "edit" ? t("toastUpdated") : t("toastCreated"));
    router.refresh();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    showToast(t("toastDeleted"));
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-24 font-semibold tracking-heading">{t("customers")}</h2>
          <p className="m-0 text-14 text-fg-muted">{t("custSub")}</p>
        </div>
        <Button onClick={() => setDialogState({ mode: "create" })}>{t("addBtn")}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={searchValue}
          onChange={handleSearchChange}
          placeholder={t("searchPh")}
          aria-label={t("searchPh")}
          className="max-w-[360px] min-w-[220px] flex-1"
        />
        <span className="text-13 text-fg-muted">{t("count", { shown: total, total: totalAll })}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow header>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("phone")}</TableHead>
            <TableHead>{t("company")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead justify="end">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <div className="flex flex-col items-center gap-1.5 py-12 text-center">
                  <div className="text-14 font-medium">{t("emptyTitle")}</div>
                  <div className="text-13 text-fg-muted">{t("emptySub")}</div>
                </div>
              </TableCell>
            </TableRow>
          ) : null}
          {initialItems.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <div className="font-medium">{customer.name}</div>
                <div className="text-13 text-fg-muted">{customer.email}</div>
              </TableCell>
              <TableCell className="font-mono text-13">
                <span dir="ltr" className="whitespace-nowrap">
                  {customer.phone}
                </span>
              </TableCell>
              <TableCell>{customer.company}</TableCell>
              <TableCell>
                <Badge tone={customer.status}>{t(customer.status)}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDialogState({ mode: "edit", customer })}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    variant="destructive-ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(customer)}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-13 text-fg-muted">
            {t("pageOf", { page, totalPages })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              {t("prevPage")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              {t("nextPage")}
            </Button>
          </div>
        </div>
      ) : null}

      {dialogState ? (
        <CustomerFormDialog
          key={dialogState.mode === "edit" ? dialogState.customer.id : "create"}
          open
          mode={dialogState.mode}
          customer={dialogState.mode === "edit" ? dialogState.customer : undefined}
          onClose={() => setDialogState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          customer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  );
}
