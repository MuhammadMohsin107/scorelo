import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import { formatCount, takeEvidenceSample } from './page-inventory.js';

/**
 * ─── SEO · Handles & redirects ───────────────────────────────────────
 * Scores the shop's URL redirect records: self-redirects, redirect chains (A→B where B→C also
 * exists) and redirect loops — each verified against the REAL UrlRedirect list, never inferred.
 *
 * The provider attempts `urlRedirects` on every snapshot. Until the app is granted
 * `read_online_store_navigation` (and the merchant re-authenticates), Shopify denies the field
 * and this check reports exactly that — the moment access exists, the same audit produces real
 * results with no code change.
 */

const HEALTHY = 'Healthy';
const CHAIN = 'Redirect Chain';
const LOOP = 'Redirect Loop';
const SELF = 'Self Redirect';

const normalizePath = (value: string) => {
  try {
    // Targets may be absolute URLs; paths are site-relative. Compare on pathname.
    return value.startsWith('http') ? new URL(value).pathname.replace(/\/$/, '') || '/' : (value.replace(/\/$/, '') || '/');
  } catch {
    return value;
  }
};

export const handlesRedirectsCheck: AuditCheck = {
  id: 'seo.handles-redirects',
  pillar: 'seo',
  subPillar: 'handles-redirects',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    const redirects = snapshot.redirects;
    if (!redirects.available) {
      return unavailableResult(
        'handles-redirects',
        redirects.reason === 'scope'
          ? 'Reading URL redirects needs the read_online_store_navigation permission, which Scorelo has not been granted for this store. Grant it (the app will ask you to re-approve) and re-run the audit.'
          : `URL redirects could not be read: ${redirects.detail}`,
      );
    }
    if (redirects.items.length === 0) {
      return unavailableResult('handles-redirects', 'This store has no URL redirects configured, so there is nothing to measure yet.');
    }

    const targetByPath = new Map(redirects.items.map((r) => [normalizePath(r.path), normalizePath(r.target)]));
    const counts: Record<string, number> = { [HEALTHY]: 0, [CHAIN]: 0, [LOOP]: 0, [SELF]: 0 };
    const rows: SubPillarEvidenceRow[] = [];

    for (const redirect of redirects.items) {
      const from = normalizePath(redirect.path);
      const to = normalizePath(redirect.target);
      let status = HEALTHY;
      if (from === to) status = SELF;
      else if (targetByPath.get(to) === from) status = LOOP;
      else if (targetByPath.has(to)) status = CHAIN;
      counts[status] += 1;

      rows.push({
        id: `redirect:${redirect.path}`,
        status,
        facet: status,
        cells: { url: redirect.path, pageType: 'Redirect', title: `→ ${redirect.target}`, length: status === CHAIN ? 2 : 1 },
        current: { label: 'Redirect', value: `${redirect.path} → ${redirect.target}`, meta: status },
      });
    }

    const analyzed = redirects.items.length;
    const healthy = counts[HEALTHY];
    const findings: SubPillarFindingResult[] = [];
    const lift = (n: number) => Math.round((n / analyzed) * 100);

    const cases: Array<[string, 'high' | 'medium', string, string]> = [
      [LOOP, 'high', 'Redirects that loop back on themselves', 'A loop traps both shoppers and crawlers in an endless bounce; browsers eventually show an error page.'],
      [SELF, 'high', 'Redirects pointing at their own path', 'A self-redirect is an infinite redirect for that URL — the page can never load.'],
      [CHAIN, 'medium', 'Redirects that hop through another redirect', 'Each extra hop adds latency and leaks link equity; crawlers give up after a few hops.'],
    ];
    for (const [status, severity, title, why] of cases) {
      if (counts[status] === 0) continue;
      findings.push({
        title,
        severity,
        affectedCount: counts[status],
        affectedLabel: 'redirects',
        impact: severity === 'high' ? 'High' : 'Medium',
        scoreLift: lift(counts[status]),
        resolutionType: 'settings',
        problem: `${formatCount(counts[status])} of the store's redirect records are affected.`,
        why,
        recommendation: 'Point every redirect straight at its final destination and delete the broken ones (Online Store → Navigation → URL Redirects).',
        evidence: [`${formatCount(counts[status])} of ${formatCount(analyzed)} redirect records.`],
        details: { issueType: status, effort: 'Low' },
      });
    }

    return {
      subPillar: 'handles-redirects',
      status: 'ok',
      score: scoreSubPillar(analyzed, healthy, findings),
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: `${formatCount(healthy)} of ${formatCount(analyzed)} URL redirects point cleanly at a final destination.${redirects.truncated ? ' Redirect listing was truncated.' : ''}`,
        healthChip: `${((healthy / analyzed) * 100).toFixed(1)}% healthy`,
        contextLabel: 'Redirect records',
        contextValue: formatCount(analyzed),
        evidenceRows: takeEvidenceSample(rows, HEALTHY),
      },
      findings,
    };
  },
};
