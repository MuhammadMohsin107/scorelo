import { z } from 'zod';
import { CATALOG_SHAPES, INDUSTRY_OPTIONS } from '../services/onboarding-signals.js';

/**
 * ─── Guided setup request shapes ─────────────────────────────────────
 *
 * Every answer is optional at the schema level, because every step is skippable and a merchant
 * may save a half-filled step and come back. What is NOT optional is that a value, once sent, is
 * one Scorelo can act on — so the closed vocabularies below are enumerated rather than accepted
 * as free strings. `.strict()` throughout: an unknown key is a bug in the client, and silently
 * dropping it would let a mislabelled field look like it saved.
 *
 * Empty strings are normalised to null by the service, not here, so the distinction between
 * "cleared the field" and "never touched it" survives validation.
 */

export const BUSINESS_MODELS = [
  'Direct to consumer',
  'B2B or wholesale',
  'Subscription',
  'Made to order',
  'Print on demand',
  'Marketplace or multi-vendor',
] as const;

export const PRIMARY_GOALS = [
  'Grow organic traffic',
  'Rank for specific keywords',
  'Fix technical SEO issues',
  'Improve conversion rate',
  'Get found by AI assistants',
] as const;

/** Must match the pillar route slugs — these order the dashboard and rank findings. */
export const PILLAR_KEYS = ['seo', 'speed', 'content', 'cro', 'ai-discovery'] as const;

/**
 * The write gate. Stored as a slug rather than a label because it is read by code, not only
 * displayed: 'ask' is the default everywhere a value is missing.
 */
export const AUTOMATION_CONSENTS = ['none', 'ask', 'low_risk'] as const;

export const ALERT_FREQUENCIES = [
  'Every audit',
  'Weekly summary',
  'Only critical issues',
  'No email alerts',
] as const;

/** Trimmed, length-capped free text that treats "" as an explicit clear. */
const optionalText = (max: number) => z.string().trim().max(max).nullish();

/** A short list of trimmed, non-empty strings. Deduplication happens in the service, where the
 * comparison can be case-insensitive without changing what the merchant typed. */
const stringList = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

export const saveOnboardingStepSchema = z
  .object({
    /** Which step produced this payload. Drives which fields are allowed to advance progress. */
    step: z.number().int().min(1).max(5),

    // Step 1
    organizationName: optionalText(255),
    brandName: optionalText(255),
    /**
     * Accepted as loose text and normalised in the service, NOT validated as a URL here.
     *
     * `z.string().url()` rejects both of the two things a merchant most often does in this field:
     * clearing it (""), and typing a bare host ("example.com"). Both are reasonable inputs, and
     * answering either with a 400 from a schema would make the field feel broken. The service
     * adds a scheme when one is missing and rejects what is genuinely unparseable, with wording
     * that says what to type.
     */
    primaryDomain: optionalText(512),

    // Step 2
    industry: z.enum(INDUSTRY_OPTIONS as [string, ...string[]]).nullish(),
    sellsDescription: optionalText(500),
    businessModel: z.enum(BUSINESS_MODELS).nullish(),
    catalogShape: z.enum(CATALOG_SHAPES).nullish(),

    // Step 3
    targetCountries: stringList(50, 120).optional(),
    targetLanguages: stringList(50, 35).optional(),
    primaryMarket: optionalText(120),

    // Step 4
    targetKeywords: stringList(10, 60).optional(),
    brandedTerms: stringList(10, 80).optional(),
    competitorDomains: stringList(3, 253).optional(),

    // Step 5
    primaryGoal: z.enum(PRIMARY_GOALS).nullish(),
    priorityPillars: z.array(z.enum(PILLAR_KEYS)).max(PILLAR_KEYS.length).optional(),
    automationConsent: z.enum(AUTOMATION_CONSENTS).nullish(),
    alertFrequency: z.enum(ALERT_FREQUENCIES).nullish(),
  })
  .strict();

export type SaveOnboardingStepInput = z.infer<typeof saveOnboardingStepSchema>;

export const skipOnboardingStepSchema = z.object({ step: z.number().int().min(1).max(5) }).strict();
export type SkipOnboardingStepInput = z.infer<typeof skipOnboardingStepSchema>;
