# Scorelo Audit Engine — Working Flow & Scoring Report

> How Scorelo turns a live Shopify store into five pillar scores and one overall number.
> Every statement below is drawn from the code in `backend/src/audit-engine/`.

---

## 1. Executive summary

Scorelo runs **30 independent checks** against a single snapshot of a merchant's store, taken from
two real sources: the **Shopify Admin GraphQL API** and a **live crawl of the storefront's HTML**.

Each check reports only *facts* — how many items it analysed, how many were healthy, and what
findings resulted. It never decides its own score. A single module, `scoring.ts`, converts those
facts into numbers using one formula applied at three levels:

```
sub-pillar score  →  pillar score  →  overall score
```

The engine has four deliberate properties:

| Property | Meaning |
|---|---|
| **Deterministic** | No randomness, no time-dependence. Same snapshot → same score, always. |
| **Bounded** | Every score is an integer 0–100. |
| **Explainable** | Every number traces back to counts and findings a customer can inspect. |
| **Testable** | Scoring is pure functions with unit tests (`src/tests/scoring.test.ts`). |

---

## 2. End-to-end flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. TRIGGER                                                          │
│    POST /api/audits/run   →  202 Accepted + job record              │
│    createAuditJob() refuses if a job is already queued/running       │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. SNAPSHOT                                                         │
│    Shopify Admin GraphQL  +  Storefront crawl (≤40 pages)           │
│    +  direct HTTP probes (robots.txt, sitemap.xml, agents.md,       │
│       llms.txt)                                                     │
│    → one normalised StoreSnapshot object                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. CHECKS                                                           │
│    30 checks run in sequence against that ONE shared snapshot.       │
│    Each returns { analyzedCount, healthyCount, findings[] }          │
│    A throwing check is isolated → 'unavailable', run continues.      │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. SCORING  (scoring.ts — the only place scores are produced)        │
│    scoreSubPillar()  round(healthy/analyzed×100), capped by severity │
│    scorePillar()     mean of that pillar's MEASURED sub-pillars      │
│    scoreOverall()    mean of MEASURED pillar scores                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. PERSIST  (one DB transaction)                                    │
│    audits  ·  audit_scores (pillar + sub-pillar rows)  ·  findings   │
│    Job marked succeeded / failed. Never left stuck in 'running'.     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Trigger and job lifecycle

**Endpoint:** `POST /api/audits/run` → `postRunAudit` → `createAuditJob()`

- Returns **HTTP 202** immediately with a job record — the audit runs in the background.
- A new job is refused while another is `queued` or `running` for the same store, so a merchant
  cannot stack concurrent audits.
- `runAuditJob(jobId)` is fire-and-forget but **owns the full lifecycle**. It is written so it can
  never throw: every exit path writes a terminal status (`succeeded` or `failed`), which guarantees
  a job is never left stuck in `running`.
- Progress is reported as `done / total` checks, so the UI can show a live progress bar.

**Poll:** `GET /api/jobs/:id`

---

## 4. Data collection

### 4.1 Shopify Admin GraphQL API

Read using the five OAuth scopes the app requests:

| Scope | What it unlocks |
|---|---|
| `read_products` | Products, variants, options, images, metafields, SEO title/description, selling plans |
| `read_content` | Pages, blogs, articles |
| `read_themes` | Theme asset bytes, app embeds, hardcoded layout scripts |
| `read_metaobjects` | Metaobject instances |
| `read_legal_policies` | Refund / shipping / privacy policy text |

`read_orders` and `read_customers` are **deliberately not requested** — they are Protected Customer
Data and no Scorelo check reads an order or a customer.

The snapshot records **coverage honestly**: how many products were analysed versus how many exist,
whether Shopify reported an exact total or only `AT_LEAST`, and whether the catalogue was truncated.
A partially-scanned catalogue is never presented as a full scan.

### 4.2 Live storefront crawl

Real HTTP requests against the merchant's published storefront.

| Setting | Default | Env var |
|---|---|---|
| Max pages per audit | **40** | `CRAWL_MAX_PAGES` |
| Per-request timeout | **12,000 ms** | `CRAWL_TIMEOUT_MS` |
| Concurrent requests to one shop | **3** | `CRAWL_CONCURRENCY` |
| User agent | `ScoreloAuditBot/1.0 (+https://scorelo.app/bot)` | `CRAWL_USER_AGENT` |
| Storefront password (gated stores) | — | `CRAWL_STOREFRONT_PASSWORD` |
| Kill switch | enabled | `CRAWL_ENABLED=false` |

The page budget is spread across resource types rather than taken from the head of a list:

```
homepage  +  50% product  ·  20% collection  ·  15% page  ·  15% article
```

Products dominate because a store has more product templates in play, but never to the exclusion
of the rest.

### 4.3 Gate-independent probes

Fetched separately because they are served from the CDN edge and remain readable even on a
password-protected store:

- `/robots.txt`
- `/sitemap.xml` (plus any sitemaps declared inside robots.txt)
- `/agents.md`
- `/llms.txt`

---

## 5. The check contract

Every check implements one interface:

```ts
interface AuditCheck {
  id: string;              // e.g. 'seo.title-tags'
  pillar: PillarKey;       // seo | content | speed | cro | ai-discovery
  subPillar: string;       // route slug, e.g. 'title-tags'
  execute(snapshot): SubPillarResult;
}
```

Checks are **pure functions of a normalised snapshot** — no Shopify calls, no database access, no
UI coupling. That is what makes them unit-testable in isolation and what lets the runner isolate
their failures.

Each returns:

```ts
{
  subPillar, status: 'ok' | 'unavailable',
  score, analyzedCount, healthyCount,
  details: { summary, healthChip, contextLabel, contextValue, evidenceRows[] },
  findings: [ { title, severity, affectedCount, impact, scoreLift,
                problem, why, recommendation, evidence[], evidenceRows[] } ]
}
```

`evidenceRows` name the exact affected resources, so a customer can always answer
*"which of my products caused this?"*

### Failure isolation

If a check throws, the runner catches it, records `unavailable` for **that sub-pillar only**, logs
the failure, and continues. One broken check can never discard an entire audit, and its failure is
surfaced honestly rather than scored as a zero.

---

## 6. The 30 checks

### SEO — 8 checks

| Check | What it measures | Thresholds |
|---|---|---|
| `seo.title-tags` | Title presence, length, uniqueness across all pages | Healthy = **30–60 chars**, unique, non-empty |
| `seo.meta-descriptions` | Meta description presence and length | Healthy = **70–160 chars** |
| `seo.image-alt-text` | Alt text on catalogue media | Catalogue images only — theme images need the crawl |
| `seo.canonicals` | Duplicate handles (Admin) + canonical tags (crawl) | — |
| `seo.sitemap` | Live probes: storefront gate, robots.txt, sitemap.xml | Real HTTP status codes |
| `seo.handles-redirects` | URL handle hygiene and redirects | Reports *unavailable* until `read_online_store_navigation` is granted |
| `seo.schema` | Rendered JSON-LD structured data | Parsed from crawled HTML |
| `seo.internal-links` | Rendered anchors + verified target status | Healthy = **≥3 internal links** per page |

### Content — 6 checks

| Check | What it measures | Thresholds |
|---|---|---|
| `content.product-descriptions` | Product description depth | Healthy = **≥50 words** |
| `content.collection-descriptions` | Collection description depth | Healthy = **≥20 words** |
| `content.metafields` | Metafield coverage on products | — |
| `content.dup-templated` | Duplicate / templated copy across items | Compared at **≥20 words** |
| `content.blog-freshness` | Article recency | Fresh **≤90 days**, aging **≤365 days**, stale beyond |
| `content.media-richness` | Image and media coverage per item | — |

### Speed — 4 checks

| Check | What it measures | Thresholds |
|---|---|---|
| `speed.image-weight` | Source dimensions and format from the Admin API | — |
| `speed.theme-weight` | Real theme asset bytes via `read_themes` | JS heavy **>100 KB**, CSS **>120 KB**, fonts **>150 KB** |
| `speed.app-bloat` | App embeds and hardcoded layout scripts | — |
| `speed.cwv` | Core Web Vitals | **Always unavailable** — requires lab tooling that does not exist yet |

### CRO — 9 checks

| Check | What it measures | Thresholds |
|---|---|---|
| `cro.returns` | Real refund policy text via `read_content` | Healthy = **≥40 useful bytes** of policy |
| `cro.options` | Option/variant structure (ignores Shopify's synthetic `Default Title`) | — |
| `cro.subscription` | Selling-plan enrolment | *Unavailable* when no subscription programme exists |
| `cro.clarity` | Rendered heading and content structure | Healthy = **≥200 chars** body text |
| `cro.trust` | Rendered trust signals (badges, guarantees, reviews) | — |
| `cro.wishlist` | Rendered wishlist evidence | — |
| `cro.locator` | Rendered store-locator evidence | — |
| `cro.cod` | Cash-on-delivery availability | **Always unavailable** — checkout payment config is not readable |
| `cro.mobile-ux` | Mobile experience | **Always unavailable** — needs a rendering browser |

### AI Discovery — 3 checks

| Check | What it measures |
|---|---|
| `ai-discovery.feed` | Variant identifiers (GTIN/barcode/SKU), price and availability completeness |
| `ai-discovery.agentic-attrs` | Purchase-action readiness from the same variant data |
| `ai-discovery.agents-md` | Real HTTP requests for `/agents.md` and `/llms.txt` |

---

## 7. Scoring

All scoring lives in **one file**: `backend/src/audit-engine/scoring.ts`. No check computes its own
score; no controller adjusts one afterwards.

### 7.1 Level 1 — Sub-pillar score

```js
raw   = round(healthy / analyzed × 100)
score = min(raw, severityCap)          // then clamped to 0–100
```

**Severity caps.** The worst finding present bounds the score, so a store with a critical defect
cannot show a reassuring number just because most resources passed:

| Worst finding severity | Score ceiling |
|---|---|
| `critical` | **60** |
| `high` | **80** |
| `medium` | **95** |
| `low` | 100 |

**Special case — nothing to check.** `analyzed === 0` returns **100**. A store with no blog
articles cannot fail a blog check. This is distinct from `unavailable`.

### 7.2 Level 2 — Pillar score

```js
pillarScore = round( mean of sub-pillar scores where status === 'ok' )
```

Returns `null` when no sub-pillar in that pillar was measurable, so the caller persists
"unavailable" rather than a fabricated zero.

### 7.3 Level 3 — Overall score

```js
overallScore = round( mean of pillar scores that are not null )
```

A plain, unweighted mean. There is no hidden weighting between pillars.

### 7.4 The `unavailable` rule — the most important design decision

Sub-pillars whose status is `unavailable` are **excluded from every average**, never counted as 0.

> *"Counting them as 0 would invent a bad score out of missing data; excluding them keeps
> 'not measured' honestly separate from 'measured and failing'."*
> — `scoring.ts`

Checks that are currently and honestly unavailable: `speed.cwv`, `cro.cod`, `cro.mobile-ux`, and
`seo.handles-redirects` (until the navigation scope is granted). None of these drag the score down.

When persisting, `audits.overall_score` is NOT NULL, so an entirely unmeasurable audit stores `0`
but also records `metadata.overallAvailable = false` — consumers render "unavailable", not a fake zero.

---

## 8. Worked example — a real audit

From a live run against `checkout-studio-tlx-dev.myshopify.com`:

| Pillar | Score | Items healthy | Band |
|---|---|---|---|
| SEO | 47 | 42 / 82 | Critical |
| Content | 6 | 2 / 41 | Critical |
| Speed | 87 | 98 / 105 | Good |
| CRO | 50 | 16 / 21 | Needs Work |
| AI Discovery | 0 | 0 / 32 | Critical |

```
Overall = (47 + 6 + 87 + 50 + 0) / 5
        = 190 / 5
        = 38
```

Which is exactly the **38 / 100** shown on the dashboard.

### Why SEO scores 47 when 42/82 items are healthy (51%)

Because a pillar score is the **mean of its sub-pillar scores**, not a global ratio of all items.
Each of the 8 SEO sub-pillars is scored and capped independently, then averaged. A critical finding
inside one sub-pillar caps that sub-pillar at 60 regardless of its raw percentage, pulling the mean
below the flat item ratio.

### Why AI Discovery scores 0

`0 / 32` items healthy across three checks. Typically this means `/agents.md` and `/llms.txt` are
absent, and variants are missing GTIN / barcode identifiers required for agentic commerce.

---

## 9. What gets stored

One database transaction writes everything, so an audit is either fully recorded or not at all.

| Table | Rows written |
|---|---|
| `audits` | One row: overall score, source, and rich `metadata` (coverage, resource counts, snapshot warnings, failed checks, checks registered) |
| `audit_scores` | One row per **pillar**, plus one row per **sub-pillar** — each with score, `analyzedCount`, `healthyCount` and full evidence detail |
| `findings` | One row per finding: title, severity, affected count, impact, `scoreLift`, problem, why, recommendation, evidence and evidence rows |

`scoreLift` on a finding is the estimated point gain from fixing it — computed as
`round(affected / analyzed × 100)` — which is what powers the Fix Center's prioritisation.

Historical audits are **kept, never overwritten**, which is what makes the score-over-time trend possible.

---

## 10. Score bands

Applied in the UI (`frontend/src/data/pillarMeta.ts`) to turn a raw 0–100 into a status:

| Range | Status |
|---|---|
| 90 – 100 | **Excellent** |
| 75 – 89 | **Good** |
| 50 – 74 | **Needs Work** |
| 0 – 49 | **Critical** |

The target line rendered on every pillar bar is **90 · Excellent**.

---

## 11. Guarantees and known limits

### Guarantees

- **No invented data.** A check that cannot measure something returns `unavailable` with a plain
  reason, and is excluded from averages.
- **No silent partial scans.** Coverage detail records analysed-vs-available, and flags when
  Shopify reported an inexact total.
- **No fabricated zeros.** An unimplemented sub-pillar is simply absent; the UI distinguishes
  "not audited yet" from "cannot be measured".
- **No secrets in logs.** Runner log lines carry ids and counts only.

### Current limits

| Limit | Reason |
|---|---|
| Core Web Vitals not measured | No lab tooling / rendering browser |
| Cash-on-delivery not measured | Checkout payment config is not readable via the Admin API |
| Mobile UX not measured | Requires a rendering browser |
| Handles & redirects partial | Needs the `read_online_store_navigation` scope |
| Crawl capped at 40 pages | Politeness limit toward a live storefront serving real customers |
| Theme images excluded from alt-text check | Catalogue media only until the crawl covers theme assets |

---

## 12. Key source files

| File | Responsibility |
|---|---|
| `backend/src/audit-engine/scoring.ts` | The only place scores are produced |
| `backend/src/audit-engine/runner.ts` | Job lifecycle, check execution, failure isolation, persistence |
| `backend/src/audit-engine/index.ts` | Flat registry of all 30 checks |
| `backend/src/audit-engine/types.ts` | The `AuditCheck` contract and result shapes |
| `backend/src/audit-engine/store-data/shopify.provider.ts` | Admin API snapshot |
| `backend/src/audit-engine/storefront/crawler.ts` | Live storefront crawl |
| `backend/src/audit-engine/storefront/targets.ts` | Crawl budget and page mix |
| `backend/src/audit-engine/checks/**` | The 30 individual checks |
| `backend/src/tests/scoring.test.ts` | Unit tests for the scoring functions |
