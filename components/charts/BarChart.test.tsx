import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BarChart } from "./BarChart";
import type { MonthlyBucket } from "@/lib/repository/customer";

const MONTHLY_FIXTURE: MonthlyBucket[] = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, "0")}`,
  count: i,
}));

describe("BarChart (real-data path)", () => {
  it("renders one bar per monthly bucket from the repository's rollup", () => {
    const { container } = render(
      <BarChart
        counts={MONTHLY_FIXTURE.map((m) => m.count)}
        labels={MONTHLY_FIXTURE.map((_, i) => String(i))}
        tooltipSuffix="new customers"
      />,
    );

    const bars = container.querySelectorAll("[title$='new customers']");
    expect(bars).toHaveLength(12);
  });

  it("forces the numeric axis to ltr", () => {
    const { container } = render(
      <div dir="rtl">
        <BarChart counts={[1, 2, 3]} labels={["أ", "ب", "ج"]} tooltipSuffix="عميل جديد" />
      </div>,
    );
    const axes = container.querySelectorAll('[dir="ltr"]');
    expect(axes.length).toBeGreaterThanOrEqual(2);
  });
});
