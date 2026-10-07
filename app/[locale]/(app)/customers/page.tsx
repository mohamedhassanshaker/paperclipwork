import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";

// TODO(TAH-20): replace this placeholder with the real customers screen
// (searchable table, create/edit dialog, delete confirmation, toast). This
// issue only builds the shell this page renders inside.
export default async function CustomersPage() {
  const t = await getTranslations();

  return (
    <section className="flex max-w-content flex-col gap-5 p-page">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-24 font-semibold tracking-heading">
          {t("customers")}
        </h2>
        <p className="m-0 text-14 text-fg-muted">{t("custSub")}</p>
      </div>
      <Card className="p-5 text-14 text-fg-muted">Customers screen — TAH-20</Card>
    </section>
  );
}
