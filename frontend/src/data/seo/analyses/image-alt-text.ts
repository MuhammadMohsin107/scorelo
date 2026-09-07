import { sortByCell, type SubPillarAnalysis } from '../subpillar.model';

// ─── Static presentation config only ──────────────────────────────────
// Data fields (summary/healthChip/totals/findings/evidence.rows/
// lastAnalyzed) are placeholders overwritten by fetchSubPillarAnalysis()
// on load — see data/seo/subpillar.repository.ts. `evidence.sorts`
// intentionally omits the severity sort — the repository prepends it
// once real findings are known (sortBySeverity closes over them).

export const imageAltTextAnalysis: SubPillarAnalysis = {
  slug: 'image-alt-text',
  title: 'Image Alt Text',
  description: 'Check that every meaningful image describes itself for assistive technology and image search.',
  summary: '',
  healthChip: '',
  totals: {
    score: 0,
    analyzed: 0,
    healthy: 0,
    issues: 0,
    critical: 0,
    analyzedLabel: 'Images analyzed',
    healthyLabel: 'Described',
    issuesLabel: 'Issues',
    criticalLabel: 'No alt attribute',
    contextLabel: '',
    contextValue: '',
  },
  findings: [],
  evidence: {
    // ─── Columns must match what the CHECK measures ────────────────────
    // Every column here was previously wrong. The table asked for `file`, `page` and `alt` with a
    // subKey of `imageType`, and offered an "Image type" facet of Lifestyle / Banner / Diagram /
    // Decorative. The check writes none of that.
    //
    // It cannot: the unit it analyses is the PRODUCT, not the individual image, because the Admin
    // API exposes a product's media as a list without page context, and nothing in Shopify labels
    // an image "Lifestyle" or "Decorative". So the check records, per product, how many of its
    // images are unlabelled — and every one of those four columns rendered empty on every row.
    //
    // The table now says what is actually known: which product, and how many of its images carry
    // no alt text.
    title: 'Affected products',
    caption: 'Products sampled from the latest audit with their image alt-text coverage',
    searchPlaceholder: 'Search product or URL…',
    searchKeys: ['url', 'title'],
    sampleNoun: 'analyzed products',
    facet: { label: 'Resource type', allLabel: 'All types', values: ['Product'] },
    columns: [
      { key: 'url', header: 'Product URL', variant: 'mono', subKey: 'pageType', clamp: 'max-w-[20rem]' },
      { key: 'title', header: 'Product', variant: 'muted', clamp: 'max-w-[16rem]' },
      { key: 'length', header: 'Images without alt', align: 'center', variant: 'number' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('length', 'Sort: unlabelled images', 'desc'), sortByCell('title', 'Sort: product')],
  },
  relatedAreas: [
    { label: 'Schema / JSON-LD', href: '/seo/schema', hint: 'Structured data for product imagery' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'How these pages describe themselves' },
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'How these pages are reached' },
  ],
  lastAnalyzed: '',
};
