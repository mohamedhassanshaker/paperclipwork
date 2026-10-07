import { donutConicGradient } from "@/lib/chart-math";

export interface DonutProps {
  activePct: number;
  activeCount: number;
  inactiveCount: number;
  activeLabel: string;
  inactiveLabel: string;
  centerLabel: string;
}

export function Donut({
  activePct,
  activeCount,
  inactiveCount,
  activeLabel,
  inactiveLabel,
  centerLabel,
}: DonutProps) {
  const background = donutConicGradient(activePct, "var(--color-primary)", "var(--color-border)");

  return (
    <div className="flex flex-1 flex-wrap items-center gap-7">
      <div
        style={{ background }}
        className="grid size-donut-outer place-items-center rounded-pill"
      >
        <div className="grid size-donut-inner place-items-center rounded-pill bg-surface">
          <div className="text-26 font-semibold tracking-heading">{activePct}%</div>
          <div className="text-12 text-fg-muted">{centerLabel}</div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 text-14">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-swatch bg-primary" />
          {activeLabel}
          <span className="ms-2 text-fg-muted">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-swatch bg-border" />
          {inactiveLabel}
          <span className="ms-2 text-fg-muted">{inactiveCount}</span>
        </div>
      </div>
    </div>
  );
}
