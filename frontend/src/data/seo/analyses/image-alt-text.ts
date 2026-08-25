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
    title: 'Affected images',
    caption: 'Images sampled from the latest crawl with their alt-text status',
    searchPlaceholder: 'Search file, page or alt text…',
    searchKeys: ['file', 'page', 'alt'],
    sampleNoun: 'crawled images',
    facet: { label: 'Image type', allLabel: 'All image types', values: ['Product', 'Lifestyle', 'Banner', 'Diagram', 'Decorative'] },
    columns: [
      { key: 'file', header: 'Image', variant: 'mono', subKey: 'imageType', clamp: 'max-w-[14rem]' },
      { key: 'page', header: 'Page', variant: 'muted', clamp: 'max-w-[14rem]' },
      { key: 'alt', header: 'Current alt text', emptyText: 'no alt attribute', clamp: 'max-w-[22rem]' },
      { key: 'status', header: 'Issue', variant: 'status' },
      { key: 'severity', header: 'Severity', variant: 'severity' },
      { key: 'action', header: 'Action', align: 'right', variant: 'action' },
    ],
    rows: [],
    sorts: [sortByCell('page', 'Sort: page'), sortByCell('file', 'Sort: file name')],
  },
  relatedAreas: [
    { label: 'Schema / JSON-LD', href: '/seo/schema', hint: 'Structured data for product imagery' },
    { label: 'Title Tags', href: '/seo/title-tags', hint: 'How these pages describe themselves' },
    { label: 'Internal Links & 404s', href: '/seo/internal-links', hint: 'How these pages are reached' },
  ],
  lastAnalyzed: '',
};
