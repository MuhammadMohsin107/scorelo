// ─── Raw backend row shapes ───────────────────────────────────────────
// Mirrors backend/src/db/schema.ts exactly (camelCase, as the API sends
// it) so repository files can map these into the page-facing contracts
// (DashboardData, FixFinding, etc.) without re-declaring the shape.

export interface AuditRow {
  id: number;
  storeId: number;
  overallScore: number;
  runAt: string;
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
  details: unknown;
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
