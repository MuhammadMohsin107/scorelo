import { api } from '../lib/api';
import type { AuditRow, AuditScoreRow, FindingRow, TrendAuditRow } from './api.types';
import { pillarMeta, pillarOrder, scoreToStatus } from './pillarMeta';
import type { PillarKey } from './dashboard/dashboard.mock';

export interface ReportPillar {
  key: PillarKey;
  label: string;
  current: number;
  previous: number;
  status: string;
  color: string;
}

export interface ReportTrendPoint {
  date: string;
  score: number;
}

export interface ReportOverview {
  currentScore: number;
  previousScore: number;
  trend: ReportTrendPoint[];
  pillars: ReportPillar[];
  issuesResolved: number;
  criticalIssues: number;
  findingsTracked: number;
}

interface ReportComparison {
  current: AuditRow;
  previous: AuditRow | null;
  currentScores: AuditScoreRow[];
  previousScores: AuditScoreRow[];
}

export async function fetchReportOverview(): Promise<ReportOverview> {
  const [comparison, trendAudits, findings] = await Promise.all([
    api.get<ReportComparison>('/reports/comparison'),
    api.get<TrendAuditRow[]>('/reports/trend?limit=8'),
    api.get<{ items: FindingRow[] }>('/findings?limit=100'),
  ]);

  const { current, previous, currentScores, previousScores } = comparison;
  const previousByPillar = new Map(previousScores.filter((score) => score.subPillar === null).map((score) => [score.pillar, score.score]));

  const pillars = pillarOrder
    .map((key) => currentScores.find((score) => score.subPillar === null && score.pillar === key))
    .filter((score): score is AuditScoreRow => Boolean(score))
    .map((score) => {
      const key = score.pillar as PillarKey;
      const meta = pillarMeta[key];
      return {
        key, label: meta.label, current: score.score,
        previous: previousByPillar.get(key) ?? score.score,
        status: scoreToStatus(score.score).statusLabel,
        color: meta.color,
      };
    });

  return {
    currentScore: current.overallScore,
    previousScore: previous?.overallScore ?? current.overallScore,
    trend: trendAudits.map((audit) => ({ date: audit.runAt, score: audit.overallScore })),
    pillars,
    issuesResolved: findings.items.filter((finding) => finding.status === 'resolved').length,
    criticalIssues: findings.items.filter((finding) => finding.severity === 'critical' && finding.status !== 'resolved' && finding.status !== 'ignored').length,
    findingsTracked: findings.items.length,
  };
}
