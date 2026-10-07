import { barHeightPercents } from "@/lib/chart-math";

export interface BarChartProps {
  counts: readonly number[];
  /** Calendar-derived from each bucket's `month` key, not a fixed positional array (interface-contract §3). */
  labels: readonly string[];
  tooltipSuffix: string;
}

export function BarChart({ counts, labels, tooltipSuffix }: BarChartProps) {
  const heights = barHeightPercents(counts);

  return (
    <div className="flex flex-col gap-0">
      {/* Numeric axis — forced ltr even in Arabic (interface-contract §5.5). */}
      <div dir="ltr" className="flex h-barchart items-end gap-2 border-b border-border">
        {counts.map((count, i) => (
          <div
            key={i}
            title={`${count} ${tooltipSuffix}`}
            style={{ height: `${Math.max(heights[i], 1)}%` }}
            className="min-h-[4px] flex-1 rounded-bar bg-primary hover:bg-primary-hover"
          />
        ))}
      </div>
      <div dir="ltr" className="-mt-2 flex gap-2">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center text-11 text-fg-muted">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
