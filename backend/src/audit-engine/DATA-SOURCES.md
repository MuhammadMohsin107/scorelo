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
| **Crawl** | Requires fetching and parsing rendered storefront HTML. **Not implemented.** |
| **Lab** | Requires a performance measurement tool (Lighthouse / PageSpeed Insights / CrUX). **Not implemented.** |
| **Protected** | Requires a scope Scorelo deliberately does not request (`read_orders` / `read_customers`), which needs Shopify Protected Customer Data approval |

## Granted scopes

| Scope | Unlocks | Used by |
|---|---|---|
| `read_products` | Product, Collection: title, `descriptionHtml`, `seo`, media alt text, metafields | SEO, Content, CRO |
| `read_content` | Page, Blog, Article (implicitly grants `read_online_store_pages`) | SEO, Content |
| `read_themes` | Online store theme records | Speed |
| `read_metaobjects` | Metaobject instances | Content, AI Discovery |

---

## SEO (8)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `title-tags` | `Product.seo.title`, `Collection.seo.title`, Page/Article `global.title_tag` metafield, fallback titles | Admin | `read_products`, `read_content` | Supported — data available, **checker not implemented** |
| `meta-descriptions` | `.seo.description` + `global.description_tag` | Admin | `read_products`, `read_content` | Supported — **checker not implemented** |
| `schema` | JSON-LD blocks in rendered page `<head>` | **Crawl** | — | **Requires storefront crawl** |
| `image-alt-text` | `MediaImage.alt` for catalog images; rendered `<img alt>` for theme images | Admin (partial) + **Crawl** | `read_products` | Partially supported — Admin covers product media only |
| `canonicals` | `<link rel="canonical">` as rendered; duplicate handle detection | **Crawl** (+ Admin for handles) | `read_products` | **Requires storefront crawl** |
| `handles-redirects` | `UrlRedirect` records, handle quality | Admin | **`read_online_store_navigation` — NOT granted** | **Requires additional Shopify permission** |
| `sitemap` | `/sitemap.xml`, `/robots.txt`, per-page `noindex` | **Crawl** | — | **Requires storefront crawl** |
| `internal-links` | Rendered anchor graph, HTTP status of each target | **Crawl** | — | **Requires storefront crawl** |

## Content (6)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `product-descriptions` | `Product.descriptionHtml` | Admin | `read_products` | Supported — **checker not implemented** |
| `collection-descriptions` | `Collection.descriptionHtml` | Admin | `read_products` | Supported — **checker not implemented** |
| `metafields` | `Product.metafields`, metaobject definitions | Admin | `read_products`, `read_metaobjects` | Supported — **checker not implemented** |
| `dup-templated` | Description corpus across products for similarity | Admin | `read_products` | Supported — **checker not implemented** |
| `blog-freshness` | `Article.publishedAt` / `updatedAt` | Admin | `read_content` | Supported — **checker not implemented** |
| `media-richness` | Media count per product/article | Admin | `read_products`, `read_content` | Supported — **checker not implemented** |

## Speed (4)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `cwv` | LCP, INP, CLS — field (CrUX) or lab (Lighthouse) | **Lab** | — | **Requires measurement tooling** |
| `image-weight` | Transferred bytes and dimensions per rendered image | **Lab** + Admin (dimensions) | `read_products` | Partially supported — Admin gives dimensions, not bytes |
| `app-bloat` | Third-party scripts on the rendered page | **Crawl** | — | **Requires storefront crawl** |
| `theme-weight` | Theme record + rendered asset weight, font loading, lazy-load | Admin (partial) + **Lab** | `read_themes` | Partially supported |

## CRO (11)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `clarity` | Rendered PDP structure and copy hierarchy | **Crawl** | — | **Requires storefront crawl** |
| `cart-recovery` | Abandoned checkout behaviour | **Protected** | `read_orders` — not granted | **Requires additional Shopify permission** |
| `trust` | Review widgets, badges, policy links as rendered | **Crawl** (+ Admin for policies) | `read_content` | Partially supported — policy presence only |
| `returns` | `ShopPolicy` of type `REFUND_POLICY` | Admin | `read_content` | Supported — **checker not implemented** |
| `tracking` | Fulfilment/tracking configuration | **Protected** | `read_orders` — not granted | **Requires additional Shopify permission** |
| `cod` | Payment method configuration at checkout | **Crawl** | — | **Requires storefront crawl** |
| `options` | `Product.options`, variant structure | Admin | `read_products` | Supported — **checker not implemented** |
| `subscription` | Selling plan groups | Admin | `read_products` | Supported — **checker not implemented** |
| `wishlist` | Wishlist app presence on rendered page | **Crawl** | — | **Requires storefront crawl** |
| `locator` | Store locator page/app presence | **Crawl** (+ Admin for pages) | `read_content` | Partially supported |
| `mobile-ux` | Rendered mobile viewport behaviour | **Crawl** + **Lab** | — | **Requires storefront crawl** |

## AI Discovery (4)

| Sub-pillar | Required data | Source | Scope | Status |
|---|---|---|---|---|
| `agents-md` | `/agents.md`, `/llms.txt` at the storefront root | **Crawl** | — | **Requires storefront crawl** |
| `agentic-attrs` | Structured product attributes | Admin | `read_products`, `read_metaobjects` | Supported — **checker not implemented** |
| `answerable-qa` | FAQ content + FAQPage JSON-LD as rendered | Admin (content) + **Crawl** (schema) | `read_content`, `read_metaobjects` | Partially supported |
| `feed` | Product identifiers, availability, price completeness | Admin | `read_products` | Supported — **checker not implemented** |

---

## Summary

| Status | Count |
|---|---|
| Fully answerable from data the connector already fetches | **14** |
| Partially answerable (Admin covers part; rest needs crawl/lab) | **6** |
| Requires a storefront crawler | **10** |
| Requires performance measurement tooling | **1** |
| Requires a Shopify permission not currently requested | **3** |

**Checkers implemented today: 0.** `checkRegistry` in `index.ts` is an empty array. Every sub-pillar
above reports "not measured" in the UI, which is the intended honest behaviour until real checks
exist — the pillar pages render empty states rather than invented scores.

The 14 fully-supported rows are the correct place to start: they need no new infrastructure, only
check implementations against the snapshot the provider already produces.
