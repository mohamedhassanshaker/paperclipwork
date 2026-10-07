import { revenueAreaPoints, revenueLinePoints } from "@/lib/chart-math";
import { SampleDataBadge } from "./SampleDataBadge";

export interface AreaChartProps {
  values: readonly number[];
  labels: readonly string[];
  sampleDataLabel: string;
}

export function AreaChart({ values, labels, sampleDataLabel }: AreaChartProps) {
  const area = revenueAreaPoints(values);
  const line = revenueLinePoints(values);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <SampleDataBadge label={sampleDataLabel} />
      </div>
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="block h-revenue-chart w-full">
        <line x1="0" y1="30" x2="300" y2="30" stroke="var(--color-border-subtle)" />
        <line x1="0" y1="60" x2="300" y2="60" stroke="var(--color-border-subtle)" />
        <line x1="0" y1="90" x2="300" y2="90" stroke="var(--color-border-subtle)" />
        <polygon points={area} fill="var(--color-primary-area)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {/* Revenue labels — forced ltr even in Arabic (interface-contract §5.5). */}
      <div dir="ltr" className="-mt-2 flex justify-between text-11 text-fg-muted">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}
