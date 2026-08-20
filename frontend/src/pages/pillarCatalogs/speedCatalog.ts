import type { GenericSubPillarConfig } from '../PillarSubPillarPage';
import { coreWebVitalsData, imageWeightFormatData, appScriptBloatData, themeWeightFontsData, priorityIssues } from '../../data/speed/speed.mock';

const status = (score: number) => score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';
const issueSet = (key: string) => priorityIssues.filter((issue) => issue.areaKey === key).map((issue) => ({ id: issue.id, severity: issue.severity, title: issue.title, affected: issue.affectedPages, recommendation: issue.recommendation }));
const base = (key: string, title: string, description: string, score: number, analyzedLabel: string, analyzed: number, healthy: number, metrics: GenericSubPillarConfig['metrics'], breakdown: GenericSubPillarConfig['breakdown']): GenericSubPillarConfig => ({ pillar: 'speed', pillarLabel: 'Speed', key, title, description, score, statusLabel: status(score), analyzedLabel, analyzed, healthy, metrics, breakdown, issues: issueSet(key) });

export const speedPillarCatalog: Record<string, GenericSubPillarConfig> = {
  'speed/cwv': base('cwv', 'Core Web Vitals', 'Monitor the real page-experience signals that affect search visibility, usability, and conversion.', coreWebVitalsData.score, 'Pages', coreWebVitalsData.pagesAnalyzed, coreWebVitalsData.goodUrls, [
    { label: 'Good URLs', value: coreWebVitalsData.goodUrls, description: 'pages pass the experience threshold' },
    { label: 'Needs improvement', value: coreWebVitalsData.needsImprovementUrls, description: 'pages need focused optimization' },
    { label: 'Poor URLs', value: coreWebVitalsData.poorUrls, description: 'pages require urgent attention' },
  ], [
    { label: 'Good', value: coreWebVitalsData.goodUrls, color: 'bg-success-500' },
    { label: 'Needs improvement', value: coreWebVitalsData.needsImprovementUrls, color: 'bg-warning-500' },
    { label: 'Poor', value: coreWebVitalsData.poorUrls, color: 'bg-critical-500' },
  ]),
  'speed/image-weight': base('image-weight', 'Image Weight & Format', 'Reduce payload weight with correctly sized, compressed, modern image formats.', imageWeightFormatData.score, 'Images', imageWeightFormatData.imagesAnalyzed, imageWeightFormatData.optimized, [
    { label: 'Oversized images', value: imageWeightFormatData.oversized, description: 'images exceed the recommended payload' },
    { label: 'Legacy formats', value: imageWeightFormatData.legacyFormat, description: 'images can move to WebP or AVIF' },
    { label: 'Optimized images', value: imageWeightFormatData.optimized, description: 'images meet the optimization standard' },
  ], [
    { label: 'Optimized', value: imageWeightFormatData.optimized, color: 'bg-success-500' },
    { label: 'Oversized', value: imageWeightFormatData.oversized, color: 'bg-warning-500' },
    { label: 'Legacy format', value: imageWeightFormatData.legacyFormat, color: 'bg-surface-400' },
  ]),
  'speed/app-bloat': base('app-bloat', 'App & Script Bloat', 'Keep third-party code intentional so the storefront stays responsive and easy to operate.', appScriptBloatData.score, 'Scripts', appScriptBloatData.scriptsAnalyzed, appScriptBloatData.scriptsAnalyzed - appScriptBloatData.unusedScripts, [
    { label: 'Heavy scripts', value: appScriptBloatData.heavyScripts, description: 'scripts have a high execution cost' },
    { label: 'Blocking scripts', value: appScriptBloatData.blockingScripts, description: 'scripts delay first paint or interaction' },
    { label: 'Unused scripts', value: appScriptBloatData.unusedScripts, description: 'scripts load without measurable value' },
  ], [
    { label: 'Useful scripts', value: appScriptBloatData.scriptsAnalyzed - appScriptBloatData.unusedScripts, color: 'bg-success-500' },
    { label: 'Unused', value: appScriptBloatData.unusedScripts, color: 'bg-warning-500' },
  ]),
  'speed/theme-weight': base('theme-weight', 'Theme Weight / Fonts / Lazy-load', 'Trim theme overhead and defer below-the-fold work without sacrificing the storefront experience.', themeWeightFontsData.score, 'Images', themeWeightFontsData.belowFoldImagesAnalyzed, themeWeightFontsData.lazyLoadedImages, [
    { label: 'Lazy-loaded images', value: themeWeightFontsData.lazyLoadedImages, description: 'below-fold images defer correctly' },
    { label: 'Unused assets', value: themeWeightFontsData.unusedAssets, description: 'assets are bundled without use' },
    { label: 'Render-blocking CSS', value: themeWeightFontsData.renderBlockingCssFiles, description: 'files delay initial rendering' },
  ], [
    { label: 'Lazy loaded', value: themeWeightFontsData.lazyLoadedImages, color: 'bg-success-500' },
    { label: 'Needs review', value: themeWeightFontsData.unusedAssets, color: 'bg-warning-500' },
  ]),
};
