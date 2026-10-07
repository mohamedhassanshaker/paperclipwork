import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AreaChart } from "./AreaChart";
import { REVENUE_MONTHLY } from "@/lib/demo-data";

describe("AreaChart (sample-data path)", () => {
  it("renders the sample-data marker so the figures are never mistaken for real metrics", () => {
    render(
      <AreaChart values={REVENUE_MONTHLY} labels={["Oct", "Jan", "Apr", "Jul", "Sep"]} sampleDataLabel="Sample data" />,
    );
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("forces the axis labels to ltr even when rendered under an rtl ancestor", () => {
    const { container } = render(
      <div dir="rtl">
        <AreaChart values={REVENUE_MONTHLY} labels={["أكتوبر", "يناير"]} sampleDataLabel="بيانات تجريبية" />
      </div>,
    );
    const labelsRow = container.querySelector('[dir="ltr"]');
    expect(labelsRow).not.toBeNull();
    expect(labelsRow).toHaveTextContent("أكتوبر");
  });

  it("draws a closed area polygon anchored to the viewBox baseline", () => {
    const { container } = render(
      <AreaChart values={REVENUE_MONTHLY} labels={["Oct"]} sampleDataLabel="Sample data" />,
    );
    const polygon = container.querySelector("polygon");
    expect(polygon?.getAttribute("points")).toMatch(/^0,120 .* 300,120$/);
  });
});
