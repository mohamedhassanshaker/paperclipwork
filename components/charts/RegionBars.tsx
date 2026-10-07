import { SampleDataBadge } from "./SampleDataBadge";

export interface RegionBarsProps {
  regions: readonly { name: string; pct: number }[];
  sampleDataLabel: string;
}

export function RegionBars({ regions, sampleDataLabel }: RegionBarsProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex justify-end">
        <SampleDataBadge label={sampleDataLabel} />
      </div>
      {regions.map((region) => (
        <div key={region.name} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-13">
            <span>{region.name}</span>
            <span className="text-fg-muted">{region.pct}%</span>
          </div>
          <div className="h-progress overflow-hidden rounded-pill bg-border-subtle">
            <div
              style={{ width: `${region.pct}%` }}
              className="h-full rounded-pill bg-primary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
