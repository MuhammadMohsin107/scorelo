// ─── Raw backend row shapes ───────────────────────────────────────────
// Mirrors backend/src/db/schema.ts exactly (camelCase, as the API sends
// it) so repository files can map these into the page-facing contracts
// (DashboardData, FixFinding, etc.) without re-declaring the shape.

export interface AuditRow {
  id: number;
  storeId: number;
  overallScore: number;
  runAt: string;
  /** Engine metadata written by runner.ts. Absent on seeded/legacy audit rows, which is why
   * every field is optional — consumers must treat a missing value as "unknown", not "false". */
  metadata?: {
    /** FALSE when no pillar produced a measurable result. `overallScore` is then a placeholder
     * zero, NOT a real score, and must never be rendered as one. See runner.ts:83. */
    overallAvailable?: boolean;
    /** How many checks the engine had registered for this run. 0 means nothing was implemented. */
    checksRegistered?: number;
    resourceCounts?: Record<string, number>;
    /** Analysed-vs-available per resource type. See runner.ts persistAudit(). */
    coverageDetail?: Record<string, CoverageDetail>;
    snapshotWarnings?: string[];
  } | null;
}

/** GET /api/reports/trend rows — no storeId, unlike a full AuditRow. */
export interface TrendAuditRow {
  id: number;
  runAt: string;
  overallScore: number;
}

export interface AuditScoreRow {
  id: number;
  auditId: number;
  pillar: string;
  subPillar: string | null;
  score: number;
  checksTotal: number | null;
  checksPassed: number | null;
  analyzedCount: number | null;
  healthyCount: number | null;
  details: AuditScoreDetails | null;
}

/**
 * How much of one resource type the audit actually covered.
 * `available: null` means the store total could not be read — unknown, NOT "same as analysed".
 * `exact: false` means Shopify reported the total as AT_LEAST, so it is a floor, not a figure.
 */
export interface CoverageDetail {
  analyzed: number;
  available: number | null;
  exact: boolean | null;
  truncated: boolean;
}

/** Renders coverage as a short human phrase, or null when there is nothing honest to say. */
export function describeCoverage(detail: CoverageDetail | undefined, noun: string): string | null {
  if (!detail) return null;
  const analyzed = detail.analyzed.toLocaleString('en-US');
  if (detail.available === null) {
    return detail.truncated ? `${analyzed} ${noun} analyzed (catalog total unknown)` : null;
  }
  const available = detail.available.toLocaleString('en-US');
  const prefix = detail.exact === false ? 'at least ' : '';
  if (detail.available <= detail.analyzed && !detail.truncated) return null;
  const percent = detail.available > 0 ? Math.round((detail.analyzed / detail.available) * 100) : 0;
  return `${analyzed} of ${prefix}${available} ${noun} analyzed · ${percent}% coverage`;
}

/** The `details` blob a check writes alongside its score (see SubPillarResult.details). */
export interface AuditScoreDetails {
  /**
   * 'unavailable' means the check ran but could not measure anything (no articles to score, a
   * resource the scopes could not read). `score` is then a NOT-NULL placeholder zero, not a
   * result — rendering it as a score reports a failure that was never measured.
   * Absent on seeded rows, which are genuine measured fixtures, so undefined means 'ok'.
   */
  status?: 'ok' | 'unavailable';
  unavailableReason?: string;
  summary?: string;
  healthChip?: string;
  contextLabel?: string;
  contextValue?: string;
}

/** True when a score row carries a real measurement rather than an unavailable placeholder. */
export function isMeasuredScore(row: Pick<AuditScoreRow, 'details'>): boolean {
  return row.details?.status !== 'unavailable';
}

export interface FindingRow {
  id: number;
  auditId: number;
  pillar: string;
  subPillar: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'reviewed' | 'resolved' | 'ignored';
  resolutionType: string | null;
  affectedCount: number;
  affectedLabel: string;
  impact: string;
  scoreLift: number;
  problem: string | null;
  why: string;
  recommendation: string;
  evidence: string[];
  evidenceRows: unknown;
  statusChangedAt: string | null;
}

export interface JobRow {
  id: number;
  storeId: number;
  type: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  error: string | null;
  auditId: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface IntegrationRow {
  id: number;
  storeId: number;
  provider: string;
  status: 'connected' | 'needs_attention' | 'not_connected';
  accountDetail: string | null;
  lastSyncedAt: string | null;
  notice: string | null;
}

export interface UserRow {
  id: number;
  fullName: string;
  email: string;
  jobTitle: string | null;
  role: string;
  notifyAnalysisComplete: boolean;
  notifyCriticalIssues: boolean;
  notifyScoreChanges: boolean;
  notifyWeeklySummary: boolean;
  notifyIntegrationAlerts: boolean;
  notifyProductUpdates: boolean;
  density: 'Comfortable' | 'Compact';
  reduceMotion: boolean;
}

export interface StoreRow {
  id: number;
  workspaceName: string;
  name: string;
  url: string;
  platform: string;
  industry: string;
  country: string;
  timezone: string;
  currency: string;
  autoAnalysis: boolean;
  analysisFrequency: string;
  crawlScope: string;
  pageLimit: number;
  includeBlog: boolean;
  includeCollections: boolean;
  respectRobots: boolean;
}
