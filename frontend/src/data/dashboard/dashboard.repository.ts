import { api } from '../../lib/api';
import type { AuditRow, AuditScoreRow, FindingRow, StoreRow, TrendAuditRow } from '../api.types';
import { describeOverall, describePillar, pillarMeta, pillarOrder, scoreToStatus } from '../pillarMeta';
import type {
  DashboardData,
  KeyMetric,
  PillarKey,
  PriorityIssue,
  RecommendedAction,
  ScoreTrendPoint,
} from './dashboard.mock';

interface DashboardSummary {
  latest: AuditRow;
  previous: AuditRow | null;
  scores: AuditScoreRow[];
  priorityFindings: FindingRow[];
}

function trendFrom(latest: number, previous: number | null): { trend: 'up' | 'down' | 'stable'; trendValue: number } {
  if (previous === null || latest === previous) return { trend: 'stable', trendValue: 0 };
  return { trend: latest > previous ? 'up' : 'down', trendValue: Math.abs(latest - previous) };
}

function estimatedTimeForSeverity(severity: FindingRow['severity']): string {
  if (severity === 'critical') return '15 min';
  if (severity === 'high') return '20 min';
  if (severity === 'medium') return '30 min';
  return '45 min';
}

function toPriorityIssue(finding: FindingRow): PriorityIssue {
  const pillar = finding.pillar as PillarKey;
  return {
    id: String(finding.id),
    title: finding.title,
    description: finding.problem ?? finding.why,
    severity: finding.severity,
    pillar,
    pillarLabel: pillarMeta[pillar].label,
    actionLabel: finding.severity === 'critical' || finding.severity === 'high' ? 'Fix issue' : 'Review',
  };
}

function toRecommendedAction(finding: FindingRow): RecommendedAction {
  const pillar = finding.pillar as PillarKey;
  return {
    id: `rec-${finding.id}`,
    title: finding.title,
    description: finding.recommendation,
    impact: finding.impact.toLowerCase() as 'high' | 'medium' | 'low',
    pillar,
    pillarLabel: pillarMeta[pillar].label,
    estimatedTime: estimatedTimeForSeverity(finding.severity),
  };
}

/** Fetches real dashboard data: summary + score trend + store identity, assembled into `DashboardData`. */
export async function fetchDashboardData(): Promise<DashboardData> {
  const [summary, trend, store] = await Promise.all([
    api.get<DashboardSummary>('/dashboard/summary'),
    api.get<TrendAuditRow[]>('/reports/trend?limit=6'),
    api.get<StoreRow>('/stores/current'),
  ]);

  const { latest, previous, scores, priorityFindings } = summary;
  const { trend: scoreTrendDir, trendValue } = trendFrom(latest.overallScore, previous?.overallScore ?? null);
  const overallStatus = scoreToStatus(latest.overallScore);

  const pillarScores = scores.filter((score) => score.subPillar === null);
  const pillars = pillarOrder
    .map((key) => pillarScores.find((score) => score.pillar === key))
    .filter((score): score is AuditScoreRow => Boolean(score))
    .map((score) => {
      const key = score.pillar as PillarKey;
      const meta = pillarMeta[key];
      const { status, statusLabel } = scoreToStatus(score.score);
      const checksTotal = score.checksTotal ?? 0;
      const checksPassed = score.checksPassed ?? 0;
      return {
        key, label: meta.label, score: score.score, status, statusLabel,
        description: describePillar(meta.label, score.score, checksTotal, checksPassed),
        icon: meta.icon, checksTotal, checksPassed, subPillars: meta.subPillars,
      };
    });

  const totalChecksPassed = pillarScores.reduce((sum, score) => sum + (score.checksPassed ?? 0), 0);
  const criticalCount = priorityFindings.filter((finding) => finding.severity === 'critical').length;

  const keyMetrics: KeyMetric[] = [
    { id: 'overall-health', label: 'Overall Health', value: latest.overallScore, statusLabel: overallStatus.statusLabel, color: 'success', trend: scoreTrendDir, trendValue },
    { id: 'issues', label: 'Total Issues', value: priorityFindings.length, color: priorityFindings.length > 0 ? 'warning' : 'success' },
    { id: 'critical', label: 'Critical', value: criticalCount, color: 'critical' },
    { id: 'passed', label: 'Passed Checks', value: totalChecksPassed, color: 'success' },
  ];

  const scoreTrend: ScoreTrendPoint[] = trend.map((audit) => ({
    date: audit.runAt.slice(0, 10),
    score: audit.overallScore,
  }));

  const rankedFindings = [...priorityFindings].sort((a, b) => b.scoreLift - a.scoreLift);

  return {
    storeName: store.name,
    storeUrl: store.url,
    lastUpdated: latest.runAt,
    overallScore: {
      score: latest.overallScore,
      status: overallStatus.status,
      statusLabel: overallStatus.statusLabel,
      description: describeOverall(latest.overallScore),
      trend: scoreTrendDir,
      trendValue,
    },
    keyMetrics,
    pillars,
    priorityIssues: priorityFindings.map(toPriorityIssue),
    recommendedActions: rankedFindings.slice(0, 4).map(toRecommendedAction),
    scoreTrend,
  };
}

/**
 * Formats relative time from an ISO date string.
 */
export function formatLastUpdated(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Returns semantic color class prefix for a score status.
 */
export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'success';
  if (score >= 75) return 'brand';
  if (score >= 50) return 'warning';
  return 'critical';
}
