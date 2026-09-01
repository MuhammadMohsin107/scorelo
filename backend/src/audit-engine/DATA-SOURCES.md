# Sub-pillar → data source map

What every one of the 33 sub-pillars needs, where that data can actually come from, and which
Shopify scope (if any) unlocks it.

This exists because "we have the Shopify Admin API" is not the same as "we can answer every SEO
question". A large share of Scorelo's checks are about what a *rendered page* contains — canonical
tags, JSON-LD, heading structure, script weight — and the Admin API cannot see any of that. Writing
a check that infers a rendered outcome from an Admin API field would produce a confident, wrong
score. The **Source** column below is the guard against that.

## Sources

| Key | Meaning |
|---|---|
| **Admin** | Shopify Admin GraphQL API — already implemented in `store-data/shopify.provider.ts` |
| **Crawl** | Rendered storefront HTML, fetched by `audit-engine/storefront/crawler.ts`. **Implemented.** |
| **Lab** | Requires a performance measurement tool (Lighthouse / PageSpeed Insights / CrUX). **Not implemented.** |
| **Protected** | Requires a scope Scorelo deliberately does not request (`read_orders` / `read_customers`), which needs Shopify Protected Customer Data approval |

## Granted scopes

| Scope | Unlocks | Used by |
|---|---|---|
| `read_products` | Product, Collection: title, `descriptionHtml`, `seo`, media alt text, metafields, product options, variants (sku/barcode/price/availability), `sellingPlanGroupCount` | SEO, Content, CRO, AI Discovery |
| `read_content` | Page, Blog, Article (implicitly grants `read_online_store_pages`) | SEO, Content |
| `read_themes` | Online store theme records | Speed |
| `read_metaobjects` | Metaobject instances | Content, AI Discovery |
| `read_legal_policies` | Shop policies (refund/shipping/privacy/terms) | CRO |

---

## SEO (8)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `title-tags` | `Product.seo.title`, `Collection.seo.title`, Page/Article `global.title_tag` metafield, fallback titles | Admin | `read_products`, `read_content` | **Implemented** — `checks/seo/title-tags.ts` |
| `meta-descriptions` | `.seo.description` + `global.description_tag` | Admin | `read_products`, `read_content` | **Implemented** — `checks/seo/meta-descriptions.ts` |
| `schema` | JSON-LD blocks in rendered page `<head>` | **Crawl** | — | **Implemented** — `checks/seo/schema.ts` |
| `image-alt-text` | `MediaImage.alt` for catalog images; rendered `<img alt>` for theme images | Admin (partial) + **Crawl** | `read_products` | **Implemented (Admin half)** — `checks/seo/image-alt-text.ts`; rendered theme images are reported by `checks/cro/clarity.ts` |
| `canonicals` | `<link rel="canonical">` as rendered; duplicate handle detection | **Crawl** (+ Admin for handles) | `read_products` | **Implemented (Admin half)** — `checks/seo/canonicals.ts`; rendered canonical is now captured by the crawler and not yet consumed |
| `handles-redirects` | `UrlRedirect` records, handle quality | Admin | **`read_online_store_navigation` — NOT granted** | **Requires additional Shopify permission** |
| `sitemap` | `/sitemap.xml`, `/robots.txt`, per-page `noindex` | **Crawl** | — | **Implemented** — `checks/seo/sitemap-indexability.ts` |
| `internal-links` | Rendered anchor graph, HTTP status of each target | **Crawl** | — | **Implemented** — `checks/seo/internal-links.ts` |

## Content (6)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `product-descriptions` | `Product.descriptionHtml` | Admin | `read_products` | **Implemented** — `checks/content/descriptions.ts` |
| `collection-descriptions` | `Collection.descriptionHtml` | Admin | `read_products` | **Implemented** — `checks/content/descriptions.ts` |
| `metafields` | `Product.metafields`, metaobject definitions | Admin | `read_products`, `read_metaobjects` | **Implemented** — `checks/content/metafields.ts` |
| `dup-templated` | Description corpus across products for similarity | Admin | `read_products` | **Implemented** — `checks/content/dup-templated.ts` |
| `blog-freshness` | `Article.publishedAt` / `updatedAt` | Admin | `read_content` | **Implemented** — `checks/content/blog-freshness.ts` |
| `media-richness` | Media count per product/article | Admin | `read_products`, `read_content` | **Implemented** — `checks/content/media-richness.ts` |

## Speed (4)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `cwv` | LCP, INP, CLS — field (CrUX) or lab (Lighthouse) | **Lab** | — | **Implemented as `not_measured`** — needs real performance tooling |
| `image-weight` | Transferred bytes and dimensions per rendered image | **Lab** + Admin (dimensions) | `read_products` | **Implemented (Admin half)** — `checks/speed/image-weight.ts`; transferred bytes still need Lab |
| `app-bloat` | Third-party scripts on the rendered page | **Crawl** | — | **Implemented (Admin half)** — `checks/speed/app-bloat.ts`; rendered scripts are now captured by the crawler and not yet consumed |
| `theme-weight` | Theme record + rendered asset weight, font loading, lazy-load | Admin (partial) + **Lab** | `read_themes` | **Implemented (Admin half)** — `checks/speed/theme-weight.ts` |

## CRO (11)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `clarity` | Rendered PDP structure and copy hierarchy | **Crawl** | — | **Implemented** — `checks/cro/clarity.ts` (objective structure only) |
| `cart-recovery` | Abandoned checkout behaviour | **Protected** | `read_orders` — not granted | **Requires additional Shopify permission** |
| `trust` | Review widgets, badges, policy links as rendered | **Crawl** (+ Admin for policies) | `read_content` | **Implemented** — `checks/cro/storefront-signals.ts` |
| `returns` | `ShopPolicy` of type `REFUND_POLICY` | Admin | `read_legal_policies` | **Implemented** — `checks/cro/returns.ts` |
| `tracking` | Fulfilment/tracking configuration | **Protected** | `read_orders` — not granted | **Requires additional Shopify permission** |
| `cod` | Payment method configuration at checkout | **Checkout — not readable** | — | **Implemented as permanently `not_measured`** — page copy is not proof of checkout config |
| `options` | `Product.options`, variant structure | Admin | `read_products` | **Implemented** — `checks/cro/options.ts` |
| `subscription` | Selling plan groups | Admin | `read_products` | **Implemented** — `checks/cro/subscription.ts` |
| `wishlist` | Wishlist app presence on rendered page | **Crawl** | — | **Implemented** — `checks/cro/storefront-signals.ts` |
| `locator` | Store locator page/app presence | **Crawl** (+ Admin for pages) | `read_content` | **Implemented** — `checks/cro/storefront-signals.ts` |
| `mobile-ux` | Rendered mobile viewport behaviour | **Lab** | — | **Implemented as `not_measured`** — needs a rendering browser |

## AI Discovery (4)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `agents-md` | `/agents.md`, `/llms.txt` at the storefront root | **Crawl** | — | **Implemented** — `checks/ai-discovery/agents-md.ts` |
| `agentic-attrs` | Structured product attributes | Admin | `read_products`, `read_metaobjects` | **Implemented** — `checks/ai-discovery/agentic-attrs.ts` |
| `answerable-qa` | FAQ content + FAQPage JSON-LD as rendered | Admin (content) + **Crawl** (schema) | `read_content`, `read_metaobjects` | Partially supported |
| `feed` | Product identifiers, availability, price completeness | Admin | `read_products` | **Implemented** — `checks/ai-discovery/feed.ts` |

---

## Summary

Recalculated from `checkRegistry` in `index.ts`, which is the only source of truth. The table
above and these counts are derived from the same 33 rows and must always agree.

### Implementation

| | Count |
|---|---|
| Sub-pillars total | **33** |
| Registered in `checkRegistry` | **30** |
| Not implemented | **3** |

By pillar: SEO 8/8 · Content 6/6 · Speed 4/4 · CRO 9/11 · AI Discovery 3/4.

The 3 unimplemented rows are `cro/cart-recovery`, `cro/tracking` (both need `read_orders`, which
requires Shopify Protected Customer Data approval) and `ai-discovery/answerable-qa`.

### Evidence source

| Source | Count |
|---|---|
| Admin only | **17** |
| Crawl only | **7** |
| Admin + Crawl (partially answerable from each) | **6** |
| Lab-dependent | **1** |
| Checkout config — not readable by any current permission | **1** |
| Requires a Shopify permission not currently requested | **2** |

The 7 Crawl-only rows are `schema`, `internal-links`, `clarity`, `wishlist`, `locator`,
`agents-md` and `sitemap`. The 6 Admin+Crawl rows are `image-alt-text`, `canonicals`, `trust`,
`app-bloat`, `theme-weight` and `answerable-qa` — each has an Admin half that is implemented and
a rendered half that the crawler now captures.

**So: 13 sub-pillars have a storefront-crawl dependency — 7 require crawling entirely, and 6 are
partially answerable from Admin data and need crawling for complete verification.** They are not
all unavailable: `sitemap` was already answerable from HTTP probes, and every Admin half listed
above scores today.

### Registered but permanently or temporarily `not_measured`

Four registered checks return `unavailable` by design rather than a score, because the evidence
genuinely does not exist yet. They are registered so the UI can explain WHY rather than render an
empty state with no reason:

| Sub-pillar | Reason |
|---|---|
| `speed/cwv` | Needs real performance tooling (Lighthouse / CrUX) |
| `cro/mobile-ux` | Needs a rendering browser at a phone viewport |
| `cro/cod` | Checkout payment configuration is not inspectable; page copy is not proof |
| `seo/handles-redirects` | Needs `read_online_store_navigation`, not granted |

`cro/returns` and `cro/subscription` also report `unavailable` on some stores — the first when
`read_legal_policies` has not been granted, the second when the store runs no subscription
programme at all. Both score normally otherwise.

### The rule these counts encode

An `unavailable` sub-pillar is EXCLUDED from every average (see `scoring.ts`), never counted as
zero. A store is never marked down for something Scorelo could not measure — only for something
it measured and found wanting. `implementedSubPillars` is derived from the registry, so this file
can go stale without the product lying to anyone.
