// ─── SEO sub-pillar · master analysis model ──────────────────────────
// The Title Tags page is the approved master template. This file is the
// contract every SEO sub-pillar fills in: same architecture, own data.
//
// Scores and counts are always read from seo-8pillars.mock.ts — the
// existing Scorelo data model. Nothing here recomputes a score.

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Status for a row that has no issue. */
export const HEALTHY = 'Healthy' as const;

/** An issue type is the sub-pillar's own vocabulary, e.g. "Too Long". */
export type IssueType = string;
export type RowStatus = IssueType | typeof HEALTHY;

export const severityRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const severityLabel: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// ─── Findings ────────────────────────────────────────────────────────
export interface SubPillarFinding {
  id: string;
  /** Must match the `status` used by its evidence rows. */
  issueType: IssueType;
  title: string;
  severity: Severity;
  affected: number;
  /** Qualitative — Scorelo does not model per-issue point values. */
  impact: 'High' | 'Medium' | 'Low';
  effort: 'High' | 'Medium' | 'Low';
  whatIsWrong: string;
  whyItMatters: string;
  recommendation: string;
}

// ─── Evidence ────────────────────────────────────────────────────────
export type CellValue = string | number | null;

export interface EvidenceColumn {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  /**
   * mono     → monospace muted (URLs, handles)
   * text     → normal cell
   * muted    → small muted text
   * number   → tabular numerals
   * status   → the row's issue type
   * severity → severity badge derived from the row's status
   * action   → "Investigate" button
   */
  variant?: 'mono' | 'text' | 'muted' | 'number' | 'status' | 'severity' | 'action';
  /** Optional second line rendered under the main value. */
  subKey?: string;
  /** Shown instead of an empty value. */
  emptyText?: string;
  /** Max width utility for long text cells. */
  clamp?: string;
}

export interface EvidenceRow {
  id: string;
  /** An issue type from `findings`, or HEALTHY. */
  status: RowStatus;
  cells: Record<string, CellValue>;
  /** Secondary filter value (page type, format, schema type…). */
  facet?: string;
  /** Before/after pair rendered in the investigation drawer. */
  current?: { label: string; value: string; meta?: string };
  suggested?: { label: string; value: string };
  /** Extra context line in the drawer, e.g. "Collides with /x". */
  note?: string;
}

export interface SortOption {
  key: string;
  label: string;
  /** Comparator over evidence rows. */
  compare: (a: EvidenceRow, b: EvidenceRow) => number;
}

export interface EvidenceConfig {
  /** Heading shown above the table. */
  title: string;
  caption: string;
  searchPlaceholder: string;
  /** Cell keys included in the free-text search. */
  searchKeys: string[];
  columns: EvidenceColumn[];
  rows: EvidenceRow[];
  /** Secondary dropdown filter. Omit to hide it. */
  facet?: { label: string; allLabel: string; values: string[] };
  sorts: SortOption[];
  /** Noun for the sample line, e.g. "crawled pages". */
  sampleNoun: string;
}

// ─── Totals ──────────────────────────────────────────────────────────
export interface SubPillarTotals {
  score: number;
  analyzed: number;
  healthy: number;
  issues: number;
  critical: number;
  /** Labels so each sub-pillar speaks its own language. */
  analyzedLabel: string;
  healthyLabel: string;
  issuesLabel: string;
  criticalLabel: string;
  /** Small chip under the summary, e.g. "Average length · 58 chars". */
  contextLabel: string;
  contextValue: string;
}

export interface RelatedArea {
  label: string;
  href: string;
  hint: string;
}

export interface SubPillarAnalysis {
  slug: string;
  title: string;
  description: string;
  /** Sentence under the status, written per sub-pillar. */
  summary: string;
  /** Chip beside the status, e.g. "94.5% healthy". */
  healthChip: string;
  totals: SubPillarTotals;
  findings: SubPillarFinding[];
  evidence: EvidenceConfig;
  relatedAreas: RelatedArea[];
  lastAnalyzed: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
export const isIssueStatus = (status: RowStatus): boolean => status !== HEALTHY;

/** Severity for a row, resolved through the findings list. */
export function severityForStatus(status: RowStatus, findings: SubPillarFinding[]): Severity | 'healthy' {
  if (!isIssueStatus(status)) return 'healthy';
  return findings.find((finding) => finding.issueType === status)?.severity ?? 'low';
}

/** Findings ordered most severe first. */
export const bySeverity = (findings: SubPillarFinding[]): SubPillarFinding[] =>
  [...findings].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

/** Standard sorts every sub-pillar gets. */
export const sortBySeverity = (findings: SubPillarFinding[]): SortOption => ({
  key: 'severity',
  label: 'Sort: severity',
  compare: (a, b) => {
    const rank = (row: EvidenceRow) => {
      const severity = severityForStatus(row.status, findings);
      return severity === 'healthy' ? 99 : severityRank[severity];
    };
    return rank(a) - rank(b);
  },
});

export const sortByCell = (key: string, label: string, direction: 'asc' | 'desc' = 'asc'): SortOption => ({
  key: `${key}-${direction}`,
  label,
  compare: (a, b) => {
    const av = a.cells[key];
    const bv = b.cells[key];
    if (typeof av === 'number' && typeof bv === 'number') return direction === 'asc' ? av - bv : bv - av;
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    return direction === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  },
});

/** Simulated fetch, mirroring dashboard.repository.ts. */
export async function fetchAnalysis(analysis: SubPillarAnalysis): Promise<SubPillarAnalysis> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return analysis;
}
