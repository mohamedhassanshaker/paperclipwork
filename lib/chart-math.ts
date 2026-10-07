// Pure chart math, isolated from rendering so it is unit-testable without a
// DOM. Mirrors the prototype's `renderVals()` formulas exactly (visual
// output, not its internal structure — interface-contract / ADR-001 §3).

export function barHeightPercents(counts: readonly number[]): number[] {
  const max = Math.max(1, ...counts);
  return counts.map((count) => Math.round((count / max) * 100));
}

export function donutConicGradient(
  activePct: number,
  activeColor: string,
  inactiveColor: string,
): string {
  const pct = Math.min(100, Math.max(0, activePct));
  return `conic-gradient(${activeColor} 0 ${pct}%, ${inactiveColor} ${pct}% 100%)`;
}

const REVENUE_VIEWBOX_WIDTH = 300;
const REVENUE_VIEWBOX_HEIGHT = 120;
const REVENUE_RANGE_MIN = 10;
const REVENUE_RANGE_MAX = 30;

export function revenueLinePoints(values: readonly number[]): string {
  const n = values.length - 1;
  return values
    .map((v, i) => {
      const x = n > 0 ? (i / n) * REVENUE_VIEWBOX_WIDTH : 0;
      const y =
        REVENUE_VIEWBOX_HEIGHT -
        ((v - REVENUE_RANGE_MIN) / (REVENUE_RANGE_MAX - REVENUE_RANGE_MIN)) * 110;
      return `${x},${y}`;
    })
    .join(" ");
}

export function revenueAreaPoints(values: readonly number[]): string {
  const line = revenueLinePoints(values);
  return `0,${REVENUE_VIEWBOX_HEIGHT} ${line} ${REVENUE_VIEWBOX_WIDTH},${REVENUE_VIEWBOX_HEIGHT}`;
}
