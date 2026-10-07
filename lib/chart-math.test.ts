import { describe, expect, it } from "vitest";
import {
  barHeightPercents,
  donutConicGradient,
  monthLabelForBucket,
  revenueAreaPoints,
  revenueLinePoints,
} from "./chart-math";

describe("barHeightPercents", () => {
  it("scales each bar relative to the largest count", () => {
    expect(barHeightPercents([10, 20, 5])).toEqual([50, 100, 25]);
  });

  it("does not divide by zero when every count is zero", () => {
    expect(barHeightPercents([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("monthLabelForBucket", () => {
  const monthAbbr = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  it("derives the label from the bucket's calendar month, not its position in the window", () => {
    // A rolling trailing-12 window starting in November means bucket 0 is
    // November, not whatever month would be first if the window started in
    // January — the label must track the real month key.
    expect(monthLabelForBucket("2025-11", monthAbbr)).toBe("N");
    expect(monthLabelForBucket("2026-10", monthAbbr)).toBe("O");
  });

  it("indexes January as the first entry and December as the last", () => {
    expect(monthLabelForBucket("2026-01", monthAbbr)).toBe("J");
    expect(monthLabelForBucket("2026-12", monthAbbr)).toBe("D");
  });
});

describe("donutConicGradient", () => {
  it("builds a conic-gradient stop at the active percentage", () => {
    expect(donutConicGradient(75, "red", "grey")).toBe("conic-gradient(red 0 75%, grey 75% 100%)");
  });

  it("clamps out-of-range percentages", () => {
    expect(donutConicGradient(150, "red", "grey")).toBe("conic-gradient(red 0 100%, grey 100% 100%)");
    expect(donutConicGradient(-10, "red", "grey")).toBe("conic-gradient(red 0 0%, grey 0% 100%)");
  });
});

describe("revenue chart math", () => {
  const values = [10, 20, 30];

  it("maps the first and last point to the viewBox edges", () => {
    const points = revenueLinePoints(values).split(" ");
    expect(points[0].startsWith("0,")).toBe(true);
    expect(points[2].startsWith("300,")).toBe(true);
  });

  it("closes the area polygon at the baseline on both ends", () => {
    const area = revenueAreaPoints(values);
    expect(area.startsWith("0,120 ")).toBe(true);
    expect(area.endsWith(" 300,120")).toBe(true);
  });
});
