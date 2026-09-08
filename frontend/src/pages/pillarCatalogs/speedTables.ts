import type { GenericSubPillarDetails } from './genericTypes';

const good = 'bg-success-100 text-success-700';
const warn = 'bg-warning-100 text-warning-700';
const bad = 'bg-critical-100 text-critical-700';

/**
 * ─── Speed detail tables ─────────────────────────────────────────────
 *
 * These files declare PRESENTATION ONLY: the columns to show, the status filters, and the badge
 * colour for each status. Every row is supplied by the audit at runtime
 * (fetchSubPillarAnalysis overwrites `evidence.rows`), so `rows` here is empty on purpose.
 *
 * Two rules make the difference between a table that works and one that renders blank, and both
 * were being broken here:
 *
 *   1. A column `key` MUST be a key the check actually writes into `cells`. This file asked for
 *      `image`, `page`, `size`, `format`, `script`, `provider`, `impact`, `asset`, `type`,
 *      `loaded` and `recommendation` — the Speed checks write `url`, `pageType`, `title` and
 *      `length`. Nothing overlapped, so every cell rendered empty.
 *   2. A `filters` entry MUST be a status the check actually emits, or no filter can select the
 *      rows and the badge renders with no colour. This file listed "Legacy Format", "Blocking",
 *      "Heavy", "Remove", "Defer", "OK"; the checks emit "Optimized", "Oversized",
 *      "No Dimensions", "Lean", "Heavy Script", "Heavy Stylesheet", "Heavy Font",
 *      "No Always-on Load", "Active App Embed", "Disabled App Embed" and "Layout Script".
 *
 * The captions previously quoted invented figures ("Theme 4.2MB (target 2MB) · 8 font requests")
 * which rendered above the table as if measured. They now describe the table, and the measured
 * figures come from the audit's own summary line above it.
 *
 * `opportunities` is empty because nothing renders it — NonSeoSubPillarPage reads the findings
 * from the audit instead. It stays on the type so the shape matches the other pillars.
 */
export const speedTables: Record<string, GenericSubPillarDetails> = {
  // Core Web Vitals reports 'unavailable' until lab tooling and a public storefront exist, so it
  // produces no rows at all. The columns follow the same shape the other Speed checks write, so
  // the table is correct the day it does.
  'speed/cwv': {
    table: {
      title: 'Core Web Vitals by Page',
      subtitle: 'Page-experience measurements once field or lab data is available',
      searchPlaceholder: 'Search by page…',
      filters: ['All'],
      statusClass: {},
      columns: [
        { key: 'title', header: 'Page' },
        { key: 'url', header: 'URL', variant: 'mono' },
        { key: 'pageType', header: 'Type', variant: 'muted' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      ],
      rows: [],
    },
    opportunities: [],
  },

  'speed/image-weight': {
    table: {
      title: 'Image Optimization Analysis',
      subtitle: 'Product images by source size, measured from Admin API dimensions',
      searchPlaceholder: 'Search by product or URL…',
      filters: ['All', 'Oversized', 'No Dimensions', 'Optimized'],
      statusClass: { Oversized: bad, 'No Dimensions': warn, Optimized: good },
      columns: [
        { key: 'title', header: 'Product' },
        { key: 'url', header: 'Product URL', variant: 'mono' },
        { key: 'pageType', header: 'Type', variant: 'muted' },
        { key: 'length', header: 'Megapixels', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      ],
      rows: [],
    },
    opportunities: [],
  },

  'speed/app-bloat': {
    table: {
      title: 'Always-on Third-party Load',
      subtitle: 'App embeds and hardcoded layout scripts that load on every page',
      searchPlaceholder: 'Search by app or script…',
      filters: ['All', 'Active App Embed', 'Layout Script', 'Disabled App Embed', 'No Always-on Load'],
      statusClass: {
        'Active App Embed': warn,
        'Layout Script': warn,
        'Disabled App Embed': good,
        'No Always-on Load': good,
      },
      columns: [
        { key: 'title', header: 'Source' },
        { key: 'pageType', header: 'Kind', variant: 'muted' },
        { key: 'url', header: 'Reference', variant: 'mono' },
        // 1 = loads on every page, 0 = disabled or nothing detected. The investigation drawer
        // spells this out in words; the column exists so the table can be sorted by it.
        { key: 'length', header: 'Always on', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      ],
      rows: [],
    },
    opportunities: [],
  },

  'speed/theme-weight': {
    table: {
      title: 'Theme Asset Audit',
      subtitle: 'Theme assets by stored size, read from the Admin API',
      searchPlaceholder: 'Search by asset…',
      filters: ['All', 'Heavy Script', 'Heavy Stylesheet', 'Heavy Font', 'Lean'],
      statusClass: {
        'Heavy Script': bad,
        'Heavy Stylesheet': warn,
        'Heavy Font': warn,
        Lean: good,
      },
      columns: [
        { key: 'title', header: 'Asset' },
        { key: 'pageType', header: 'Kind', variant: 'muted' },
        { key: 'length', header: 'Size (KB)', align: 'center', variant: 'number' },
        { key: 'url', header: 'Path', variant: 'mono' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
      ],
      rows: [],
    },
    opportunities: [],
  },
};
