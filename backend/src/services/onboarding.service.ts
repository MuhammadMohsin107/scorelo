import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { onboardingState, stores, users } from '../db/schema.js';
import { ApiError } from '../middleware/error.js';
import { getCurrentStoreId } from './store.service.js';
import { hasStoreDataSource, resolveShopifyClient, StoreDataError } from '../audit-engine/store-data/index.js';
import {
  fetchCatalogSignals,
  fetchShopIdentity,
  fetchShopLocales,
  type ShopLocale,
} from '../audit-engine/store-data/shopify.queries.js';
import {
  CATALOG_SHAPES,
  INDUSTRY_OPTIONS,
  deriveBrandedTerms,
  deriveCatalogShape,
  deriveIndustry,
  deriveKeywords,
  type DerivedAnswer,
} from './onboarding-signals.js';
import {
  ALERT_FREQUENCIES,
  BUSINESS_MODELS,
  PILLAR_KEYS,
  PRIMARY_GOALS,
  type SaveOnboardingStepInput,
} from '../schemas/onboarding.schema.js';

/**
 * ─── Guided setup ────────────────────────────────────────────────────
 *
 * Five steps, every one skippable, all state server-side so a merchant resumes on any device.
 *
 * THE RULE THIS FILE IS BUILT AROUND: a pre-filled answer is either read from the merchant's real
 * Shopify store or it is absent. Nothing here substitutes a plausible value for a missing one.
 * When the Admin API cannot be reached, `detection.available` is false and the UI says the fields
 * could not be pre-filled — it does not quietly fall back to blanks that look like answers.
 *
 * Facts Shopify owns — store name, domain, currency, timezone, country, plan, catalogue size —
 * are read LIVE on every load rather than copied into our tables. A merchant who changes their
 * currency in Shopify sees the change here immediately, and there is no second copy to go stale.
 */

export const TOTAL_STEPS = 5;

export type StepStatus = 'complete' | 'skipped' | 'pending';

export interface StepProgress {
  step: number;
  status: StepStatus;
}

/** What Shopify told us about the store, read live. Null fields mean Shopify returned nothing for
 * them — never that we substituted a default. */
export interface ShopContext {
  name: string;
  contactEmail: string | null;
  myshopifyDomain: string | null;
  primaryUrl: string | null;
  currencyCode: string | null;
  ianaTimezone: string | null;
  country: string | null;
  planName: string | null;
}

export interface OnboardingAnswers {
  organizationName: string | null;
  brandName: string | null;
  primaryDomain: string | null;
  industry: string | null;
  sellsDescription: string | null;
  businessModel: string | null;
  catalogShape: string | null;
  targetCountries: string[];
  targetLanguages: string[];
  primaryMarket: string | null;
  targetKeywords: string[];
  brandedTerms: string[];
  competitorDomains: string[];
  primaryGoal: string | null;
  priorityPillars: string[];
  automationConsent: string | null;
  alertFrequency: string | null;
}

export interface OnboardingSnapshot {
  /** False when no live Shopify connection exists. Setup cannot run without one — every
   * pre-filled answer comes from the store — so the UI sends the merchant to connect first. */
  connected: boolean;
  currentStep: number;
  progress: StepProgress[];
  skippedSteps: number[];
  startedAt: string | null;
  deferredAt: string | null;
  completedAt: string | null;
  answers: OnboardingAnswers;
  detection: {
    available: boolean;
    /** Merchant-readable explanation when `available` is false. Never a raw Shopify message. */
    unavailableReason: string | null;
    shop: ShopContext | null;
  };
  /** The closed vocabularies the UI renders as options. Sent with the state so the client cannot
   * drift out of step with what the API will accept. */
  options: {
    industries: string[];
    businessModels: string[];
    catalogShapes: string[];
    primaryGoals: string[];
    pillars: string[];
    alertFrequencies: string[];
  };
}

export interface OnboardingSuggestions {
  available: boolean;
  unavailableReason: string | null;
  industry: DerivedAnswer<string> | null;
  catalogShape: DerivedAnswer<string> | null;
  /** Seeded from the merchant's own collections and product types. Empty for a store that has
   * neither — which the UI states plainly rather than filling in. */
  keywords: Array<{ value: string; source: string }>;
  brandedTerms: string[];
  /** Null when the shop would not disclose its locales. Distinct from an empty list. */
  languages: ShopLocale[] | null;
  /** The shop's own country, from its Shopify billing address. */
  detectedCountry: string | null;
  catalogue: {
    productTotal: { count: number; exact: boolean } | null;
    collectionCount: number;
    sampledProducts: number;
  };
}

// ─── Row helpers ─────────────────────────────────────────────────────

/** JSON columns come back as `unknown`. Accept only an array of strings; anything else is treated
 * as absent rather than coerced, so a malformed row cannot inject junk into an answer. */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item));
}

/** Reads the store's setup row, creating it on first access.
 *
 * Created lazily rather than at install: a row that exists only once a merchant has actually
 * opened setup makes "never started" answerable from the data, instead of being indistinguishable
 * from "started and answered nothing". */
async function loadOrCreateState(storeId: number) {
  const [existing] = await db.select().from(onboardingState).where(eq(onboardingState.storeId, storeId)).limit(1);
  if (existing) return existing;

  await db.insert(onboardingState).values({ storeId });
  const [created] = await db.select().from(onboardingState).where(eq(onboardingState.storeId, storeId)).limit(1);
  if (!created) throw new ApiError(500, 'Could not start guided setup', 'ONBOARDING_STATE_UNAVAILABLE');
  return created;
}

type StateRow = Awaited<ReturnType<typeof loadOrCreateState>>;

function toAnswers(row: StateRow): OnboardingAnswers {
  return {
    organizationName: row.organizationName,
    brandName: row.brandName,
    primaryDomain: row.primaryDomain,
    industry: row.industry,
    sellsDescription: row.sellsDescription,
    businessModel: row.businessModel,
    catalogShape: row.catalogShape,
    targetCountries: stringArray(row.targetCountries),
    targetLanguages: stringArray(row.targetLanguages),
    primaryMarket: row.primaryMarket,
    targetKeywords: stringArray(row.targetKeywords),
    brandedTerms: stringArray(row.brandedTerms),
    competitorDomains: stringArray(row.competitorDomains),
    primaryGoal: row.primaryGoal,
    priorityPillars: stringArray(row.priorityPillars),
    automationConsent: row.automationConsent,
    alertFrequency: row.alertFrequency,
  };
}

/**
 * Whether each step has been answered.
 *
 * A step counts as complete only when the answers that make it USEFUL are present — not merely
 * when it was visited. Step 4 with no keywords has taught the audit nothing, so calling it
 * complete would put a tick beside work that did not happen.
 *
 * `skipped` wins over `pending` but loses to `complete`: a merchant who skipped step 3 and later
 * filled it in has completed it, and the skip is history rather than current state.
 */
function computeProgress(row: StateRow): StepProgress[] {
  const answers = toAnswers(row);
  const skipped = new Set(numberArray(row.skippedSteps));

  const isComplete: Record<number, boolean> = {
    1: Boolean(answers.organizationName && answers.brandName),
    2: Boolean(answers.industry),
    3: answers.targetCountries.length > 0,
    4: answers.targetKeywords.length > 0,
    5: Boolean(answers.primaryGoal && answers.automationConsent),
  };

  return Array.from({ length: TOTAL_STEPS }, (_, index) => {
    const step = index + 1;
    const status: StepStatus = isComplete[step] ? 'complete' : skipped.has(step) ? 'skipped' : 'pending';
    return { step, status };
  });
}

/** Merchant-facing wording for a failed Shopify read. Raw API messages describe our request, not
 * anything the merchant can act on, so they are never surfaced. */
function describeDetectionFailure(error: unknown): string {
  if (error instanceof StoreDataError) {
    switch (error.code) {
      case 'NOT_CONNECTED':
        return 'No connected Shopify store.';
      case 'TOKEN_REVOKED':
        return 'Shopify authorization has expired. Reconnect your store to continue setup.';
      case 'MISSING_SCOPES':
        return 'Scorelo is missing a Shopify permission needed to read your store. Reconnect to grant it.';
      case 'RATE_LIMITED':
        return 'Shopify is rate-limiting us right now. Your answers are saved — try again in a few minutes.';
      default:
        return "We couldn't reach Shopify to read your store details.";
    }
  }
  if (error instanceof ApiError && error.code === 'SHOPIFY_REAUTH_REQUIRED') {
    return 'Shopify authorization has expired. Reconnect your store to continue setup.';
  }
  return "We couldn't reach Shopify to read your store details.";
}

// ─── Reads ───────────────────────────────────────────────────────────

/**
 * The state of guided setup for the caller's store, plus the live shop context the first step
 * pre-fills from.
 *
 * Never throws for a disconnected store: this is polled by the app shell to decide whether to
 * route a merchant into setup, and a 400 on every navigation would be both noisy and useless.
 */
export async function getOnboarding(userId: number, storeId?: number): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const connected = await hasStoreDataSource(resolvedStoreId);
  const row = await loadOrCreateState(resolvedStoreId);

  let shop: ShopContext | null = null;
  let unavailableReason: string | null = null;

  if (connected) {
    try {
      const client = await resolveShopifyClient(resolvedStoreId);
      const identity = await fetchShopIdentity(client);
      shop = {
        name: identity.name,
        contactEmail: identity.contactEmail,
        myshopifyDomain: identity.myshopifyDomain,
        primaryUrl: identity.primaryUrl,
        currencyCode: identity.currencyCode,
        ianaTimezone: identity.ianaTimezone,
        country: identity.country,
        planName: identity.planName,
      };
    } catch (error) {
      unavailableReason = describeDetectionFailure(error);
      console.warn(
        `[scorelo-api] onboarding: shop detection failed for store ${resolvedStoreId} — ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  } else {
    unavailableReason = 'Connect your Shopify store to start guided setup.';
  }

  return {
    connected,
    currentStep: row.currentStep,
    progress: computeProgress(row),
    skippedSteps: numberArray(row.skippedSteps),
    startedAt: row.startedAt?.toISOString() ?? null,
    deferredAt: row.deferredAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    answers: toAnswers(row),
    detection: { available: shop !== null, unavailableReason, shop },
    options: {
      industries: INDUSTRY_OPTIONS,
      businessModels: [...BUSINESS_MODELS],
      catalogShapes: [...CATALOG_SHAPES],
      primaryGoals: [...PRIMARY_GOALS],
      pillars: [...PILLAR_KEYS],
      alertFrequencies: [...ALERT_FREQUENCIES],
    },
  };
}

/**
 * Reads the merchant's catalogue and derives the answers steps 2, 3 and 4 pre-fill with.
 *
 * A separate endpoint from `getOnboarding` on purpose: this reads a page of products and every
 * collection, which is far heavier than the single shop query the app shell polls. It is fetched
 * once, when the merchant actually reaches the steps that use it.
 */
export async function getOnboardingSuggestions(userId: number, storeId?: number): Promise<OnboardingSuggestions> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);

  const empty: OnboardingSuggestions = {
    available: false,
    unavailableReason: null,
    industry: null,
    catalogShape: null,
    keywords: [],
    brandedTerms: [],
    languages: null,
    detectedCountry: null,
    catalogue: { productTotal: null, collectionCount: 0, sampledProducts: 0 },
  };

  if (!(await hasStoreDataSource(resolvedStoreId))) {
    return { ...empty, unavailableReason: 'Connect your Shopify store to see suggestions from your catalogue.' };
  }

  try {
    const client = await resolveShopifyClient(resolvedStoreId);
    // Identity first: brand terms are derived from the shop name, and the keyword seeds need them
    // in order to exclude the merchant's own brand from non-branded targets.
    const identity = await fetchShopIdentity(client);
    const brandedTerms = deriveBrandedTerms(identity.name, identity.myshopifyDomain);
    const signals = await fetchCatalogSignals(client);
    // Locales are read last and never fail the request — see fetchShopLocales.
    const languages = await fetchShopLocales(client);

    return {
      available: true,
      unavailableReason: null,
      industry: deriveIndustry(signals),
      catalogShape: deriveCatalogShape(signals),
      keywords: deriveKeywords(signals, brandedTerms),
      brandedTerms,
      languages,
      detectedCountry: identity.country,
      catalogue: {
        productTotal: signals.productTotal,
        collectionCount: signals.collections.length,
        sampledProducts: signals.sampledProducts,
      },
    };
  } catch (error) {
    console.warn(
      `[scorelo-api] onboarding: suggestions failed for store ${resolvedStoreId} — ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return { ...empty, unavailableReason: describeDetectionFailure(error) };
  }
}

// ─── Writes ──────────────────────────────────────────────────────────

/** "" means the merchant cleared the field; undefined means they did not touch it. Both are
 * preserved — collapsing them would make clearing a field impossible. */
function normaliseText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Case-insensitive dedupe that keeps the merchant's own capitalisation and ordering. */
function dedupe(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Normalises whatever the merchant typed into the storefront-domain field.
 *
 * A bare host ("example.com") and a full URL are both accepted — the first is what people
 * actually type — and a scheme is added when one is missing. `undefined` passes through untouched
 * and `""` clears the field; only genuinely unparseable input is rejected, with wording that says
 * what to do rather than quoting a validator.
 */
function normaliseDomain(value: string | null | undefined): string | null | undefined {
  const text = normaliseText(value);
  if (text === undefined || text === null) return text;

  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ApiError(400, 'Enter a valid storefront address, for example https://example.com', 'ONBOARDING_INVALID_DOMAIN');
  }
  // A hostname with no dot is not a public storefront — it is a typo or an intranet name, and
  // accepting it would send the crawler somewhere that can never be audited.
  if (!parsed.hostname.includes('.')) {
    throw new ApiError(400, 'Enter a valid storefront address, for example https://example.com', 'ONBOARDING_INVALID_DOMAIN');
  }
  // Stored origin-only: a path, query or fragment on the canonical domain would be carried into
  // every crawl URL built from it.
  return parsed.origin;
}

/** Strips a pasted URL down to a bare hostname so competitor entries compare cleanly. */
function toHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!trimmed) return null;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(trimmed) ? trimmed : null;
}

/**
 * Saves one step's answers.
 *
 * Only the fields belonging to `step` are written, even if the client sends more. That keeps a
 * replayed or malformed request from reaching across the form and overwriting an answer on a step
 * the merchant is not on.
 *
 * `current_step` only ever moves FORWARD, and only past a step that is now complete. Navigating
 * back to review step 2 must not reset a merchant's progress to step 2.
 */
export async function saveOnboardingStep(
  userId: number,
  input: SaveOnboardingStepInput,
  storeId?: number,
): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const row = await loadOrCreateState(resolvedStoreId);

  // A completed setup stays editable, and saving into one does NOT un-complete it — `completedAt`
  // is left exactly as it is below. A merchant must be able to change their mind about which
  // keywords they target and, above all, about whether Scorelo may write to their store; locking
  // those behind a one-time flow would make the write gate unrevisitable.
  const updates: Partial<typeof onboardingState.$inferInsert> = { updatedAt: new Date() };
  const set = <K extends keyof typeof updates>(key: K, value: (typeof updates)[K] | undefined) => {
    if (value !== undefined) updates[key] = value;
  };

  switch (input.step) {
    case 1:
      set('organizationName', normaliseText(input.organizationName));
      set('brandName', normaliseText(input.brandName));
      set('primaryDomain', normaliseDomain(input.primaryDomain));
      break;
    case 2:
      set('industry', normaliseText(input.industry));
      set('sellsDescription', normaliseText(input.sellsDescription));
      set('businessModel', normaliseText(input.businessModel));
      set('catalogShape', normaliseText(input.catalogShape));
      break;
    case 3:
      set('targetCountries', dedupe(input.targetCountries));
      set('targetLanguages', dedupe(input.targetLanguages));
      set('primaryMarket', normaliseText(input.primaryMarket));
      break;
    case 4:
      set('targetKeywords', dedupe(input.targetKeywords?.map((keyword) => keyword.toLowerCase())));
      set('brandedTerms', dedupe(input.brandedTerms));
      set(
        'competitorDomains',
        input.competitorDomains === undefined
          ? undefined
          : dedupe(input.competitorDomains.map(toHostname).filter((host): host is string => host !== null)),
      );
      break;
    case 5:
      set('primaryGoal', normaliseText(input.primaryGoal));
      set('priorityPillars', input.priorityPillars ? [...new Set(input.priorityPillars)] : undefined);
      set('automationConsent', normaliseText(input.automationConsent));
      set('alertFrequency', normaliseText(input.alertFrequency));
      break;
  }

  await db.update(onboardingState).set(updates).where(eq(onboardingState.id, row.id));

  // Re-read so progress is computed from what was actually stored, not from what we intended to
  // store. Advancement then follows real completion.
  const [saved] = await db.select().from(onboardingState).where(eq(onboardingState.id, row.id)).limit(1);
  if (!saved) throw new ApiError(500, 'Could not save your answers', 'ONBOARDING_STATE_UNAVAILABLE');

  const progress = computeProgress(saved);
  const justCompleted = progress.find((entry) => entry.step === input.step)?.status === 'complete';
  const nextStep = Math.min(TOTAL_STEPS, input.step + 1);
  if (justCompleted && nextStep > saved.currentStep) {
    await db.update(onboardingState).set({ currentStep: nextStep }).where(eq(onboardingState.id, row.id));
  }

  return getOnboarding(userId, storeId);
}

/** Records an explicit skip and moves on. The step's answers are left untouched — a merchant who
 * skips after typing half an answer keeps what they typed. */
export async function skipOnboardingStep(userId: number, step: number, storeId?: number): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const row = await loadOrCreateState(resolvedStoreId);

  const skipped = new Set(numberArray(row.skippedSteps));
  skipped.add(step);

  await db
    .update(onboardingState)
    .set({
      skippedSteps: [...skipped].sort((a, b) => a - b),
      currentStep: Math.max(row.currentStep, Math.min(TOTAL_STEPS, step + 1)),
      updatedAt: new Date(),
    })
    .where(eq(onboardingState.id, row.id));

  return getOnboarding(userId, storeId);
}

/**
 * "Finish later". Stops the app routing the merchant back into setup on every navigation; the
 * dashboard shows a resume card instead.
 */
export async function deferOnboarding(userId: number, storeId?: number): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const row = await loadOrCreateState(resolvedStoreId);
  await db
    .update(onboardingState)
    .set({ deferredAt: new Date(), updatedAt: new Date() })
    .where(eq(onboardingState.id, row.id));
  return getOnboarding(userId, storeId);
}

/** Re-entering setup, from the resume card or from Settings. Clears both the deferral and, for a
 * finished setup, the completion — so editing answers is possible without a second flow. */
export async function reopenOnboarding(userId: number, storeId?: number): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const row = await loadOrCreateState(resolvedStoreId);
  await db
    .update(onboardingState)
    .set({ deferredAt: null, completedAt: null, updatedAt: new Date() })
    .where(eq(onboardingState.id, row.id));
  return getOnboarding(userId, storeId);
}

/**
 * Maps the merchant's alert choice onto the notification toggles that actually drive email.
 *
 * Only the four audit-related toggles are touched. `notifyIntegrationAlerts` and
 * `notifyProductUpdates` are about the connection and about Scorelo itself — neither is an audit
 * alert, and silently switching them from this question would be answering something the merchant
 * was not asked.
 */
function notificationPreferences(alertFrequency: string | null) {
  switch (alertFrequency) {
    case 'Every audit':
      return { notifyAnalysisComplete: true, notifyCriticalIssues: true, notifyScoreChanges: true, notifyWeeklySummary: false };
    case 'Weekly summary':
      return { notifyAnalysisComplete: false, notifyCriticalIssues: true, notifyScoreChanges: false, notifyWeeklySummary: true };
    case 'Only critical issues':
      return { notifyAnalysisComplete: false, notifyCriticalIssues: true, notifyScoreChanges: false, notifyWeeklySummary: false };
    case 'No email alerts':
      return { notifyAnalysisComplete: false, notifyCriticalIssues: false, notifyScoreChanges: false, notifyWeeklySummary: false };
    default:
      // Not answered. The account keeps whatever it already had — an unanswered question must not
      // silently change a merchant's email settings.
      return null;
  }
}

/**
 * Finishes setup and applies the answers to the rest of the product.
 *
 * Two distinct kinds of value are written, from two distinct sources:
 *   • what the MERCHANT told us (organisation name, industry, canonical domain) — applied only
 *     when they actually answered;
 *   • what SHOPIFY told us (country, timezone, currency) — read live here and applied because the
 *     store record currently holds hand-entered values that Shopify can answer authoritatively.
 *
 * A failed Shopify read does not fail completion. The merchant's answers are theirs and are saved
 * either way; the store record simply keeps the values it already had.
 */
export async function completeOnboarding(userId: number, storeId?: number): Promise<OnboardingSnapshot> {
  const resolvedStoreId = await getCurrentStoreId(userId, storeId);
  const row = await loadOrCreateState(resolvedStoreId);
  const answers = toAnswers(row);

  const storeUpdates: Partial<typeof stores.$inferInsert> = {};
  if (answers.organizationName) storeUpdates.name = answers.organizationName;
  if (answers.primaryDomain) storeUpdates.url = answers.primaryDomain;
  if (answers.industry) storeUpdates.industry = answers.industry;

  if (await hasStoreDataSource(resolvedStoreId)) {
    // The platform is known for certain at this point — a live connection is a Shopify store.
    storeUpdates.platform = 'Shopify';
    try {
      const identity = await fetchShopIdentity(await resolveShopifyClient(resolvedStoreId));
      if (identity.country) storeUpdates.country = identity.country;
      if (identity.ianaTimezone) storeUpdates.timezone = identity.ianaTimezone;
      if (identity.currencyCode) storeUpdates.currency = identity.currencyCode;
      // Only when the merchant did not name a canonical domain themselves — their answer wins
      // over Shopify's primary, because a store can publish canonical content elsewhere.
      if (!answers.primaryDomain && identity.primaryUrl) storeUpdates.url = identity.primaryUrl;
      if (!answers.organizationName && identity.name) storeUpdates.name = identity.name;
    } catch (error) {
      console.warn(
        `[scorelo-api] onboarding: could not refresh store facts from Shopify for store ${resolvedStoreId} — ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  if (Object.keys(storeUpdates).length > 0) {
    await db.update(stores).set(storeUpdates).where(eq(stores.id, resolvedStoreId));
  }

  const preferences = notificationPreferences(answers.alertFrequency);
  if (preferences) {
    await db.update(users).set(preferences).where(eq(users.id, userId));
  }

  await db
    .update(onboardingState)
    .set({ completedAt: new Date(), deferredAt: null, currentStep: TOTAL_STEPS, updatedAt: new Date() })
    .where(eq(onboardingState.id, row.id));

  console.log(`[scorelo-api] onboarding: guided setup completed for store ${resolvedStoreId} (user ${userId})`);
  return getOnboarding(userId, storeId);
}
