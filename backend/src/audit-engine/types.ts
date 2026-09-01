import type { StoreSnapshot } from './store-data/types.js';

export type PillarKey = 'seo' | 'content' | 'speed' | 'cro' | 'ai-discovery';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A check's outcome status. `unavailable` MUST stay distinguishable from a passing score:
 * "we could not measure this" is never presented as "this is fine" (master prompt: DATA HONESTY).
 */
export type CheckStatus = 'ok' | 'unavailable';

export interface SubPillarEvidenceRow {
  id: string;
  status: string;
  facet?: string;
  cells: Record<string, unknown>;
  current?: { label: string; value: string; meta?: string };
  suggested?: { label: string; value: string; meta?: string };
}

export interface SubPillarFindingResult {
  title: string;
  severity: Severity;
  affectedCount: number;
  affectedLabel: string;
  impact: string;
  scoreLift: number;
  resolutionType?: string | null;
  problem: string;
  why: string;
  recommendation: string;
  /** Human-readable evidence bullets shown in the Fix Center / investigation drawer. */
  evidence: string[];
  /** Structured rows naming the exact affected resources, so a customer can always answer
   * "which of my products caused this?" (master prompt: EVIDENCE). */
  evidenceRows?: SubPillarEvidenceRow[];
  details: { issueType: string; effort: 'High' | 'Medium' | 'Low' };
}

export interface SubPillarResult {
  subPillar: string;
  status: CheckStatus;
  score: number;
  analyzedCount: number;
  healthyCount: number;
  details: {
    status: CheckStatus;
    /** Present when status is 'unavailable' — states plainly why it could not be measured. */
    unavailableReason?: string;
    summary: string;
    healthChip: string;
    contextLabel: string;
    contextValue: string;
    /**
     * The row status this check uses to mean "nothing wrong here".
     *
     * Each sub-pillar names its own healthy state — 'Lean' theme assets, 'Optimized' images,
     * 'Unique' copy — so a consumer cannot tell a good row from a bad one by looking for the
     * literal word 'Healthy'. Omit only when this check genuinely uses 'Healthy'.
     */
    healthyStatus?: string;
    evidenceRows: SubPillarEvidenceRow[];
  };
  findings: SubPillarFindingResult[];
}

/**
 * The single contract every audit check implements (master prompt: CHECK CONTRACT).
 * Checks are pure functions of a normalized snapshot — no Shopify calls, no DB access,
 * no React coupling — which is what makes them unit-testable in isolation.
 */
export interface AuditCheck {
  /** Stable identifier, e.g. 'seo.title-tags'. */
  id: string;
  pillar: PillarKey;
  /** Route slug matching pillarMeta.ts, e.g. 'title-tags'. */
  subPillar: string;
  execute(snapshot: StoreSnapshot): Promise<SubPillarResult> | SubPillarResult;
}

/** Builds the standard result for a check that genuinely could not measure anything. */
export function unavailableResult(subPillar: string, reason: string): SubPillarResult {
  return {
    subPillar,
    status: 'unavailable',
    // Score is meaningless here; the UI must render the status, not this number.
    score: 0,
    analyzedCount: 0,
    healthyCount: 0,
    details: {
      status: 'unavailable',
      unavailableReason: reason,
      summary: reason,
      healthChip: 'Unavailable',
      contextLabel: '',
      contextValue: '',
      evidenceRows: [],
    },
    findings: [],
  };
}
