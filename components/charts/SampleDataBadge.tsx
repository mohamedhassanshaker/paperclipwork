// Visible marker for chart cards with no backing data model (ADR-001 §3):
// the revenue and region cards render from `lib/demo-data.ts`, not customer
// rows, and must never look like a real metric.
export function SampleDataBadge({ label }: { label: string }) {
  return (
    <span className="rounded-pill border border-border px-2 py-0.5 text-11 font-normal text-fg-muted">
      {label}
    </span>
  );
}
