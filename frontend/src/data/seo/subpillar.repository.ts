import { api, ApiError } from '../../lib/api';
import { sortBySeverity, type EvidenceRow, type SubPillarAnalysis, type SubPillarFinding } from './subpillar.model';

interface LiveSubPillarData {
  slug: string;
  summary: string;
  healthChip: string;
  totals: { score: number; analyzed: number; healthy: number; issues: number; critical: number; contextLabel: string; contextValue: string };
  findings: SubPillarFinding[];
  evidenceRows: EvidenceRow[];
  healthyStatus?: string;
  lastAnalyzed: string;
  status?: 'ok' | 'unavailable';
  unavailableReason?: string | null;
}

function formatLastAnalyzed(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * SEO analyses use a bare route slug ('title-tags'); generic pillars use a
 * pillar-prefixed route key ('speed/cwv'). Both resolve to the same endpoint
 * shape: /audits/latest/:pillar/:subPillar with a bare sub-pillar slug.
 */
function endpointFor(slug: string): { pillar: string; subPillar: string } {
  const separator = slug.indexOf('/');
  if (separator > 0) return { pillar: slug.slice(0, separator), subPillar: slug.slice(separator + 1) };
  return { pillar: 'seo', subPillar: slug };
}

/**
 * Resolves a sub-pillar's full `SubPillarAnalysis`. `base` supplies the static
 * presentation config (title/description/relatedAreas/evidence columns+facet+
 * searchKeys — everything that doesn't change per audit). The data fields
 * (totals/findings/evidence.rows/summary/healthChip/lastAnalyzed) come from
 * the backend; `evidence.sorts` is rebuilt with the real findings since
 * `sortBySeverity` closes over them.
 */
/**
 * True when the failure means this store has not been audited yet, rather than something being
 * broken. The backend distinguishes them by code; without this the pages render "Unable to load"
 * for every brand-new store, which reads as a fault when nothing has been measured.
 */
export function isNotAuditedYet(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ['AUDIT_NOT_FOUND', 'AUDITS_NOT_FOUND', 'SUB_PILLAR_NOT_FOUND'].includes(error.code ?? '')
  );
}

export async function fetchSubPillarAnalysis(base: SubPillarAnalysis): Promise<SubPillarAnalysis> {
  const { pillar, subPillar } = endpointFor(base.slug);
  const data = await api.get<LiveSubPillarData>(`/audits/latest/${pillar}/${subPillar}`);

  return {
    ...base,
    summary: data.summary,
    healthChip: data.healthChip,
    totals: {
      ...base.totals,
      score: data.totals.score,
      analyzed: data.totals.analyzed,
      healthy: data.totals.healthy,
      issues: data.totals.issues,
      critical: data.totals.critical,
      contextLabel: data.totals.contextLabel,
      contextValue: data.totals.contextValue,
    },
    findings: data.findings,
    evidence: {
      ...base.evidence,
      rows: data.evidenceRows,
      healthyStatus: data.healthyStatus,
      sorts: [sortBySeverity(data.findings, data.healthyStatus), ...base.evidence.sorts],
    },
    lastAnalyzed: formatLastAnalyzed(data.lastAnalyzed),
    status: data.status ?? 'ok',
    unavailableReason: data.unavailableReason ?? null,
  };
}
