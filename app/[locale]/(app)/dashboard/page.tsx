import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { BarChart } from "@/components/charts/BarChart";
import { Donut } from "@/components/charts/Donut";
import { AreaChart } from "@/components/charts/AreaChart";
import { RegionBars } from "@/components/charts/RegionBars";
import { customerRepository } from "@/lib/repository/customer";
import { monthLabelForBucket } from "@/lib/chart-math";
import { REGION_SHARE, REVENUE_HEADLINE, REVENUE_MONTHLY } from "@/lib/demo-data";

export default async function DashboardPage() {
  const t = await getTranslations();
  // Stat cards, bar chart, and donut: a real rollup over `Customer` rows —
  // same shape `/api/dashboard/stats` returns to external callers, read
  // directly here since this is itself a server-rendered page
  // (interface-contract §3).
  const stats = await customerRepository.stats();

  const monthAbbr = t.raw("monthAbbr") as string[];
  const monthLabels = stats.monthly.map((bucket) => monthLabelForBucket(bucket.month, monthAbbr));
  const regionNames = t.raw("regions") as string[];
  const revLabels = (t.raw("revLabels") as string[]).map((l) => ({ l }));
  const regions = REGION_SHARE.map((pct, i) => ({ name: regionNames[i], pct }));

  const statCards = [
    { label: t("total"), value: stats.total },
    { label: t("active"), value: stats.active },
    { label: t("inactive"), value: stats.inactive },
  ];

  return (
    <section className="flex max-w-content flex-col gap-6 p-page">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-24 font-semibold tracking-heading">{t("dashboard")}</h2>
        <p className="m-0 text-14 text-fg-muted">{t("dashSub")}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="flex flex-col gap-2 p-5">
            <div className="text-14 font-medium text-fg-muted">{stat.label}</div>
            <div className="text-30 font-semibold tracking-heading">{stat.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <div className="text-15 font-semibold">{t("newCustomers")}</div>
            <div className="text-13 text-fg-muted">{t("last12")}</div>
          </div>
          <BarChart
            counts={stats.monthly.map((m) => m.count)}
            labels={monthLabels}
            tooltipSuffix={t("newCustomersTip")}
          />
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <div className="text-15 font-semibold">{t("statusSplit")}</div>
            <div className="text-13 text-fg-muted">{t("statusSub")}</div>
          </div>
          <Donut
            activePct={stats.activePct}
            activeCount={stats.active}
            inactiveCount={stats.inactive}
            activeLabel={t("active")}
            inactiveLabel={t("inactive")}
            centerLabel={t("activeLower")}
          />
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="text-15 font-semibold">{t("revenue")}</div>
              <div className="text-13 text-fg-muted">{t("revenueSub")}</div>
            </div>
            <div dir="ltr" className="text-18 font-semibold tracking-heading">
              {REVENUE_HEADLINE}
            </div>
          </div>
          <AreaChart
            values={REVENUE_MONTHLY}
            labels={revLabels.map((x) => x.l)}
            sampleDataLabel={t("sampleDataLabel")}
          />
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <div className="text-15 font-semibold">{t("byRegion")}</div>
            <div className="text-13 text-fg-muted">{t("regionSub")}</div>
          </div>
          <RegionBars regions={regions} sampleDataLabel={t("sampleDataLabel")} />
        </Card>
      </div>

      <div>
        <Link
          href="/customers"
          className="focus-ring inline-flex h-control items-center justify-center rounded-control border border-border bg-surface px-4 text-14 font-medium text-fg hover:bg-border-subtle"
        >
          {t("viewCustomers")}
        </Link>
      </div>
    </section>
  );
}
