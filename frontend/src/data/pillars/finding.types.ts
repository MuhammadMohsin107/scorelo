// ─── Shared finding model used by every pillar ────────────────────────
// A "finding" is one concrete, fixable problem surfaced by the audit.
// It carries a severity, how it gets resolved, what it touches, and how
// many score points fixing it is worth — mirroring Scorelo's audit engine.

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

/** How a finding is resolved. */
export type ResolutionType =
  | 'Automated' // Scorelo can fix it in-place (preview → bulk fix)
  | 'Product' // Install / enable a Scorelo app product
  | 'Service' // Scoped service engagement (quote)
  | 'Integration' // Connect a third-party tool
  | 'Deferred'; // Snoozed / intentionally parked

export interface Finding<AreaKey extends string = string> {
  id: string;
  areaKey: AreaKey;
  /** Short, specific headline, e.g. "23 products missing meta descriptions". */
  title: string;
  severity: FindingSeverity;
  resolution: ResolutionType;
  /** Count of affected resources. */
  affected: number;
  /** Noun for the affected count, e.g. "products", "pages", "images". */
  affectedLabel: string;
  /** Estimated pillar-score lift when resolved. */
  scoreLift: number;
  /** What is wrong, in one or two sentences. */
  problem: string;
  /** Why it matters — the business/impact statement. */
  impact: string;
  /** Primary CTA label, e.g. "Preview & fix", "Request a quote". */
  ctaLabel: string;
  /** Product, service or integration that resolves it (optional). */
  resolvedBy?: string;
}

/** Sum of potential score lift across a set of findings. */
export function potentialLift(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + f.scoreLift, 0);
}

/** Count findings per resolution type (all five keys always present). */
export function resolutionMix(findings: Finding[]): Record<ResolutionType, number> {
  const mix: Record<ResolutionType, number> = { Automated: 0, Product: 0, Service: 0, Integration: 0, Deferred: 0 };
  findings.forEach((f) => {
    mix[f.resolution] += 1;
  });
  return mix;
}
