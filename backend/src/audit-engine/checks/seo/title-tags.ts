import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import { suggestTitle } from '../shared/recommend.js';
import {
  buildPageInventory,
  findDuplicateValues,
  formatCount,
  takeEvidenceSample,
  type InventoryPage,
} from './page-inventory.js';

/**
 * ─── SEO · Title Tags ────────────────────────────────────────────────
 * Scores the title tag of every indexable page (products, collections, pages, articles).
 *
 * WHAT IS ACTUALLY MEASURED
 * The storefront's rendered <title> is not readable through the Admin API, so this check scores
 * the value that determines it: Shopify's SEO title override when set, and otherwise the
 * resource's own title, which is what a stock theme falls back to. That fallback is why a null
 * override is NOT reported as "missing" — the page still renders a title.
 *
 * LENGTH THRESHOLDS (30-60 characters) are an SEO readability heuristic, not a Google ranking
 * rule: Google truncates the displayed title at roughly 600px, so very long titles get cut off in
 * the snippet and very short ones waste the space. The same two constants are used by the
 * frontend's bulk-fix validator (BulkFixWorkflow.tsx) so the audit and the editor never disagree
 * about what "acceptable" means.
 */

/** Keep in step with MIN_TITLE_LENGTH / MAX_TITLE_LENGTH in
 * frontend/src/components/seo/subpillar/BulkFixWorkflow.tsx. */
const MIN_TITLE_LENGTH = 30;
const MAX_TITLE_LENGTH = 60;

const HEALTHY = 'Healthy';
const MISSING = 'Missing';
const TOO_SHORT = 'Too Short';
const TOO_LONG = 'Too Long';
const DUPLICATE = 'Duplicate';

/** The title a search engine will actually see: the override if set, else the resource title. */
function effectiveTitle(page: InventoryPage): string {
  const override = page.seoTitle?.trim();
  if (override) return override;
  return page.title.trim();
}

function classify(title: string, isDuplicate: boolean): string {
  if (!title) return MISSING;
  // Duplication outranks length: two pages competing for the same query is a worse problem than
  // a title being a few characters off, and the merchant should see that first.
  if (isDuplicate) return DUPLICATE;
  if (title.length < MIN_TITLE_LENGTH) return TOO_SHORT;
  if (title.length > MAX_TITLE_LENGTH) return TOO_LONG;
  return HEALTHY;
}

function buildFindings(counts: Record<string, number>, analyzed: number): SubPillarFindingResult[] {
  const findings: SubPillarFindingResult[] = [];

  if (counts[MISSING] > 0) {
    findings.push({
      title: 'Pages with no title tag',
      severity: 'critical',
      affectedCount: counts[MISSING],
      affectedLabel: 'pages',
      impact: 'High',
      // scoreLift is the points this sub-pillar would regain if every affected page were fixed.
      // Derived from the real ratio, never a guessed constant.
      scoreLift: Math.round((counts[MISSING] / analyzed) * 100),
      resolutionType: 'content',
      problem: `${formatCount(counts[MISSING])} pages render with no title text at all.`,
      why: 'A page with no title gives search engines nothing to display or rank. Browsers and search results fall back to the bare URL, which almost never earns a click.',
      recommendation: 'Give every affected page a descriptive title of 30-60 characters that names the product or topic.',
      evidence: [`${formatCount(counts[MISSING])} of ${formatCount(analyzed)} pages have an empty title.`],
      details: { issueType: MISSING, effort: 'Medium' },
    });
  }

  if (counts[DUPLICATE] > 0) {
    findings.push({
      title: 'Duplicate title tags',
      severity: 'high',
      affectedCount: counts[DUPLICATE],
      affectedLabel: 'pages',
      impact: 'High',
      scoreLift: Math.round((counts[DUPLICATE] / analyzed) * 100),
      resolutionType: 'content',
      problem: `${formatCount(counts[DUPLICATE])} pages share a title with at least one other page.`,
      why: 'When several pages carry the same title, search engines cannot tell them apart and typically pick one to show while suppressing the rest, so the others lose their own visibility.',
      recommendation: 'Make each title unique — add the variant, category or model that distinguishes the page from its siblings.',
      evidence: [`${formatCount(counts[DUPLICATE])} of ${formatCount(analyzed)} pages use a non-unique title.`],
      details: { issueType: DUPLICATE, effort: 'Medium' },
    });
  }

  if (counts[TOO_LONG] > 0) {
    findings.push({
      title: 'Title tags over the display limit',
      severity: 'medium',
      affectedCount: counts[TOO_LONG],
      affectedLabel: 'pages',
      impact: 'Medium',
      scoreLift: Math.round((counts[TOO_LONG] / analyzed) * 100),
      resolutionType: 'content',
      problem: `${formatCount(counts[TOO_LONG])} titles are longer than ${MAX_TITLE_LENGTH} characters.`,
      why: `Search results truncate long titles, so the end of the title — often the part that distinguishes the page — is replaced with an ellipsis and never read.`,
      recommendation: `Trim these titles to ${MAX_TITLE_LENGTH} characters or fewer, keeping the most distinctive words first.`,
      evidence: [`${formatCount(counts[TOO_LONG])} of ${formatCount(analyzed)} titles exceed ${MAX_TITLE_LENGTH} characters.`],
      details: { issueType: TOO_LONG, effort: 'Low' },
    });
  }

  if (counts[TOO_SHORT] > 0) {
    findings.push({
      title: 'Title tags under the recommended length',
      severity: 'low',
      affectedCount: counts[TOO_SHORT],
      affectedLabel: 'pages',
      impact: 'Low',
      scoreLift: Math.round((counts[TOO_SHORT] / analyzed) * 100),
      resolutionType: 'content',
      problem: `${formatCount(counts[TOO_SHORT])} titles are shorter than ${MIN_TITLE_LENGTH} characters.`,
      why: 'A very short title leaves most of the available space in the search snippet unused and usually omits the terms a shopper would actually search for.',
      recommendation: `Expand these to at least ${MIN_TITLE_LENGTH} characters by adding the category, key attribute or brand.`,
      evidence: [`${formatCount(counts[TOO_SHORT])} of ${formatCount(analyzed)} titles are under ${MIN_TITLE_LENGTH} characters.`],
      details: { issueType: TOO_SHORT, effort: 'Low' },
    });
  }

  return findings;
}

export const titleTagsCheck: AuditCheck = {
  id: 'seo.title-tags',
  pillar: 'seo',
  subPillar: 'title-tags',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    const { pages, gaps } = buildPageInventory(snapshot);

    // Nothing readable at all -> 'unavailable', never a zero. A zero here would claim we looked
    // and found every page broken, which is the opposite of what happened.
    if (pages.length === 0) {
      const reason = gaps.missingGroups.length > 0
        ? `Scorelo could not read ${gaps.missingGroups.join(', ')} from this store, so titles could not be checked.`
        : 'This store has no products, collections, pages or articles to check.';
      return unavailableResult('title-tags', reason);
    }

    const duplicated = findDuplicateValues(pages.map((page) => ({ id: page.id, value: effectiveTitle(page) })));

    const counts: Record<string, number> = { [MISSING]: 0, [TOO_SHORT]: 0, [TOO_LONG]: 0, [DUPLICATE]: 0, [HEALTHY]: 0 };
    const rows: SubPillarEvidenceRow[] = [];
    let totalLength = 0;

    for (const page of pages) {
      const title = effectiveTitle(page);
      const status = classify(title, duplicated.has(title.toLowerCase()));
      counts[status] += 1;
      totalLength += title.length;

      // Deterministic recommendation from the page's own text — null (omitted) when no rule
      // can produce a defensible value, e.g. duplicates. See checks/shared/recommend.ts.
      const suggestion = status === TOO_LONG || status === TOO_SHORT
        ? suggestTitle(title, snapshot.shop.name, MIN_TITLE_LENGTH, MAX_TITLE_LENGTH)
        : null;

      rows.push({
        id: page.id,
        status,
        facet: page.facet,
        cells: {
          url: page.url,
          pageType: page.facet,
          title,
          length: title.length,
        },
        current: {
          label: 'Current title',
          value: title,
          meta: `${title.length} characters · ${page.facet}`,
        },
        ...(suggestion ? { suggested: { label: 'Suggested title', value: suggestion, meta: `${suggestion.length} characters` } } : {}),
      });
    }

    const analyzed = pages.length;
    const healthy = counts[HEALTHY];
    const findings = buildFindings(counts, analyzed);
    const score = scoreSubPillar(analyzed, healthy, findings);
    const averageLength = Math.round(totalLength / analyzed);
    const healthPercent = ((healthy / analyzed) * 100).toFixed(1);

    const summaryParts = [
      `${formatCount(healthy)} of ${formatCount(analyzed)} pages have a title in the ${MIN_TITLE_LENGTH}-${MAX_TITLE_LENGTH} character range.`,
    ];
    if (analyzed - healthy > 0) summaryParts.push(`${formatCount(analyzed - healthy)} need attention.`);
    if (counts[MISSING] > 0) summaryParts.push(`${formatCount(counts[MISSING])} have no title at all.`);
    // Be explicit when part of the store was unreadable, so the numbers are never mistaken for
    // a full-store result.
    if (gaps.missingGroups.length > 0) summaryParts.push(`${gaps.missingGroups.join(', ')} could not be read and are excluded.`);
    if (snapshot.scope.productsTruncated) summaryParts.push(`Product scan was capped at ${formatCount(snapshot.scope.productLimit)} products.`);

    return {
      subPillar: 'title-tags',
      status: 'ok',
      score,
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: summaryParts.join(' '),
        healthChip: `${healthPercent}% healthy`,
        contextLabel: 'Average length',
        contextValue: `${averageLength} chars`,
        evidenceRows: takeEvidenceSample(rows, HEALTHY),
      },
      findings,
    };
  },
};
