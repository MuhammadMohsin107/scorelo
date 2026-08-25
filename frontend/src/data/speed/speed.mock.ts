// ─── Speed Pillar Mock Data (4 Exact Sub-Pillars) ─────────────────────
// Mirrors the shape of src/data/seo/seo-8pillars.mock.ts so the Speed
// dashboard and every sub-pillar detail page read from a single source
// of truth and can never disagree with each other or with the overall
// Speed score shown on the main Dashboard (84/100, "Good").

export type SpeedSubPillarKey = 'cwv' | 'image-weight' | 'app-bloat' | 'theme-weight';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

// ─── CORE WEB VITALS ────────────────────────────────────────────────
export const coreWebVitalsData = {
  score: 82,
  status: 'good',
  pagesAnalyzed: 48,
  lcpSeconds: 2.1,
  inpMs: 180,
  cls: 0.08,
  goodUrls: 32,
  needsImprovementUrls: 12,
  poorUrls: 4,
  lcpGoodThreshold: 2.5,
  lcpPoorThreshold: 4.0,
  inpGoodThreshold: 200,
  inpPoorThreshold: 500,
  clsGoodThreshold: 0.1,
  clsPoorThreshold: 0.25,
  lcpPassingPages: 40, // 48 - 8 LCP issues
  inpPassingPages: 44, // 48 - 4 INP issues
  clsPassingPages: 44, // 48 - 4 CLS issues
};

// ─── IMAGE WEIGHT & FORMAT ──────────────────────────────────────────
export const imageWeightFormatData = {
  score: 79,
  status: 'good',
  imagesAnalyzed: 3842,
  optimized: 3214,
  oversized: 428,
  modernFormat: 2984, // WebP / AVIF
  legacyFormat: 858, // JPG / PNG
  correctlySized: 3414, // <= 200KB
  averageSizeKb: 224,
  oversizedThresholdKb: 200,
  potentialSavingsMb: 38.4,
};

// ─── APP & SCRIPT BLOAT ─────────────────────────────────────────────
export const appScriptBloatData = {
  score: 88,
  status: 'excellent',
  scriptsAnalyzed: 46,
  thirdPartyScripts: 28,
  heavyScripts: 8,
  blockingScripts: 6,
  unusedScripts: 12,
  totalScriptWeightKb: 1840,
  averageLoadImpactMs: 62,
  heavyThresholdKb: 100,
};

// ─── THEME WEIGHT / FONTS / LAZY-LOAD ───────────────────────────────
export const themeWeightFontsData = {
  score: 87,
  status: 'excellent',
  themeSizeMb: 2.8,
  recommendedThemeSizeMb: 2.0,
  fontRequests: 8,
  recommendedFontRequests: 4,
  redundantFontWeights: 4,
  lazyLoadCoverage: 86,
  belowFoldImagesAnalyzed: 442,
  lazyLoadedImages: 380,
  unusedAssets: 14,
  unusedCssKb: 184,
  unusedJsKb: 96,
  renderBlockingCssFiles: 3,
  renderBlockingCssTotal: 12,
};

// ─── OVERALL SPEED KPIs ─────────────────────────────────────────────
export const speedKpis = [
  { label: 'Overall Speed Score', value: '84/100', trend: '+2.6%', status: 'good' },
  { label: 'Pages Analyzed', value: '48', trend: '+3', status: 'neutral' },
  { label: 'Performance Issues', value: '16', trend: '-4', status: 'improvement' },
  { label: 'LCP Issues', value: '8', trend: '-2', status: 'improvement' },
  { label: 'CLS Issues', value: '4', trend: '-1', status: 'improvement' },
  { label: 'INP Issues', value: '4', trend: '0', status: 'neutral' },
];

// ─── PRIORITY ISSUES ────────────────────────────────────────────────
export const priorityIssues = [
  {
    id: 'issue-1',
    severity: 'critical' as IssueSeverity,
    title: 'Poor Core Web Vitals on 4 high-traffic pages',
    affectedPages: 4,
    area: 'Core Web Vitals',
    areaKey: 'cwv' as SpeedSubPillarKey,
    impact: 'Search ranking and conversion risk from a poor page experience',
    recommendation: 'Optimize hero image delivery and defer non-critical JS to bring LCP under 2.5s',
  },
  {
    id: 'issue-2',
    severity: 'high' as IssueSeverity,
    title: '428 oversized product images inflating page weight',
    affectedPages: 428,
    area: 'Image Optimization',
    areaKey: 'image-weight' as SpeedSubPillarKey,
    impact: 'Slower page loads across the entire product catalog',
    recommendation: 'Compress and resize oversized images to under 200KB',
  },
  {
    id: 'issue-3',
    severity: 'high' as IssueSeverity,
    title: '6 render-blocking third-party scripts delay first paint',
    affectedPages: 6,
    area: 'App & Script Bloat',
    areaKey: 'app-bloat' as SpeedSubPillarKey,
    impact: 'Delayed interactivity on every storefront page',
    recommendation: 'Defer or async-load blocking scripts outside the critical rendering path',
  },
  {
    id: 'issue-4',
    severity: 'medium' as IssueSeverity,
    title: '858 images still served in legacy JPG/PNG format',
    affectedPages: 858,
    area: 'Image Optimization',
    areaKey: 'image-weight' as SpeedSubPillarKey,
    impact: 'Missed payload savings from modern image formats',
    recommendation: 'Convert legacy images to WebP or AVIF',
  },
  {
    id: 'issue-5',
    severity: 'medium' as IssueSeverity,
    title: '12 unused third-party scripts still loading on every page',
    affectedPages: 12,
    area: 'App & Script Bloat',
    areaKey: 'app-bloat' as SpeedSubPillarKey,
    impact: 'Wasted bandwidth and main-thread execution time',
    recommendation: 'Remove or conditionally load scripts that provide no measurable functionality',
  },
  {
    id: 'issue-6',
    severity: 'low' as IssueSeverity,
    title: '14 unused theme assets bundled into every page load',
    affectedPages: 14,
    area: 'Theme Weight / Fonts / Lazy-load',
    areaKey: 'theme-weight' as SpeedSubPillarKey,
    impact: 'Unnecessary CSS/JS parsing on every page',
    recommendation: 'Purge unused CSS rules and remove redundant font weights',
  },
];

// ─── RECOMMENDED ACTIONS ────────────────────────────────────────────
export const recommendedActions = [
  {
    id: 'action-1',
    title: 'Improve Core Web Vitals on poor-performing pages',
    pages: 4,
    severity: 'critical',
    effort: 'High',
    area: 'Core Web Vitals',
  },
  {
    id: 'action-2',
    title: 'Fix render-blocking scripts',
    pages: 6,
    severity: 'high',
    effort: 'Medium',
    area: 'App & Script Bloat',
  },
  {
    id: 'action-3',
    title: 'Compress oversized product images',
    pages: 428,
    severity: 'high',
    effort: 'Medium',
    area: 'Image Optimization',
  },
  {
    id: 'action-4',
    title: 'Convert legacy images to WebP/AVIF',
    pages: 858,
    severity: 'medium',
    effort: 'Medium',
    area: 'Image Optimization',
  },
  {
    id: 'action-5',
    title: 'Remove unused third-party scripts',
    pages: 12,
    severity: 'medium',
    effort: 'Low',
    area: 'App & Script Bloat',
  },
  {
    id: 'action-6',
    title: 'Purge unused CSS and redundant font weights',
    pages: 14,
    severity: 'low',
    effort: 'Low',
    area: 'Theme Weight / Fonts / Lazy-load',
  },
];

// ─── RECENT ACTIVITY ────────────────────────────────────────────────
export const recentActivity = [
  { id: '1', action: 'Compressed 96 product images to WebP', timestamp: '3 hours ago', type: 'improvement' },
  { id: '2', action: 'Deferred 2 render-blocking scripts on product pages', timestamp: '6 hours ago', type: 'fix' },
  { id: '3', action: 'Removed 4 unused third-party scripts', timestamp: '1 day ago', type: 'fix' },
  { id: '4', action: 'Reduced theme CSS bundle by 42KB', timestamp: '2 days ago', type: 'improvement' },
  { id: '5', action: 'Fixed layout shift on homepage hero section', timestamp: '3 days ago', type: 'fix' },
  { id: '6', action: 'Enabled lazy-loading on 180 below-fold images', timestamp: '4 days ago', type: 'improvement' },
];

// ─── FINDINGS (audit engine model: severity · resolution · lift) ─────
import type { Finding } from '../pillars/finding.types';

export const findings: Finding<SpeedSubPillarKey>[] = [
  {
    id: 'speed-f1',
    areaKey: 'cwv',
    title: `${coreWebVitalsData.poorUrls} high-traffic templates fail Core Web Vitals on mobile`,
    severity: 'critical',
    resolution: 'Service',
    affected: coreWebVitalsData.poorUrls,
    affectedLabel: 'pages',
    scoreLift: 5,
    problem: 'Mobile LCP reaches 3.9s on the homepage and three collection templates; CLS spikes to 0.19 from a late-loading hero banner and unsized promo slots.',
    impact: 'Core Web Vitals are a ranking signal, and every additional 100ms of LCP costs roughly 0.4% conversion on mobile.',
    ctaLabel: 'Request a quote',
    resolvedBy: 'Speed Optimization service · Large scope',
  },
  {
    id: 'speed-f2',
    areaKey: 'image-weight',
    title: `${imageWeightFormatData.oversized} product images over ${imageWeightFormatData.oversizedThresholdKb}KB, ${imageWeightFormatData.legacyFormat} without WebP/AVIF`,
    severity: 'high',
    resolution: 'Automated',
    affected: imageWeightFormatData.oversized,
    affectedLabel: 'images',
    scoreLift: 4,
    problem: `Median oversized product image is ${imageWeightFormatData.averageSizeKb}KB. The CDN supports AVIF, but the theme requests images without width parameters so the original is served.`,
    impact: `Re-encoding and right-sizing saves ~${imageWeightFormatData.potentialSavingsMb}MB across the catalog and ~1.4s on 3G product pages.`,
    ctaLabel: 'Preview & fix',
    resolvedBy: 'Scorelo Auto-fix',
  },
  {
    id: 'speed-f3',
    areaKey: 'app-bloat',
    title: `${appScriptBloatData.unusedScripts} installed apps inject scripts but aren't used`,
    severity: 'high',
    resolution: 'Service',
    affected: appScriptBloatData.unusedScripts,
    affectedLabel: 'scripts',
    scoreLift: 3,
    problem: 'A legacy review widget, two expired popup apps and a discontinued upsell app still load on every page; 6 scripts are render-blocking.',
    impact: 'Removing them saves ~340KB of JavaScript per page and frees main-thread time before first interaction.',
    ctaLabel: 'Request a quote',
    resolvedBy: 'Speed Optimization service · Small scope',
  },
  {
    id: 'speed-f4',
    areaKey: 'theme-weight',
    title: 'Fonts and hero video block first paint',
    severity: 'medium',
    resolution: 'Service',
    affected: 1,
    affectedLabel: 'theme',
    scoreLift: 2,
    problem: `${themeWeightFontsData.fontRequests} font requests load eagerly (only ${themeWeightFontsData.recommendedFontRequests} needed above the fold) and the homepage hero MP4 autoplays without preload="metadata".`,
    impact: 'Deferring non-critical weights and lazy-loading the hero video lifts mobile LCP by ~1.1s on mid-range devices.',
    ctaLabel: 'Request a quote',
    resolvedBy: 'Theme Customization service · Small scope',
  },
];
