import type { GenericSubPillarDetails } from '../PillarSubPillarPage';
import {
  coreWebVitalsData,
  imageWeightFormatData,
  appScriptBloatData,
  themeWeightFontsData,
} from '../../data/speed/speed.mock';

const good = 'bg-success-100 text-success-700';
const warn = 'bg-warning-100 text-warning-700';
const bad = 'bg-critical-100 text-critical-700';

/** Detail tables + opportunities for Speed sub-pillars (keyed by route). */
export const speedTables: Record<string, GenericSubPillarDetails> = {
  'speed/cwv': {
    table: {
      title: 'Core Web Vitals by Page',
      subtitle: `Field data per template · thresholds: LCP ≤ ${coreWebVitalsData.lcpGoodThreshold}s · INP ≤ ${coreWebVitalsData.inpGoodThreshold}ms · CLS ≤ ${coreWebVitalsData.clsGoodThreshold}`,
      searchPlaceholder: 'Search by URL or template…',
      filters: ['All', 'Poor', 'Needs Improvement', 'Good'],
      statusClass: { Poor: bad, 'Needs Improvement': warn, Good: good },
      columns: [
        { key: 'url', header: 'Page URL', variant: 'mono' },
        { key: 'template', header: 'Template', variant: 'muted' },
        { key: 'lcp', header: 'LCP', align: 'center', variant: 'number' },
        { key: 'inp', header: 'INP', align: 'center', variant: 'number' },
        { key: 'cls', header: 'CLS', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'p1', status: 'Poor', cells: { url: '/', template: 'Homepage', lcp: '3.9s', inp: '240ms', cls: '0.19', recommendation: 'Preload hero image, size the promo slots, defer carousel JS' } },
        { id: 'p2', status: 'Poor', cells: { url: '/collections/all', template: 'Collection', lcp: '3.6s', inp: '310ms', cls: '0.12', recommendation: 'Paginate grid, lazy-load below-fold cards, debounce filter JS' } },
        { id: 'p3', status: 'Poor', cells: { url: '/collections/gaming-audio', template: 'Collection', lcp: '3.4s', inp: '280ms', cls: '0.11', recommendation: 'Same as /collections/all' } },
        { id: 'p4', status: 'Poor', cells: { url: '/products/gaming-headset-pro-max', template: 'Product', lcp: '3.2s', inp: '220ms', cls: '0.09', recommendation: 'Compress 1.8MB hero PNG → AVIF' } },
        { id: 'p5', status: 'Needs Improvement', cells: { url: '/products/wireless-earbuds-pro', template: 'Product', lcp: '2.8s', inp: '190ms', cls: '0.06', recommendation: 'Preconnect to review widget; lazy-load gallery thumbnails' } },
        { id: 'p6', status: 'Needs Improvement', cells: { url: '/cart', template: 'Cart', lcp: '2.6s', inp: '210ms', cls: '0.05', recommendation: 'Defer upsell widget until interaction' } },
        { id: 'p7', status: 'Good', cells: { url: '/products/noise-cancelling-headphones', template: 'Product', lcp: '1.9s', inp: '140ms', cls: '0.04', recommendation: '—' } },
        { id: 'p8', status: 'Good', cells: { url: '/pages/about', template: 'Page', lcp: '1.4s', inp: '90ms', cls: '0.02', recommendation: '—' } },
        { id: 'p9', status: 'Good', cells: { url: '/blogs/guides/best-wireless-earbuds-for-running', template: 'Article', lcp: '1.7s', inp: '110ms', cls: '0.03', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'cwv-opp-1', title: `Fix LCP on ${coreWebVitalsData.poorUrls} poor pages`, description: 'Preload the hero image, serve it as AVIF and defer non-critical JavaScript to bring LCP under 2.5s.', impact: 'High', effort: 'High', ctaLabel: 'View Poor Pages', filter: 'Poor' },
      { id: 'cwv-opp-2', title: `Stabilise layout on ${coreWebVitalsData.pagesAnalyzed - coreWebVitalsData.clsPassingPages} pages with CLS > 0.1`, description: 'Reserve space for banners, promo slots and late-loading widgets.', impact: 'Medium', effort: 'Low', ctaLabel: 'Review Pages', filter: 'Poor' },
      { id: 'cwv-opp-3', title: `Lift ${coreWebVitalsData.needsImprovementUrls} "needs improvement" pages to Good`, description: 'These pages are close to thresholds — small wins like preconnects and lazy-loading tip them over.', impact: 'Medium', effort: 'Low', ctaLabel: 'View Pages', filter: 'Needs Improvement' },
    ],
  },

  'speed/image-weight': {
    table: {
      title: 'Image Weight & Format Analysis',
      subtitle: `Images over ${imageWeightFormatData.oversizedThresholdKb}KB or served in legacy formats`,
      searchPlaceholder: 'Search by file or page…',
      filters: ['All', 'Oversized', 'Legacy Format', 'Optimized'],
      statusClass: { Oversized: bad, 'Legacy Format': warn, Optimized: good },
      columns: [
        { key: 'image', header: 'Image', variant: 'mono' },
        { key: 'page', header: 'Page', variant: 'mono' },
        { key: 'size', header: 'Size', align: 'center', variant: 'number' },
        { key: 'format', header: 'Format', align: 'center' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 'i1', status: 'Oversized', cells: { image: 'hero-banner-summer.png', page: '/', size: '1,840 KB', format: 'PNG', recommendation: 'Export AVIF at 1600w; expected ~160 KB' } },
        { id: 'i2', status: 'Oversized', cells: { image: 'gaming-headset-pro-max-01.png', page: '/products/gaming-headset-pro-max', size: '1,120 KB', format: 'PNG', recommendation: 'Convert to AVIF, serve responsive widths' } },
        { id: 'i3', status: 'Oversized', cells: { image: 'soundbar-lifestyle.jpg', page: '/products/home-theater-soundbar-5-1', size: '780 KB', format: 'JPG', recommendation: 'Compress to ~120 KB WebP' } },
        { id: 'i4', status: 'Oversized', cells: { image: 'collection-gaming-header.jpg', page: '/collections/gaming-audio', size: '640 KB', format: 'JPG', recommendation: 'Crop to display size; WebP' } },
        { id: 'i5', status: 'Legacy Format', cells: { image: 'earbuds-pro-03.jpg', page: '/products/wireless-earbuds-pro', size: '186 KB', format: 'JPG', recommendation: 'Add width param so CDN serves AVIF' } },
        { id: 'i6', status: 'Legacy Format', cells: { image: 'speaker-mini-02.jpg', page: '/products/bluetooth-speaker-mini', size: '168 KB', format: 'JPG', recommendation: 'Add width param so CDN serves AVIF' } },
        { id: 'i7', status: 'Optimized', cells: { image: 'headphones-studio-01.avif', page: '/products/noise-cancelling-headphones', size: '92 KB', format: 'AVIF', recommendation: '—' } },
        { id: 'i8', status: 'Optimized', cells: { image: 'logo.svg', page: 'All pages', size: '4 KB', format: 'SVG', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'img-opp-1', title: `Compress ${imageWeightFormatData.oversized} oversized images`, description: `Re-encoding saves ~${imageWeightFormatData.potentialSavingsMb}MB across the catalog and ~1.4s on 3G product pages.`, impact: 'High', effort: 'Medium', ctaLabel: 'View Oversized', filter: 'Oversized' },
      { id: 'img-opp-2', title: `Convert ${imageWeightFormatData.legacyFormat} legacy images to WebP/AVIF`, description: 'The CDN already supports modern formats — fixing the theme URL params unlocks them.', impact: 'Medium', effort: 'Low', ctaLabel: 'View Legacy', filter: 'Legacy Format' },
      { id: 'img-opp-3', title: 'Serve responsive widths with srcset', description: 'Mobile devices currently download desktop-size images on most templates.', impact: 'Medium', effort: 'Low', ctaLabel: 'Review Optimized', filter: 'Optimized' },
    ],
  },

  'speed/app-bloat': {
    table: {
      title: 'Third-party Script Inventory',
      subtitle: `${appScriptBloatData.scriptsAnalyzed} scripts detected · ${appScriptBloatData.thirdPartyScripts} third-party`,
      searchPlaceholder: 'Search by script or provider…',
      filters: ['All', 'Unused', 'Blocking', 'Heavy', 'Healthy'],
      statusClass: { Unused: bad, Blocking: bad, Heavy: warn, Healthy: good },
      columns: [
        { key: 'script', header: 'Script' },
        { key: 'provider', header: 'Provider', variant: 'muted' },
        { key: 'size', header: 'Size', align: 'center', variant: 'number' },
        { key: 'impact', header: 'Load Impact', align: 'center', variant: 'number' },
        { key: 'status', header: 'Status', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 's1', status: 'Unused', cells: { script: 'reviews-widget-legacy.js', provider: 'Legacy Reviews App', size: '142 KB', impact: '+180ms', recommendation: 'App uninstalled but script remains — remove from theme.liquid' } },
        { id: 's2', status: 'Unused', cells: { script: 'popup-spring-sale.js', provider: 'Popup App (expired)', size: '64 KB', impact: '+90ms', recommendation: 'Campaign ended — remove script tag' } },
        { id: 's3', status: 'Unused', cells: { script: 'upsell-bundle.js', provider: 'Discontinued Upsell App', size: '98 KB', impact: '+120ms', recommendation: 'Remove; replaced by native bundles' } },
        { id: 's4', status: 'Blocking', cells: { script: 'chat-widget.js', provider: 'Live Chat Widget', size: '210 KB', impact: '+260ms', recommendation: 'Load on scroll or first interaction' } },
        { id: 's5', status: 'Blocking', cells: { script: 'analytics-pixel.js', provider: 'Analytics Pixel', size: '48 KB', impact: '+70ms', recommendation: 'Add async attribute' } },
        { id: 's6', status: 'Heavy', cells: { script: 'loyalty-rewards.js', provider: 'Loyalty Rewards Script', size: '184 KB', impact: '+150ms', recommendation: 'Defer until account or cart pages' } },
        { id: 's7', status: 'Heavy', cells: { script: 'product-reviews.js', provider: 'Product Reviews App', size: '126 KB', impact: '+110ms', recommendation: 'Lazy-load below the fold' } },
        { id: 's8', status: 'Healthy', cells: { script: 'theme.min.js', provider: 'Theme', size: '86 KB', impact: '+40ms', recommendation: '—' } },
        { id: 's9', status: 'Healthy', cells: { script: 'cart-drawer.js', provider: 'Theme', size: '22 KB', impact: '+12ms', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'app-opp-1', title: `Remove ${appScriptBloatData.unusedScripts} unused scripts`, description: 'Apps that were uninstalled or expired still inject code on every page — ~340KB of JS for nothing.', impact: 'High', effort: 'Low', ctaLabel: 'View Unused', filter: 'Unused' },
      { id: 'app-opp-2', title: `Defer ${appScriptBloatData.blockingScripts} render-blocking scripts`, description: 'Load chat, analytics and widgets after first paint or on interaction.', impact: 'High', effort: 'Low', ctaLabel: 'View Blocking', filter: 'Blocking' },
      { id: 'app-opp-3', title: `Lazy-load ${appScriptBloatData.heavyScripts} heavy scripts`, description: 'Scripts over 100KB should only load on the pages and moments that use them.', impact: 'Medium', effort: 'Medium', ctaLabel: 'View Heavy', filter: 'Heavy' },
    ],
  },

  'speed/theme-weight': {
    table: {
      title: 'Theme Asset Audit',
      subtitle: `Theme ${themeWeightFontsData.themeSizeMb}MB (target ${themeWeightFontsData.recommendedThemeSizeMb}MB) · ${themeWeightFontsData.fontRequests} font requests · ${themeWeightFontsData.lazyLoadCoverage}% lazy-load coverage`,
      searchPlaceholder: 'Search by asset…',
      filters: ['All', 'Remove', 'Defer', 'Optimize', 'OK'],
      statusClass: { Remove: bad, Defer: warn, Optimize: warn, OK: good },
      columns: [
        { key: 'asset', header: 'Asset', variant: 'mono' },
        { key: 'type', header: 'Type', variant: 'muted' },
        { key: 'size', header: 'Size', align: 'center', variant: 'number' },
        { key: 'loaded', header: 'Loaded', align: 'center', variant: 'muted' },
        { key: 'status', header: 'Action', align: 'center', variant: 'status' },
        { key: 'recommendation', header: 'Recommendation', variant: 'muted' },
      ],
      rows: [
        { id: 't1', status: 'Defer', cells: { asset: 'hero-autoplay.mp4', type: 'Video', size: '4.0 MB', loaded: 'Eager, homepage', recommendation: 'preload="metadata", poster image, lazy on scroll' } },
        { id: 't2', status: 'Optimize', cells: { asset: 'Inter (400/500/600/700)', type: 'Font', size: '4 requests', loaded: 'Eager, all pages', recommendation: 'Keep 400/600; subset to Latin' } },
        { id: 't3', status: 'Remove', cells: { asset: 'Playfair Display (400/700)', type: 'Font', size: '2 requests', loaded: 'Eager, all pages', recommendation: 'Unused since theme update — remove' } },
        { id: 't4', status: 'Defer', cells: { asset: 'Icon font (2 weights)', type: 'Font', size: '2 requests', loaded: 'Eager', recommendation: 'Replace with inline SVG sprite' } },
        { id: 't5', status: 'Remove', cells: { asset: 'legacy-slider.css', type: 'CSS', size: '48 KB', loaded: 'Render-blocking', recommendation: 'Unused component — purge' } },
        { id: 't6', status: 'Optimize', cells: { asset: 'theme.css', type: 'CSS', size: '312 KB', loaded: 'Render-blocking', recommendation: `Purge ~${themeWeightFontsData.unusedCssKb}KB unused rules; inline critical CSS` } },
        { id: 't7', status: 'Remove', cells: { asset: 'vendor/jquery-migrate.js', type: 'JS', size: '36 KB', loaded: 'Blocking', recommendation: 'No dependents — remove' } },
        { id: 't8', status: 'Optimize', cells: { asset: 'Below-fold product images', type: 'Images', size: `${themeWeightFontsData.belowFoldImagesAnalyzed} images`, loaded: `${themeWeightFontsData.lazyLoadedImages} lazy`, recommendation: `Add loading="lazy" to remaining ${themeWeightFontsData.belowFoldImagesAnalyzed - themeWeightFontsData.lazyLoadedImages}` } },
        { id: 't9', status: 'OK', cells: { asset: 'theme.min.js', type: 'JS', size: '86 KB', loaded: 'Deferred', recommendation: '—' } },
      ],
    },
    opportunities: [
      { id: 'theme-opp-1', title: `Cut font requests from ${themeWeightFontsData.fontRequests} to ${themeWeightFontsData.recommendedFontRequests}`, description: `${themeWeightFontsData.redundantFontWeights} weights are never rendered above the fold; removing them speeds first paint on every page.`, impact: 'High', effort: 'Low', ctaLabel: 'View Fonts', filter: 'Remove' },
      { id: 'theme-opp-2', title: 'Lazy-load the homepage hero video', description: 'A 4MB autoplay MP4 competes with the LCP image; preload metadata and start on scroll.', impact: 'High', effort: 'Low', ctaLabel: 'View Deferrable', filter: 'Defer' },
      { id: 'theme-opp-3', title: `Purge ${themeWeightFontsData.unusedCssKb + themeWeightFontsData.unusedJsKb}KB of unused CSS/JS`, description: `${themeWeightFontsData.unusedAssets} assets are bundled but unused; purging brings the theme under ${themeWeightFontsData.recommendedThemeSizeMb}MB.`, impact: 'Medium', effort: 'Medium', ctaLabel: 'View Optimizations', filter: 'Optimize' },
    ],
  },
};
