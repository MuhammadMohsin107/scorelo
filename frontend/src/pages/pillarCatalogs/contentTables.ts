import type { GenericSubPillarDetails } from '../PillarSubPillarPage';
import {
  collectionDescriptionsData,
  metafieldCompletenessData,
  duplicateTemplatedCopyData,
  blogFreshnessData,
  mediaRichnessData,
} from '../../data/content/content.mock';

const good = 'bg-success-100 text-success-700';
const warn = 'bg-warning-100 text-warning-700';
const bad = 'bg-critical-100 text-critical-700';

/** Detail tables + opportunities for Content sub-pillars (keyed by route). */
export const contentTables: Record<string, GenericSubPillarDetails> = {
  'content/collection-descriptions': {
    table: {
      title: 'Collection Description Analysis',
      subtitle: 'Search and filter collections by description status',
      searchPlaceholder: 'Search by collection or description…',
      filters: ['All', 'Missing', 'Too Short', 'Duplicate', 'Good'],
      statusClass: { Missing: bad, 'Too Short': warn, Duplicate: bad, Good: good },
      columns: [
        { key: 'collection', header: 'Collection' },
        { key: 'description', header: 'Description', variant: 'muted' },
        { key: 'words', header: 'Word Count', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'issue', header: 'Issue', variant: 'muted' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'c1', status: 'Good', cells: { collection: 'Wireless Earbuds', description: 'True-wireless earbuds with ANC, long battery life and secure-fit tips for workouts and commutes.', words: 96, issue: '—', recommendation: 'Keep copy current with new arrivals' } },
        { id: 'c2', status: 'Missing', cells: { collection: 'New Arrivals', description: '', words: 0, issue: 'No description', recommendation: 'Add an 80–150 word intro that explains what is new and who it is for' } },
        { id: 'c3', status: 'Missing', cells: { collection: 'Clearance', description: '', words: 0, issue: 'No description', recommendation: 'Add short context on discounts and stock limits' } },
        { id: 'c4', status: 'Too Short', cells: { collection: 'Gaming Audio', description: 'Headsets and speakers for gamers.', words: 6, issue: 'Under 30 words', recommendation: 'Expand with platform compatibility, mic quality and latency benefits' } },
        { id: 'c5', status: 'Too Short', cells: { collection: 'Home Theater', description: 'Soundbars and subwoofers.', words: 4, issue: 'Under 30 words', recommendation: 'Describe room sizes, channel setups and Dolby Atmos support' } },
        { id: 'c6', status: 'Duplicate', cells: { collection: 'Best Sellers', description: 'Shop our most popular audio products loved by thousands of customers.', words: 12, issue: 'Same copy as "Top Rated"', recommendation: 'Differentiate by what makes each set popular' } },
        { id: 'c7', status: 'Duplicate', cells: { collection: 'Top Rated', description: 'Shop our most popular audio products loved by thousands of customers.', words: 12, issue: 'Same copy as "Best Sellers"', recommendation: 'Lead with ratings and review counts' } },
        { id: 'c8', status: 'Good', cells: { collection: 'Noise Cancelling Headphones', description: 'Over-ear and in-ear headphones with adaptive noise cancellation, transparency mode and multipoint Bluetooth.', words: 112, issue: '—', recommendation: '—' } },
        { id: 'c9', status: 'Good', cells: { collection: 'Portable Speakers', description: 'Waterproof Bluetooth speakers sized for backpacks, beaches and balconies, with 12–24 hour battery life.', words: 88, issue: '—', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'cd-opp-1', title: `Write intro copy for ${collectionDescriptionsData.missing} collections with none`, description: 'Collections are high-intent category landing pages; without copy they cannot rank for category terms.', impact: 'High', effort: 'Low', ctaLabel: 'Review Collections', filter: 'Missing' },
      { id: 'cd-opp-2', title: `Expand ${collectionDescriptionsData.tooShort} descriptions under 30 words`, description: 'Short intros leave shoppers and search engines guessing what the collection covers.', impact: 'Medium', effort: 'Low', ctaLabel: 'Review Short Copy', filter: 'Too Short' },
      { id: 'cd-opp-3', title: `De-duplicate ${collectionDescriptionsData.duplicate} collections sharing boilerplate`, description: 'Identical category copy dilutes rankings and reads as low effort to shoppers.', impact: 'Medium', effort: 'Low', ctaLabel: 'View Duplicates', filter: 'Duplicate' },
    ],
  },

  'content/metafields': {
    table: {
      title: 'Metafield Coverage',
      subtitle: 'Coverage per metafield across applicable products',
      searchPlaceholder: 'Search by metafield or category…',
      filters: ['All', 'Critical Gap', 'Gap', 'Complete'],
      statusClass: { 'Critical Gap': bad, Gap: warn, Complete: good },
      columns: [
        { key: 'field', header: 'Metafield', variant: 'mono' },
        { key: 'label', header: 'Label' },
        { key: 'category', header: 'Category', variant: 'muted' },
        { key: 'applicable', header: 'Applicable', align: 'center', variant: 'number' },
        { key: 'missing', header: 'Missing', align: 'center', variant: 'number' },
        { key: 'coverage', header: 'Coverage', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        ...metafieldCompletenessData.fields.map((f) => {
          const pct = Math.round(((f.applicable - f.missing) / f.applicable) * 100);
          const status = f.missing === 0 ? 'Complete' : f.critical ? 'Critical Gap' : 'Gap';
          return {
            id: f.key,
            status,
            cells: {
              field: f.key,
              label: f.label,
              category: f.category,
              applicable: f.applicable,
              missing: f.missing,
              coverage: `${pct}%`,
              recommendation: f.critical ? 'Backfill first — trust/compliance field shown on PDP' : 'Backfill via bulk editor or CSV import',
            },
          };
        }),
        { id: 'color_family', status: 'Complete', cells: { field: 'color_family', label: 'Color Family', category: 'Product Attributes', applicable: 1284, missing: 0, coverage: '100%', recommendation: '—' } },
        { id: 'connectivity', status: 'Complete', cells: { field: 'connectivity', label: 'Connectivity', category: 'Technical Specs', applicable: 1188, missing: 0, coverage: '100%', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'mf-opp-1', title: `Backfill critical trust fields on ${metafieldCompletenessData.missingCriticalFields} products`, description: 'warranty_period and country_of_origin power PDP trust blocks and two storefront filters.', impact: 'High', effort: 'Medium', ctaLabel: 'View Critical Gaps', filter: 'Critical Gap' },
      { id: 'mf-opp-2', title: `Complete ${metafieldCompletenessData.incomplete} products missing any metafield`, description: 'Full attribute coverage improves faceted navigation, comparison tables and feed quality.', impact: 'Medium', effort: 'Medium', ctaLabel: 'View Gaps', filter: 'Gap' },
    ],
  },

  'content/dup-templated': {
    table: {
      title: 'Duplicate & Templated Copy Analysis',
      subtitle: 'Pages ranked by content similarity to their nearest sibling',
      searchPlaceholder: 'Search by page or pattern…',
      filters: ['All', 'Highly Templated', 'Potential Duplicate', 'Unique'],
      statusClass: { 'Highly Templated': bad, 'Potential Duplicate': warn, Unique: good },
      columns: [
        { key: 'page', header: 'Page', variant: 'mono' },
        { key: 'similarity', header: 'Content Similarity', align: 'center', variant: 'number' },
        { key: 'pattern', header: 'Pattern', variant: 'muted' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'd1', status: 'Highly Templated', cells: { page: '/products/wireless-earbuds-black', similarity: '96%', pattern: 'Variant listing reuses parent copy + shipping paragraph', recommendation: 'Merge variants under one product or write variant-specific copy' } },
        { id: 'd2', status: 'Highly Templated', cells: { page: '/products/wireless-earbuds-white', similarity: '96%', pattern: 'Variant listing reuses parent copy + shipping paragraph', recommendation: 'Merge variants under one product or write variant-specific copy' } },
        { id: 'd3', status: 'Highly Templated', cells: { page: '/products/gaming-headset-surround-7-1', similarity: '91%', pattern: '"This product is a great…" template', recommendation: 'Rewrite with mic, latency and platform specifics' } },
        { id: 'd4', status: 'Potential Duplicate', cells: { page: '/products/noise-cancelling-headphones-x2', similarity: '84%', pattern: 'Shares 3 paragraphs with Studio model', recommendation: 'Emphasise the differences (weight, battery, price)' } },
        { id: 'd5', status: 'Potential Duplicate', cells: { page: '/collections/top-rated', similarity: '78%', pattern: 'Same intro as Best Sellers', recommendation: 'Differentiate the intent of each collection' } },
        { id: 'd6', status: 'Potential Duplicate', cells: { page: '/products/portable-speaker-xl', similarity: '72%', pattern: 'Spec list copied from Mini', recommendation: 'Add room-size and output comparisons' } },
        { id: 'd7', status: 'Unique', cells: { page: '/products/wireless-earbuds-pro', similarity: '18%', pattern: '—', recommendation: '—' } },
        { id: 'd8', status: 'Unique', cells: { page: '/products/home-theater-soundbar-5-1', similarity: '14%', pattern: '—', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'dt-opp-1', title: `Rewrite ${duplicateTemplatedCopyData.highlyTemplated} highly templated pages`, description: 'Pages above 90% similarity compete with each other and read as low-effort to shoppers.', impact: 'High', effort: 'Medium', ctaLabel: 'View Templated Pages', filter: 'Highly Templated' },
      { id: 'dt-opp-2', title: `Review ${duplicateTemplatedCopyData.potentialDuplicates} potential duplicates`, description: 'Differentiate near-identical siblings by what actually changes between them.', impact: 'Medium', effort: 'Medium', ctaLabel: 'View Duplicates', filter: 'Potential Duplicate' },
      { id: 'dt-opp-3', title: 'Move the shipping & returns paragraph into a shared theme block', description: 'Removing the 40-word boilerplate from 84 descriptions lifts uniqueness in one change.', impact: 'Medium', effort: 'Low', ctaLabel: 'View Affected', filter: 'Highly Templated' },
    ],
  },

  'content/blog-freshness': {
    table: {
      title: 'Article Freshness',
      subtitle: 'Search and filter articles by freshness status',
      searchPlaceholder: 'Search by article title…',
      filters: ['All', 'Stale', 'Aging', 'Fresh'],
      statusClass: { Stale: bad, Aging: warn, Fresh: good },
      columns: [
        { key: 'article', header: 'Article' },
        { key: 'published', header: 'Published', variant: 'muted' },
        { key: 'updated', header: 'Last Updated', variant: 'muted' },
        { key: 'age', header: 'Age', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'b1', status: 'Fresh', cells: { article: 'Best Wireless Earbuds for Running (2026 Update)', published: 'Jun 2026', updated: 'Aug 2026', age: '2 mo', recommendation: '—' } },
        { id: 'b2', status: 'Fresh', cells: { article: 'How to Pair Multipoint Bluetooth Headphones', published: 'Jul 2026', updated: 'Jul 2026', age: '1 mo', recommendation: '—' } },
        { id: 'b3', status: 'Aging', cells: { article: 'Soundbar vs. Home Theater System: Which Is Right for You?', published: 'Nov 2025', updated: 'Jan 2026', age: '9 mo', recommendation: 'Refresh model recommendations and prices' } },
        { id: 'b4', status: 'Aging', cells: { article: 'Gaming Headset Buying Guide', published: 'Oct 2025', updated: 'Oct 2025', age: '10 mo', recommendation: 'Add new console compatibility notes' } },
        { id: 'b5', status: 'Stale', cells: { article: 'Top 10 Bluetooth Speakers Under $100', published: 'Mar 2024', updated: 'Mar 2024', age: '2 yr 5 mo', recommendation: 'Rewrite — 6 of 10 models discontinued' } },
        { id: 'b6', status: 'Stale', cells: { article: 'How to Clean Your Earbuds Safely', published: 'Jan 2024', updated: 'Jan 2024', age: '2 yr 7 mo', recommendation: 'Light refresh and re-date' } },
        { id: 'b7', status: 'Stale', cells: { article: 'Wired vs. Wireless: Is Audio Quality Really Different?', published: 'Aug 2023', updated: 'Aug 2023', age: '3 yr', recommendation: 'Consolidate into the headphones buying guide' } },
        { id: 'b8', status: 'Stale', cells: { article: 'Black Friday Audio Deals 2023', published: 'Nov 2023', updated: 'Nov 2023', age: '2 yr 9 mo', recommendation: 'Retire and 301 to the current deals page' } },
      ],
    },
    opportunities: [
      { id: 'bf-opp-1', title: `Refresh or retire ${blogFreshnessData.stale} stale articles`, description: 'Posts older than 12 months reference discontinued models and old pricing.', impact: 'High', effort: 'Medium', ctaLabel: 'View Stale Articles', filter: 'Stale' },
      { id: 'bf-opp-2', title: `Schedule updates for ${blogFreshnessData.aging} aging articles`, description: 'Catch them before they turn stale — a light refresh keeps rankings intact.', impact: 'Medium', effort: 'Low', ctaLabel: 'View Aging Articles', filter: 'Aging' },
      { id: 'bf-opp-3', title: 'Set a monthly publishing cadence', description: 'Consistent fresh content signals an active brand to readers and search engines.', impact: 'Medium', effort: 'Medium', ctaLabel: 'Review Fresh Posts', filter: 'Fresh' },
    ],
  },

  'content/media-richness': {
    table: {
      title: 'Product Media Coverage',
      subtitle: 'Search and filter products by media richness',
      searchPlaceholder: 'Search by product…',
      filters: ['All', 'Missing Media', 'Limited', 'Rich'],
      statusClass: { 'Missing Media': bad, Limited: warn, Rich: good },
      columns: [
        { key: 'product', header: 'Product' },
        { key: 'images', header: 'Images', align: 'center', variant: 'number' },
        { key: 'video', header: 'Video', align: 'center', variant: 'bool' },
        { key: 'gallery', header: 'Gallery', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'm1', status: 'Rich', cells: { product: 'Wireless Earbuds Pro', images: 8, video: true, gallery: 3, recommendation: '—' } },
        { id: 'm2', status: 'Rich', cells: { product: 'Noise Cancelling Headphones Studio', images: 7, video: true, gallery: 2, recommendation: '—' } },
        { id: 'm3', status: 'Limited', cells: { product: 'Bluetooth Speaker Mini', images: 2, video: false, gallery: 1, recommendation: 'Add lifestyle and scale shots; add a 15s demo video' } },
        { id: 'm4', status: 'Limited', cells: { product: 'Gaming Headset Surround 7.1', images: 3, video: false, gallery: 1, recommendation: 'Add on-head and mic detail shots' } },
        { id: 'm5', status: 'Missing Media', cells: { product: 'Wireless Earbuds – Black', images: 1, video: false, gallery: 0, recommendation: 'Reuse parent gallery with variant colour swaps' } },
        { id: 'm6', status: 'Missing Media', cells: { product: 'Portable Speaker XL', images: 0, video: false, gallery: 0, recommendation: 'Upload hero + 4 angles; product cannot convert without imagery' } },
        { id: 'm7', status: 'Limited', cells: { product: 'Home Theater Soundbar 5.1', images: 4, video: false, gallery: 1, recommendation: 'Add room-context shots and a setup video' } },
        { id: 'm8', status: 'Rich', cells: { product: 'Over-Ear Headphones 2024', images: 6, video: true, gallery: 2, recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'mr-opp-1', title: `Add imagery to ${mediaRichnessData.missingMedia} products with no gallery`, description: 'Products with a single image or none convert at a fraction of fully-shot products.', impact: 'High', effort: 'High', ctaLabel: 'View Missing Media', filter: 'Missing Media' },
      { id: 'mr-opp-2', title: `Enrich ${mediaRichnessData.limitedMedia} products with thin galleries`, description: 'Target at least 4 angles plus one lifestyle or scale shot per product.', impact: 'Medium', effort: 'Medium', ctaLabel: 'View Limited Media', filter: 'Limited' },
      { id: 'mr-opp-3', title: 'Add short demo videos to hero products', description: `Only ${mediaRichnessData.productsWithVideo} products have video; 15-second demos lift conversion on considered purchases.`, impact: 'Medium', effort: 'Medium', ctaLabel: 'View Rich Products', filter: 'Rich' },
    ],
  },
};
