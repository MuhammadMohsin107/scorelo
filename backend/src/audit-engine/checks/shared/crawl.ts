import { unavailableResult, type SubPillarResult } from '../../types.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import type { CrawledPage, StorefrontCrawl } from '../../storefront/types.js';

/**
 * ─── Crawl evidence guard ────────────────────────────────────────────
 * The one place a check asks "do I have rendered-page evidence?".
 *
 * Every crawl-based check has the same failure modes — crawling switched off, the storefront
 * gated, the storefront unreachable — and every one of them must resolve to `not measured`, never
 * to a zero. Writing that per check would mean nine chances to get it subtly wrong, and the wrong
 * version scores a store 0 for something Scorelo simply could not look at.
 *
 * The reasons are phrased for a merchant reading a pillar page, because that is where they land.
 */

const REASONS: Record<string, (subject: string) => string> = {
  disabled: (subject) => `Storefront crawling is switched off for this Scorelo instance, so ${subject} could not be measured.`,
  password_gated: (subject) => `Your storefront is password protected, so Scorelo could not load any of your pages and ${subject} could not be measured. Remove the password under Online Store → Preferences in Shopify, then run the audit again.`,
  unreachable: (subject) => `Scorelo could not load any page of your storefront, so ${subject} could not be measured.`,
  no_targets: (subject) => `Scorelo found no published storefront pages to load, so ${subject} could not be measured.`,
};

/** Present only when there IS rendered evidence to reason about. */
export interface CrawlEvidence {
  crawl: StorefrontCrawl;
  pages: CrawledPage[];
}

/**
 * Returns the crawl evidence, or the `unavailable` result the check should return instead.
 *
 * `subject` completes the sentence "… so {subject} could not be measured", e.g. "structured data".
 */
export function requireCrawl(
  snapshot: StoreSnapshot,
  subPillar: string,
  subject: string,
): { ok: true; evidence: CrawlEvidence } | { ok: false; result: SubPillarResult } {
  const crawl = snapshot.crawl;

  if (!crawl) {
    return { ok: false, result: unavailableResult(subPillar, REASONS.disabled(subject)) };
  }
  if (!crawl.available || crawl.pages.length === 0) {
    const reason = crawl.unavailableReason ?? 'unreachable';
    const build = REASONS[reason] ?? REASONS.unreachable;
    return { ok: false, result: unavailableResult(subPillar, build(subject)) };
  }

  return { ok: true, evidence: { crawl, pages: crawl.pages } };
}

/**
 * Sentence describing how much of the store the crawl actually covered.
 *
 * Appended to every crawl check's summary, because a result drawn from 12 sampled pages must
 * never read as though it described the whole catalogue. Stating the sample IS the honesty.
 */
export function crawlScopeNote(crawl: StorefrontCrawl): string {
  const byType = new Map<string, number>();
  for (const page of crawl.pages) byType.set(page.pageType, (byType.get(page.pageType) ?? 0) + 1);
  const breakdown = [...byType.entries()].map(([type, count]) => `${count} ${type}`).join(', ');
  const failed = crawl.failures.length > 0 ? ` ${crawl.failures.length} page(s) could not be loaded.` : '';
  return `Measured from ${crawl.pages.length} storefront page(s) Scorelo loaded (${breakdown}).${failed}`;
}

/** A short label for one crawled page, for evidence rows. */
export function pageLabel(page: CrawledPage): string {
  if (page.pageType === 'home') return 'Homepage';
  try {
    return new URL(page.finalUrl).pathname;
  } catch {
    return page.finalUrl;
  }
}
