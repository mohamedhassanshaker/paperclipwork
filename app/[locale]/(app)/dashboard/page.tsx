import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";

// TODO(TAH-20): replace this placeholder with the real dashboard screen
// (stat cards, new-customers chart, status donut, revenue chart, region
// breakdown). This issue only builds the shell this page renders inside.
export default async function DashboardPage() {
  const t = await getTranslations();

  return (
    <section className="flex max-w-content flex-col gap-6 p-page">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-24 font-semibold tracking-heading">
          {t("dashboard")}
        </h2>
        <p className="m-0 text-14 text-fg-muted">{t("dashSub")}</p>
      </div>
      <Card className="p-5 text-14 text-fg-muted">Dashboard screen — TAH-20</Card>
    </section>
  );
}
