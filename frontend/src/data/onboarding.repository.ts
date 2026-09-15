import { api, ApiError } from '../lib/api';

/**
 * ─── Guided setup ────────────────────────────────────────────────────
 *
 * Five steps a merchant completes after connecting their Shopify store. Every pre-filled value in
 * this flow is read from THEIR store — the shop name, domain, currency and country from the shop
 * record, the industry and keyword seeds derived from their own collections and product types.
 *
 * Where the backend could not read something it says so explicitly (`detection.available: false`,
 * `suggestions.available: false`, `languages: null`). The UI must render those states as unknown.
 * It must never substitute an example value: a merchant who accepts a pre-filled answer they did
 * not check has handed Scorelo a wrong input for every title tag it later writes.
 */

export type StepStatus = 'complete' | 'skipped' | 'pending';
export type SignalConfidence = 'high' | 'medium' | 'low';

export const TOTAL_STEPS = 5;

export interface StepProgress {
  step: number;
  status: StepStatus;
}

/** Read live from the Shopify Admin API on every load. A null field means Shopify returned
 * nothing for it — not that a default was applied. */
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
  automationConsent: AutomationConsent | null;
  alertFrequency: string | null;
}

/** 'ask' is the behaviour for null too — an unanswered question is never consent to write. */
export type AutomationConsent = 'none' | 'ask' | 'low_risk';

export interface OnboardingSnapshot {
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
    unavailableReason: string | null;
    shop: ShopContext | null;
  };
  /** Sent by the server so the client's options cannot drift from what the API accepts. */
  options: {
    industries: string[];
    businessModels: string[];
    catalogShapes: string[];
    primaryGoals: string[];
    pillars: string[];
    alertFrequencies: string[];
  };
}

export interface DerivedAnswer {
  value: string;
  confidence: SignalConfidence;
  /** Why the store produced this answer, shown under the field so it can be judged. */
  basis: string;
}

export interface ShopLocale {
  locale: string;
  name: string | null;
  primary: boolean;
  published: boolean;
}

export interface OnboardingSuggestions {
  available: boolean;
  unavailableReason: string | null;
  industry: DerivedAnswer | null;
  catalogShape: DerivedAnswer | null;
  keywords: Array<{ value: string; source: string }>;
  brandedTerms: string[];
  /** Null means the shop would not disclose its locales — different from an empty list. */
  languages: ShopLocale[] | null;
  detectedCountry: string | null;
  catalogue: {
    productTotal: { count: number; exact: boolean } | null;
    collectionCount: number;
    sampledProducts: number;
  };
}

/** Answers for one step. Omitted keys are left untouched; null clears a field. */
export interface StepPayload {
  step: number;
  organizationName?: string | null;
  brandName?: string | null;
  primaryDomain?: string | null;
  industry?: string | null;
  sellsDescription?: string | null;
  businessModel?: string | null;
  catalogShape?: string | null;
  targetCountries?: string[];
  targetLanguages?: string[];
  primaryMarket?: string | null;
  targetKeywords?: string[];
  brandedTerms?: string[];
  competitorDomains?: string[];
  primaryGoal?: string | null;
  priorityPillars?: string[];
  automationConsent?: AutomationConsent | null;
  alertFrequency?: string | null;
}

export function fetchOnboarding(): Promise<OnboardingSnapshot> {
  return api.get<OnboardingSnapshot>('/onboarding');
}

export function fetchOnboardingSuggestions(): Promise<OnboardingSuggestions> {
  return api.get<OnboardingSuggestions>('/onboarding/suggestions');
}

export function saveOnboardingStep(payload: StepPayload): Promise<OnboardingSnapshot> {
  return api.put<OnboardingSnapshot>('/onboarding/step', payload);
}

export function skipOnboardingStep(step: number): Promise<OnboardingSnapshot> {
  return api.post<OnboardingSnapshot>('/onboarding/skip', { step });
}

export function deferOnboarding(): Promise<OnboardingSnapshot> {
  return api.post<OnboardingSnapshot>('/onboarding/defer');
}

export function reopenOnboarding(): Promise<OnboardingSnapshot> {
  return api.post<OnboardingSnapshot>('/onboarding/reopen');
}

export function completeOnboarding(): Promise<OnboardingSnapshot> {
  return api.post<OnboardingSnapshot>('/onboarding/complete');
}

// ─── Step metadata ───────────────────────────────────────────────────
// Titles and the one-line purpose shown in the stepper and page header. Copy, not data.

export const STEP_META: Array<{ step: number; title: string; purpose: string }> = [
  { step: 1, title: 'Your business', purpose: 'Confirm the name Scorelo writes into your page titles.' },
  { step: 2, title: 'What you sell', purpose: 'Sets which checks apply to your store.' },
  { step: 3, title: 'Markets', purpose: 'Where your customers are, so international checks are judged correctly.' },
  { step: 4, title: 'Keywords', purpose: 'The terms your audit measures you against.' },
  { step: 5, title: 'Goals & permissions', purpose: 'What to prioritise, and whether Scorelo may change anything.' },
];

export const AUTOMATION_CONSENT_OPTIONS: Array<{ value: AutomationConsent; label: string; description: string }> = [
  {
    value: 'none',
    label: 'Never change my store',
    description: 'Scorelo reports issues and shows you exactly how to fix them. It writes nothing.',
  },
  {
    value: 'ask',
    label: 'Ask me before every change',
    description: 'You review and approve each fix before it is applied. This is the default.',
  },
  {
    value: 'low_risk',
    label: 'Apply low-risk fixes automatically',
    description: 'Missing alt text and empty meta descriptions are filled in for you. Titles, prices and content still need approval.',
  },
];

/**
 * Names the ISO 3166-1 alpha-2 codes through the browser's own locale data rather than shipping a
 * translated country table. `Intl.DisplayNames` is the platform's real reference data; the codes
 * below are the standard's own list.
 */
const ISO_3166_ALPHA2 =
  'AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GG GH GI GL GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW'.split(
    ' ',
  );

let countryCache: string[] | null = null;

/**
 * Every country name, sorted. Used for the step 3 picker.
 *
 * Names — not codes — because `stores.country` and Shopify's `billingAddress.country` both hold a
 * name, and the detected country has to match an option in this list for the pre-fill to select.
 */
export function countryNames(): string[] {
  if (countryCache) return countryCache;
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' });
    const names = ISO_3166_ALPHA2.map((code) => display.of(code)).filter((name): name is string => Boolean(name));
    countryCache = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  } catch {
    // Intl.DisplayNames is unavailable on some older engines. The merchant can still type a
    // country; an empty option list is honest, an invented one is not.
    countryCache = [];
  }
  return countryCache;
}

/** Turns an API failure into wording a merchant can act on. */
export function describeOnboardingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'STORE_NOT_FOUND') return 'We could not find your store.';
    if (error.code === 'ONBOARDING_INVALID_DOMAIN') return error.message;
    if (error.status === 400) return error.message;
  }
  return "We couldn't save that. Check your connection and try again.";
}
