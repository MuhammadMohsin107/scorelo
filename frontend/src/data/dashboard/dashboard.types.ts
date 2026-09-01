// ─── Dashboard contracts ─────────────────────────────────────────────
// The page-facing shapes that data/dashboard/dashboard.repository.ts assembles from the API.
//
// This file previously also exported `dashboardMockData`, a ~256-line fixture that nothing
// imported and whose SEO sub-pillar ids had drifted out of date ('alt-text', 'handles' instead
// of the real 'image-alt-text', 'handles-redirects'). Anyone wiring it up for a demo would have
// got broken sub-pillar links, so it has been removed rather than corrected.

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type PillarKey = 'seo' | 'content' | 'speed' | 'cro' | 'ai-discovery';
/** `not-measured` is deliberately NOT a score band. It means the engine produced no measurable
 * result, and it exists so "we could not measure this" can never be rendered as "critical". */
export type ScoreStatus = 'excellent' | 'good' | 'needs-work' | 'critical' | 'not-measured';
export type TrendDirection = 'up' | 'down' | 'stable';

export interface OverallScore {
  score: number;
  status: ScoreStatus;
  statusLabel: string;
  description: string;
  trend: TrendDirection;
  trendValue: number;
  /** False when the audit recorded overallAvailable:false — `score` is then a placeholder and
   * the UI must show a "not measured" state instead of the number or a status band. */
  measured: boolean;
  /** e.g. "2,000 of 10,000 products analyzed · 20% coverage". Null when the audit covered
   * everything, or when the store total could not be read. Shown so a score computed from a
   * partial catalogue is never presented as a whole-store result. */
  coverageNote: string | null;
}

export interface KeyMetric {
  id: string;
  label: string;
  value: number;
  statusLabel?: string;
  suffix?: string;
  trend?: TrendDirection;
  trendValue?: number;
  color: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
}

export interface SubPillar {
  id: string;
  label: string;
}

export interface PillarScore {
  key: PillarKey;
  label: string;
  /**
   * null when this audit produced no measurable result for the pillar — either no check is
   * registered for it yet, or every check it does have reported `unavailable`.
   *
   * The pillar is still present in the list. A pillar that could not be measured must render as
   * "Not analyzed yet", never vanish from the dashboard and never be shown as a real 0.
   */
  score: number | null;
  status: ScoreStatus;
  statusLabel: string;
  description: string;
  icon: string;
  checksTotal: number;
  checksPassed: number;
  subPillars: SubPillar[];
}

export interface PriorityIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  pillar: PillarKey;
  pillarLabel: string;
  actionLabel: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  pillar: PillarKey;
  pillarLabel: string;
  estimatedTime: string;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export interface DashboardData {
  overallScore: OverallScore;
  keyMetrics: KeyMetric[];
  pillars: PillarScore[];
  priorityIssues: PriorityIssue[];
  recommendedActions: RecommendedAction[];
  scoreTrend: ScoreTrendPoint[];
  lastUpdated: string;
  storeName: string;
  storeUrl: string;
}
