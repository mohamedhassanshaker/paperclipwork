// Sample data for the two dashboard cards with no backing data model
// (ADR-001 §3): monthly revenue and region breakdown. There is no revenue or
// region field on `Customer`, and inventing one is out of scope for a micro
// CRM — this is recorded, deliberate technical debt, not an oversight.
// Every consumer of this module must render the "Sample data" marker
// (`t("sampleDataLabel")`) alongside it. Values are lifted from the prototype.

export const REVENUE_HEADLINE = "$244.2k";

/** USD, last 12 months, oldest first — matches the prototype's own figures. */
export const REVENUE_MONTHLY: readonly number[] = [
  14.2, 15.8, 17.1, 16.4, 18.9, 19.6, 21.3, 20.8, 22.9, 24.1, 25.7, 27.4,
];

/** Share of total accounts by region, oldest-prototype figures, sums to 100. */
export const REGION_SHARE: readonly number[] = [38, 24, 16, 12, 10];
