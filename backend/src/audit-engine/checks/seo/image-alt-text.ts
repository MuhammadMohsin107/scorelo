import type { AuditCheck, SubPillarEvidenceRow, SubPillarFindingResult, SubPillarResult } from '../../types.js';
import { unavailableResult } from '../../types.js';
import { scoreSubPillar } from '../../scoring.js';
import type { StoreSnapshot } from '../../store-data/types.js';
import { formatCount, takeEvidenceSample } from './page-inventory.js';

/**
 * ─── SEO · Image alt text ────────────────────────────────────────────
 * Scores alt-text coverage across PRODUCT MEDIA.
 *
 * SCOPE LIMIT — STATED, NOT HIDDEN
 * The unit analyzed is the product, and the only images visible to this check are the ones
 * attached to products in the Admin API. Theme images (banners, logos, lookbooks, section
 * backgrounds) are rendered by Liquid and are invisible here. So this check measures catalog
 * alt coverage, NOT whole-page image accessibility, and the summary says so. Completing that
 * picture requires the storefront crawl layer.
 *
 * WHY `alt: null` AND `alt: ''` ARE DIFFERENT
 * The snapshot deliberately preserves the distinction (see SnapshotImage): null means the
 * attribute is genuinely absent, '' means it is present but empty. Both fail this check — a
 * screen reader gets nothing either way — but they are counted and reported separately because
 * an empty string is a deliberate "decorative" marker that is simply being misused on catalog
 * imagery, and the fix differs.
 *
 * A product is healthy only when EVERY one of its images has non-empty alt text. Partial
 * coverage is a partial failure; averaging it away would hide products that are mostly unlabelled.
 */

const COMPLETE = 'Healthy';
const PARTIAL = 'Partial';
const NONE = 'Missing';

export const imageAltTextCheck: AuditCheck = {
  id: 'seo.image-alt-text',
  pillar: 'seo',
  subPillar: 'image-alt-text',

  execute(snapshot: StoreSnapshot): SubPillarResult {
    if (!snapshot.coverage.products) {
      return unavailableResult('image-alt-text', 'Scorelo could not read products from this store, so image alt text could not be checked.');
    }

    // Only products that actually have images can have alt text. Products with no media are
    // excluded from the denominator entirely — their problem is "no images", which media-richness
    // scores. Counting them here would double-penalize one defect across two sub-pillars.
    const withImages = snapshot.products.filter((product) => product.images.length > 0);
    if (withImages.length === 0) {
      return unavailableResult('image-alt-text', 'No product images were found, so alt-text coverage could not be measured.');
    }

    const counts: Record<string, number> = { [COMPLETE]: 0, [PARTIAL]: 0, [NONE]: 0 };
    const rows: SubPillarEvidenceRow[] = [];
    let totalImages = 0;
    let labelledImages = 0;
    let nullAlt = 0;
    let emptyAlt = 0;

    for (const product of withImages) {
      const images = product.images;
      let labelled = 0;
      for (const image of images) {
        totalImages += 1;
        if (image.alt === null) nullAlt += 1;
        else if (image.alt.trim() === '') emptyAlt += 1;
        else { labelled += 1; labelledImages += 1; }
      }

      const status = labelled === images.length ? COMPLETE : labelled === 0 ? NONE : PARTIAL;
      counts[status] += 1;

      rows.push({
        id: `product:${product.id}`,
        status,
        facet: 'Product',
        cells: {
          url: product.url,
          pageType: 'Product',
          title: product.title,
          length: images.length - labelled,
        },
        current: {
          label: 'Alt text coverage',
          value: `${labelled} of ${images.length} images labelled`,
          meta: product.title,
        },
      });
    }

    const analyzed = withImages.length;
    const healthy = counts[COMPLETE];
    const unlabelled = totalImages - labelledImages;
    const findings: SubPillarFindingResult[] = [];
    const lift = (n: number) => Math.round((n / analyzed) * 100);

    if (counts[NONE] > 0) {
      findings.push({
        title: 'Products with no image alt text at all',
        severity: 'high',
        affectedCount: counts[NONE],
        affectedLabel: 'products',
        impact: 'High',
        scoreLift: lift(counts[NONE]),
        resolutionType: 'media',
        problem: `${formatCount(counts[NONE])} products have no alt text on any image.`,
        why: 'Screen-reader users get no description of the product at all, and search engines lose the only text signal an image carries — which is what image search ranks on.',
        recommendation: 'Describe what each photo shows, specifically. "Navy merino sweater, front view" beats "sweater image".',
        evidence: [
          `${formatCount(counts[NONE])} of ${formatCount(analyzed)} products with images have zero labelled images.`,
          `${formatCount(nullAlt)} images have no alt attribute; ${formatCount(emptyAlt)} have an empty one.`,
        ],
        details: { issueType: NONE, effort: 'High' },
      });
    }

    if (counts[PARTIAL] > 0) {
      findings.push({
        title: 'Products with partially labelled images',
        severity: 'medium',
        affectedCount: counts[PARTIAL],
        affectedLabel: 'products',
        impact: 'Medium',
        scoreLift: lift(counts[PARTIAL]),
        resolutionType: 'media',
        problem: `${formatCount(counts[PARTIAL])} products have some images labelled and others not.`,
        why: 'A gallery that is only partly described reads as incomplete to assistive technology, and the unlabelled images stay invisible to image search.',
        recommendation: 'Fill the gaps so every image in the gallery carries its own description.',
        evidence: [`${formatCount(unlabelled)} of ${formatCount(totalImages)} product images are unlabelled.`],
        details: { issueType: PARTIAL, effort: 'Medium' },
      });
    }

    return {
      subPillar: 'image-alt-text',
      status: 'ok',
      score: scoreSubPillar(analyzed, healthy, findings),
      analyzedCount: analyzed,
      healthyCount: healthy,
      details: {
        status: 'ok',
        summary: `${formatCount(healthy)} of ${formatCount(analyzed)} products have alt text on every image (${formatCount(labelledImages)} of ${formatCount(totalImages)} images labelled). Catalog images only — theme and banner images are not visible to the Admin API.`,
        healthChip: `${((healthy / analyzed) * 100).toFixed(1)}% healthy`,
        contextLabel: 'Images labelled',
        contextValue: `${formatCount(labelledImages)} / ${formatCount(totalImages)}`,
        evidenceRows: takeEvidenceSample(rows, COMPLETE),
      },
      findings,
    };
  },
};
