// ─── Pillar structural metadata ──────────────────────────────────────
// Navigation structure, icon keys and color tokens for each pillar.
// None of this is audit data — it's the same kind of static UI mapping
// as a notification type→icon lookup — so it stays a frontend catalog
// even after scores/findings move to the database (see schema.ts's own
// "deliberately excluded: UI-only, derived, or placeholder" note).

import type { PillarKey, ScoreStatus, SubPillar } from './dashboard/dashboard.mock';

export interface PillarMeta {
  key: PillarKey;
  label: string;
  icon: string;
  color: string;
  subPillars: SubPillar[];
}

export const pillarMeta: Record<PillarKey, PillarMeta> = {
  seo: {
    key: 'seo',
    label: 'SEO',
    icon: 'search',
    color: '#4f46e5',
    // ids are the ROUTE slugs (/seo/<id>) and the values stored in findings.subPillar.
    subPillars: [
      { id: 'title-tags', label: 'Title tags' },
      { id: 'meta-descriptions', label: 'Meta descriptions' },
      { id: 'schema', label: 'Schema / JSON-LD' },
      { id: 'image-alt-text', label: 'Image alt text' },
      { id: 'canonicals', label: 'Canonicals & duplicates' },
      { id: 'handles-redirects', label: 'Handles & redirects' },
      { id: 'sitemap', label: 'Sitemap & indexability' },
      { id: 'internal-links', label: 'Internal links & 404s' },
    ],
  },
  content: {
    key: 'content',
    label: 'Content',
    icon: 'file-text',
    color: '#f59e0b',
    subPillars: [
      { id: 'product-descriptions', label: 'Product descriptions' },
      { id: 'collection-descriptions', label: 'Collection descriptions' },
      { id: 'metafields', label: 'Metafield completeness' },
      { id: 'dup-templated', label: 'Duplicate/templated copy' },
      { id: 'blog-freshness', label: 'Blog freshness' },
      { id: 'media-richness', label: 'Media richness' },
    ],
  },
  speed: {
    key: 'speed',
    label: 'Speed',
    icon: 'zap',
    color: '#0ea5e9',
    subPillars: [
      { id: 'cwv', label: 'Core Web Vitals' },
      { id: 'image-weight', label: 'Image Optimization' },
      { id: 'app-bloat', label: 'App & script bloat' },
      { id: 'theme-weight', label: 'Theme weight / fonts / lazy-load' },
    ],
  },
  cro: {
    key: 'cro',
    label: 'CRO',
    icon: 'target',
    color: '#f97316',
    subPillars: [
      { id: 'clarity', label: 'Clarity / behavior readiness' },
      { id: 'cart-recovery', label: 'Cart recovery' },
      { id: 'trust', label: 'Trust & social proof' },
      { id: 'returns', label: 'Returns flow' },
      { id: 'tracking', label: 'Order tracking' },
      { id: 'cod', label: 'COD checkout quality' },
      { id: 'options', label: 'Product options / add-ons' },
      { id: 'subscription', label: 'Subscription opportunity' },
      { id: 'wishlist', label: 'Wishlist' },
      { id: 'locator', label: 'Store locator' },
      { id: 'mobile-ux', label: 'Mobile UX' },
    ],
  },
  'ai-discovery': {
    key: 'ai-discovery',
    label: 'AI Discovery',
    icon: 'sparkles',
    color: '#10b981',
    subPillars: [
      { id: 'agents-md', label: 'agents.md / llms.txt' },
      { id: 'agentic-attrs', label: 'Agentic commerce attributes' },
      { id: 'answerable-qa', label: 'Answerable Q&A + FAQ schema' },
      { id: 'feed', label: 'Catalog / feed readiness' },
    ],
  },
};

/** Canonical display order for the five pillars — sidebar nav, dashboard rows, report tables. */
export const pillarOrder: PillarKey[] = ['seo', 'content', 'speed', 'cro', 'ai-discovery'];

/** The pillars as an ordered list, for components that iterate rather than look up. */
export const pillarList: PillarMeta[] = pillarOrder.map((key) => pillarMeta[key]);

/** Resolves a sub-pillar slug (as stored in `findings.subPillar`) to its display label. */
export function subPillarLabel(pillar: PillarKey, slug: string): string {
  return pillarMeta[pillar]?.subPillars.find((subPillar) => subPillar.id === slug)?.label ?? slug;
}

/** Derives a status enum + label from a real 0-100 score — no fixed per-pillar narrative to go stale. */
export function scoreToStatus(score: number): { status: ScoreStatus; statusLabel: string } {
  if (score >= 90) return { status: 'excellent', statusLabel: 'Excellent' };
  if (score >= 75) return { status: 'good', statusLabel: 'Good' };
  if (score >= 50) return { status: 'needs-work', statusLabel: 'Needs Work' };
  return { status: 'critical', statusLabel: 'Critical' };
}

export function describePillar(label: string, score: number, checksTotal: number, checksPassed: number): string {
  const { status } = scoreToStatus(score);
  if (status === 'excellent') return `${label} is performing excellently — ${checksPassed} of ${checksTotal} checks pass.`;
  if (status === 'good') return `${label} is in good shape with room to improve — ${checksPassed} of ${checksTotal} checks pass.`;
  if (status === 'needs-work') return `${label} needs attention — only ${checksPassed} of ${checksTotal} checks pass.`;
  return `${label} requires immediate attention — just ${checksPassed} of ${checksTotal} checks pass.`;
}

/** Overall-score narrative — no per-pillar check counts available at this level. */
export function describeOverall(score: number): string {
  const { status } = scoreToStatus(score);
  if (status === 'excellent') return 'Your store is performing excellently across every pillar Scorelo tracks.';
  if (status === 'good') return 'Your store is performing well, with several opportunities that could improve visibility and conversions.';
  if (status === 'needs-work') return 'Your store has real opportunities to improve — several pillars need attention.';
  return 'Your store needs urgent attention — critical issues are affecting multiple pillars.';
}
