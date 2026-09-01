import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import { buildPageInventory, formatCount, takeEvidenceSample } from './page-inventory.js';

/**
 * ─── SEO · Canonicals & duplicates ───────────────────────────────────
 * Scores the DUPLICATE-CONTENT half of this sub-pillar from Admin data that is real today:
 * handle collisions across the catalogue.
 *
 * WHY HANDLES: when a merchant creates a resource whose handle is taken, Shopify silently
 * appends `-1`, `-2`, … — and each suffixed handle is almost always a duplicated or re-created
 * page competing with its original for the same query. Detecting the `-N` family is therefore
 * a direct, evidence-backed duplicate-content signal, not an inference.
 *
 * The CANONICAL-TAG half (`<link rel="canonical">` as actually rendered) requires fetching
 * page HTML. While the storefront is password-protected that is impossible, and the summary
 * says exactly that instead of pretending tags were verified.
 */

const HEALTHY = 'Healthy';
const SUFFIXED = 'Suffixed Duplicate';
const BASE_OF_SUFFIX = 'Has Duplicates';

export const canonicalsCheck: AuditCheck = {
  id: 'seo.canonicals',
  pillar: 'seo',
  subPillar: 'canonicals',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    const { pages } = buildPageInventory(snapshot);
    if (pages.length === 0) {
      return unavailableResult('canonicals', 'No products, collections, pages or articles could be read, so duplicates could not be checked.');
    }

    // Handle values grouped per resource type — a product and a page may legitimately share a
    // handle (they live under different URL prefixes), so collisions only count within a type.
    const handleOf = (url: string) => url.split('/').filter(Boolean).pop() ?? '';
    const byTypeAndBase = new Map<string, string[]>();
    const parsed = pages.map((page) => {
      const handle = handleOf(page.url);
      const match = handle.match(/^(.*?)-(\d+)$/);
      const base = match ? match[1]! : handle;
      const suffixed = Boolean(match);
      const key = `${page.facet}:${base}`;
      byTypeAndBase.set(key, [...(byTypeAndBase.get(key) ?? []), handle]);
      return { page, handle, base, suffixed, key };
    });

    const counts: Record<string, number> = { [HEALTHY]: 0, [SUFFIXED]: 0, [BASE_OF_SUFFIX]: 0 };
    const rows: SubPillarEvidenceRow[] = [];

    for (const item of parsed) {
      const family = byTypeAndBase.get(item.key) ?? [];
      // A -N handle only signals duplication when its BASE also exists (or siblings share the
      // base): "mark-2-jacket" is a product name, not a duplicate, unless "mark-2-jacket"'s base
      // family has more members.
      const isDuplicateFamily = family.length > 1;
      const status = !isDuplicateFamily ? HEALTHY : item.suffixed ? SUFFIXED : BASE_OF_SUFFIX;
      counts[status] += 1;

      rows.push({
        id: item.page.id,
        status,
        facet: item.page.facet,
        cells: { url: item.page.url, pageType: item.page.facet, title: item.page.title, length: family.length },
        current: {
          label: 'Handle',
          value: item.handle,
          meta: isDuplicateFamily ? `${family.length} handles share the base “${item.base}”` : item.page.facet,
        },
      });
    }

    const analyzed = pages.length;
    const healthy = counts[HEALTHY];
    const duplicates = counts[SUFFIXED] + counts[BASE_OF_SUFFIX];
    const findings: SubPillarFindingResult[] = [];

    if (duplicates > 0) {
      findings.push({
        title: 'Handle families indicating duplicated pages',
        severity: 'high',
        affectedCount: duplicates,
        affectedLabel: 'pages',
        impact: 'High',
        scoreLift: Math.round((duplicates / analyzed) * 100),
        resolutionType: 'content',
        problem: `${formatCount(duplicates)} pages belong to handle families like “name” + “name-1” — the pattern Shopify creates when a resource is duplicated or re-created.`,
        why: 'Each member of the family is a near-identical page competing with its siblings; search engines typically index one and suppress the rest, and which one wins is out of your control without canonical consolidation.',
        recommendation: 'For each family, keep one page, delete or redirect the copies, and let the survivor own the base handle.',
        evidence: [`${formatCount(duplicates)} of ${formatCount(analyzed)} pages are in multi-member handle families.`],
        // This one finding covers BOTH sides of a duplicate family — the suffixed copy and the
        // base it collides with — so its issue type names only half its rows. Listing the rows
        // explicitly is what lets the UI attribute a 'Has Duplicates' row to this finding instead
        // of leaving it with no issue to open.
        evidenceRows: rows.filter((row) => row.status !== HEALTHY),
        details: { issueType: SUFFIXED, effort: 'Medium' },
      });
    }

    const gated = snapshot.storefront?.passwordProtected;
    return {
      subPillar: 'canonicals',
      status: 'ok',
      score: scoreSubPillar(analyzed, healthy, findings),
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: `${formatCount(healthy)} of ${formatCount(analyzed)} pages have a unique handle family. Rendered <link rel="canonical"> tags are NOT verified here — that needs page HTML${gated ? ', which is blocked while the storefront is password-protected' : ' and will be covered by the storefront crawl'}.`,
        healthChip: `${((healthy / analyzed) * 100).toFixed(1)}% healthy`,
        contextLabel: 'Duplicate families',
        contextValue: String(new Set(parsed.filter((i) => (byTypeAndBase.get(i.key) ?? []).length > 1).map((i) => i.key)).size),
        evidenceRows: takeEvidenceSample(rows, HEALTHY),
      },
      findings,
    };
  },
};
