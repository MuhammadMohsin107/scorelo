import { Loader2 } from 'lucide-react';
import { Field, SelectInput, TextInput } from '../settings/SettingsPrimitives';
import {
  CheckCard,
  ChoiceCard,
  DetectedNote,
  InfoNote,
  PriorityList,
  SuggestionRow,
  TagInput,
  UnavailableNote,
} from './OnboardingPrimitives';
import {
  AUTOMATION_CONSENT_OPTIONS,
  countryNames,
  type AutomationConsent,
  type OnboardingSnapshot,
  type OnboardingSuggestions,
  type StepPayload,
} from '../../data/onboarding.repository';

/**
 * ─── The five steps ──────────────────────────────────────────────────
 *
 * Each step edits a slice of one draft object held by the page. They never fetch and never save —
 * that belongs to the page, so a merchant moving between steps cannot lose an answer to a
 * component unmounting.
 *
 * No field is ever filled in for the merchant. Where the store has something to say about a field,
 * a `DetectedNote` under it names the source and offers the value as a one-click answer. Where
 * something could not be read, an `UnavailableNote` says so.
 */

export interface StepProps {
  draft: StepPayload;
  patch: (changes: Partial<StepPayload>) => void;
  snapshot: OnboardingSnapshot;
  suggestions: OnboardingSuggestions | null;
  suggestionsLoading: boolean;
}

/** Human labels for the pillar slugs the API works in. */
export const PILLAR_LABELS: Record<string, string> = {
  seo: 'SEO',
  speed: 'Speed',
  content: 'Content',
  cro: 'Conversion (CRO)',
  'ai-discovery': 'AI Discovery',
};

function Textarea({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
}) {
  return (
    <div>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-surface-900 outline-none transition-colors placeholder:text-surface-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      <p className="mt-1 text-right font-mono text-[11px] text-surface-400">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}

/** Hostname of a URL, or null if it will not parse. Guarded because this runs during render, and
 * an unexpected value from the API must not take the step down with it. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function SuggestionsPending() {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] text-surface-500">
      <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Reading your catalogue…
    </p>
  );
}

// ─── Step 1 · Your business ──────────────────────────────────────────

export function StepBusiness({ draft, patch, snapshot }: StepProps) {
  const shop = snapshot.detection.shop;

  return (
    <div className="space-y-3.5">
      {!snapshot.detection.available && snapshot.detection.unavailableReason && (
        <UnavailableNote>
          {snapshot.detection.unavailableReason} No suggestions could be read from your store — you can still type
          your answers, and they will be saved.
        </UnavailableNote>
      )}

      <Field
        label="Organisation name"
        htmlFor="onboarding-organization"
        hint="The business name used across your reports."
      >
        <TextInput
          id="onboarding-organization"
          value={draft.organizationName ?? ''}
          onChange={(value) => patch({ organizationName: value })}
          placeholder="Your business name"
        />
        {shop?.name && (
          <DetectedNote
            action={{
              label: 'Use this',
              applied: draft.organizationName === shop.name,
              onApply: () => patch({ organizationName: shop.name }),
            }}
          >
            Your Shopify store name is “{shop.name}”.
          </DetectedNote>
        )}
      </Field>

      <Field
        label="Brand name for page titles"
        htmlFor="onboarding-brand"
        hint="Appended to product and collection titles, so keep it short — “Northline”, not “Northline Outdoor Supply Co.”"
      >
        <TextInput
          id="onboarding-brand"
          value={draft.brandName ?? ''}
          onChange={(value) => patch({ brandName: value })}
          placeholder="Brand name"
        />
        {shop?.name && (
          <DetectedNote
            action={{
              label: 'Use this',
              applied: draft.brandName === shop.name,
              onApply: () => patch({ brandName: shop.name }),
            }}
          >
            Your Shopify store name is “{shop.name}”. Shorten it if it is long.
          </DetectedNote>
        )}
      </Field>

      <Field
        label="Primary storefront domain"
        htmlFor="onboarding-domain"
        hint="The address Scorelo crawls and treats as canonical."
      >
        <TextInput
          id="onboarding-domain"
          value={draft.primaryDomain ?? ''}
          onChange={(value) => patch({ primaryDomain: value })}
          placeholder="https://example.com"
        />
        {shop?.primaryUrl ? (
          <DetectedNote
            action={{
              label: 'Use this',
              applied: draft.primaryDomain === shop.primaryUrl,
              onApply: () => patch({ primaryDomain: shop.primaryUrl }),
            }}
          >
            Your Shopify primary domain is {shop.primaryUrl}
            {shop.myshopifyDomain && shop.myshopifyDomain !== hostOf(shop.primaryUrl)
              ? ` (store address: ${shop.myshopifyDomain})`
              : ''}
            . Change it only if you publish canonical content elsewhere.
          </DetectedNote>
        ) : (
          shop && <DetectedNote>Shopify did not return a primary domain for this store.</DetectedNote>
        )}
      </Field>

      {shop && (
        <InfoNote>
          Scorelo already knows your currency ({shop.currencyCode ?? 'not reported'}), timezone (
          {shop.ianaTimezone ?? 'not reported'}) and country ({shop.country ?? 'not reported'}) from Shopify, so
          you are not asked for them.
        </InfoNote>
      )}
    </div>
  );
}

// ─── Step 2 · What you sell ──────────────────────────────────────────

export function StepProducts({ draft, patch, snapshot, suggestions, suggestionsLoading }: StepProps) {
  const derivedIndustry = suggestions?.industry ?? null;
  const derivedShape = suggestions?.catalogShape ?? null;

  return (
    <div className="space-y-3.5">
      <Field
        label="Industry"
        htmlFor="onboarding-industry"
        hint="Decides which checks apply — a B2B parts store is not judged on consumer retail signals."
      >
        <SelectInput
          id="onboarding-industry"
          value={draft.industry ?? ''}
          options={['', ...snapshot.options.industries] as string[]}
          onChange={(value) => patch({ industry: value || null })}
        />
        {suggestionsLoading && <div className="mt-1"><SuggestionsPending /></div>}
        {derivedIndustry && (
          <DetectedNote
            action={{
              label: `Use “${derivedIndustry.value}”`,
              applied: draft.industry === derivedIndustry.value,
              onApply: () => patch({ industry: derivedIndustry.value }),
            }}
          >
            {derivedIndustry.basis}
            {derivedIndustry.confidence === 'low' && ' This is a weak match — please check it.'}
          </DetectedNote>
        )}
        {!suggestionsLoading && suggestions?.available && !derivedIndustry && (
          <DetectedNote>
            We could not tell your industry from your collections and product types — please choose one.
          </DetectedNote>
        )}
      </Field>

      <Field
        label="What you sell, in one line"
        htmlFor="onboarding-sells"
        hint="Written for a person, not a search engine. This is the single most useful input for generated copy."
      >
        <Textarea
          id="onboarding-sells"
          value={draft.sellsDescription ?? ''}
          onChange={(value) => patch({ sellsDescription: value })}
          placeholder="Hand-thrown stoneware tableware for cafés and restaurants."
          maxLength={500}
        />
      </Field>

      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">How you sell</p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">Changes which conversion and structured-data checks run.</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {snapshot.options.businessModels.map((model) => (
            <ChoiceCard
              key={model}
              name="business-model"
              value={model}
              label={model}
              selected={draft.businessModel === model}
              onSelect={(value) => patch({ businessModel: value })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">Catalogue shape</p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">Sets how Scorelo plans a crawl of your store.</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {snapshot.options.catalogShapes.map((shape) => (
            <ChoiceCard
              key={shape}
              name="catalog-shape"
              value={shape}
              label={shape}
              description={
                shape === 'Focused catalogue'
                  ? 'Every product page audited individually.'
                  : 'Audited by template, with products sampled across them.'
              }
              selected={draft.catalogShape === shape}
              onSelect={(value) => patch({ catalogShape: value })}
            />
          ))}
        </div>
        {suggestionsLoading && <div className="mt-1"><SuggestionsPending /></div>}
        {derivedShape && (
          <DetectedNote
            action={{
              label: `Use “${derivedShape.value}”`,
              applied: draft.catalogShape === derivedShape.value,
              onApply: () => patch({ catalogShape: derivedShape.value }),
            }}
          >
            {derivedShape.basis}
          </DetectedNote>
        )}
      </div>

      {!suggestionsLoading && suggestions && !suggestions.available && suggestions.unavailableReason && (
        <UnavailableNote>{suggestions.unavailableReason} Choose your answers manually below.</UnavailableNote>
      )}
    </div>
  );
}

// ─── Step 3 · Markets ────────────────────────────────────────────────

export function StepMarkets({ draft, patch, suggestions, suggestionsLoading }: StepProps) {
  const countries = draft.targetCountries ?? [];
  const languages = draft.targetLanguages ?? [];
  const available = countryNames();
  const selectable = available.filter((name) => !countries.includes(name));

  return (
    <div className="space-y-3.5">
      <Field
        label="Countries you sell to"
        htmlFor="onboarding-country-add"
        hint="Used to judge hreflang, canonical URLs and duplicate content across markets."
      >
        <div className="flex flex-wrap gap-1.5">
          {countries.map((country) => (
            <span
              key={country}
              className="inline-flex items-center gap-1 rounded bg-brand-50 py-0.5 pl-2 pr-1 text-[11.5px] font-medium text-brand-800"
            >
              {country}
              <button
                type="button"
                aria-label={`Remove ${country}`}
                onClick={() => {
                  const next = countries.filter((item) => item !== country);
                  patch({
                    targetCountries: next,
                    // The primary market must stay one of the selected countries.
                    primaryMarket: draft.primaryMarket === country ? (next[0] ?? null) : draft.primaryMarket,
                  });
                }}
                className="rounded p-0.5 text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-800"
              >
                ×
              </button>
            </span>
          ))}
          {countries.length === 0 && <p className="text-[11.5px] text-surface-500">No countries selected yet.</p>}
        </div>

        {available.length > 0 ? (
          <select
            id="onboarding-country-add"
            value=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              patch({
                targetCountries: [...countries, value],
                primaryMarket: draft.primaryMarket ?? value,
              });
            }}
            className="mt-2 w-full cursor-pointer rounded-md border border-surface-200 bg-surface-0 px-2.5 py-1.5 text-[12.5px] text-surface-900 outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Add a country…</option>
            {selectable.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-2">
            <UnavailableNote>
              Your browser could not provide a country list. You can continue and set markets later in Settings.
            </UnavailableNote>
          </div>
        )}

        {suggestions?.detectedCountry && (
          <DetectedNote
            action={{
              label: `Add ${suggestions.detectedCountry}`,
              applied: countries.includes(suggestions.detectedCountry),
              onApply: () => {
                const country = suggestions.detectedCountry as string;
                patch({ targetCountries: [...countries, country], primaryMarket: draft.primaryMarket ?? country });
              },
            }}
          >
            Your Shopify billing address is in {suggestions.detectedCountry}.
          </DetectedNote>
        )}
      </Field>

      {countries.length > 1 && (
        <Field
          label="Primary market"
          htmlFor="onboarding-primary-market"
          hint="Which country wins when market signals conflict."
        >
          <SelectInput
            id="onboarding-primary-market"
            value={draft.primaryMarket ?? countries[0]}
            options={countries}
            onChange={(value) => patch({ primaryMarket: value })}
          />
        </Field>
      )}

      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">Languages your storefront publishes</p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">
          Read from the locales enabled on your Shopify store. Tick the ones you want audited.
        </p>

        {suggestionsLoading && <div className="mt-1.5"><SuggestionsPending /></div>}

        {!suggestionsLoading && suggestions?.languages && suggestions.languages.length > 0 && (
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {suggestions.languages.map((locale) => (
              <CheckCard
                key={locale.locale}
                id={`onboarding-locale-${locale.locale}`}
                checked={languages.includes(locale.locale)}
                label={locale.name ? `${locale.name} (${locale.locale})` : locale.locale}
                description={[locale.primary ? 'Primary' : null, locale.published ? 'Published' : 'Not published']
                  .filter(Boolean)
                  .join(' · ')}
                onToggle={(next) =>
                  patch({
                    targetLanguages: next
                      ? [...languages, locale.locale]
                      : languages.filter((item) => item !== locale.locale),
                  })
                }
              />
            ))}
          </div>
        )}

        {!suggestionsLoading && suggestions && suggestions.languages === null && (
          <div className="mt-1.5">
            <UnavailableNote>
              Scorelo could not read the languages enabled on your store. International checks will be judged against
              your primary market only until this is available.
            </UnavailableNote>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 4 · Keywords ───────────────────────────────────────────────

export function StepKeywords({ draft, patch, suggestions, suggestionsLoading }: StepProps) {
  const keywords = draft.targetKeywords ?? [];
  const branded = draft.brandedTerms ?? [];
  const competitors = draft.competitorDomains ?? [];

  const keywordSuggestions = (suggestions?.keywords ?? []).map((suggestion) => ({
    value: suggestion.value,
    hint: suggestion.source,
  }));
  const brandSuggestions = (suggestions?.brandedTerms ?? []).map((value) => ({
    value,
    hint: 'From your Shopify store name',
  }));

  return (
    <div className="space-y-3.5">
      <Field
        label="Target keywords"
        htmlFor="onboarding-keywords"
        hint="The non-branded terms your audit measures you against. Start with the ones below and edit freely."
      >
        <TagInput
          id="onboarding-keywords"
          values={keywords}
          onChange={(next) => patch({ targetKeywords: next })}
          placeholder="e.g. merino base layers"
          max={10}
          transform={(raw) => {
            const value = raw.trim().replace(/\s+/g, ' ').toLowerCase();
            return value.length >= 3 ? value : null;
          }}
        />
      </Field>

      {suggestionsLoading && <SuggestionsPending />}

      {!suggestionsLoading && keywordSuggestions.length > 0 && (
        <SuggestionRow
          label="From your collections and product types"
          suggestions={keywordSuggestions}
          selected={keywords}
          onAdd={(value) => keywords.length < 10 && patch({ targetKeywords: [...keywords, value] })}
        />
      )}

      {!suggestionsLoading && suggestions?.available && keywordSuggestions.length === 0 && (
        <InfoNote>
          Your store has no collections or product types we could turn into keyword suggestions yet, so this list
          starts empty. Add the terms you want to rank for — you can refine them any time.
        </InfoNote>
      )}

      {!suggestionsLoading && suggestions && !suggestions.available && suggestions.unavailableReason && (
        <UnavailableNote>{suggestions.unavailableReason} Add your keywords manually.</UnavailableNote>
      )}

      <Field
        label="Branded terms"
        htmlFor="onboarding-branded"
        hint="Kept separate so branded search never flatters your non-branded performance."
      >
        <TagInput
          id="onboarding-branded"
          values={branded}
          onChange={(next) => patch({ brandedTerms: next })}
          placeholder="Your brand name and its variants"
          max={10}
        />
      </Field>

      {!suggestionsLoading && brandSuggestions.length > 0 && (
        <SuggestionRow
          label="Derived from your store name"
          suggestions={brandSuggestions}
          selected={branded}
          onAdd={(value) => branded.length < 10 && patch({ brandedTerms: [...branded, value] })}
        />
      )}

      <Field
        label="Competitors"
        htmlFor="onboarding-competitors"
        hint="Optional. Up to three storefronts to compare against."
      >
        <TagInput
          id="onboarding-competitors"
          values={competitors}
          onChange={(next) => patch({ competitorDomains: next })}
          placeholder="competitor.com"
          max={3}
          transform={(raw) => {
            const host = raw
              .trim()
              .toLowerCase()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/.*$/, '');
            return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(host) ? host : null;
          }}
        />
      </Field>
    </div>
  );
}

// ─── Step 5 · Goals and permissions ──────────────────────────────────

export function StepGoals({ draft, patch, snapshot }: StepProps) {
  // An unsaved order arrives as an empty list; the product's own order is shown until they move one.
  const pillars = draft.priorityPillars?.length ? draft.priorityPillars : snapshot.options.pillars;
  const consent = (draft.automationConsent ?? null) as AutomationConsent | null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">What matters most right now</p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">Sets what your dashboard leads with.</p>
        <div className="mt-1.5 grid gap-1.5">
          {snapshot.options.primaryGoals.map((goal) => (
            <ChoiceCard
              key={goal}
              name="primary-goal"
              value={goal}
              label={goal}
              selected={draft.primaryGoal === goal}
              onSelect={(value) => patch({ primaryGoal: value })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">Priority order</p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">
          Findings are ranked in this order when their severity is equal.
        </p>
        <div className="mt-1.5">
          <PriorityList
            items={pillars.map((key) => ({ key, label: PILLAR_LABELS[key] ?? key }))}
            onReorder={(keys) => patch({ priorityPillars: keys })}
          />
        </div>
      </div>

      <div>
        <p className="text-[12.5px] font-semibold text-surface-800">
          May Scorelo change your store?
          <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-[0.12em] text-critical-600">
            Required
          </span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-surface-500">
          This governs every fix Scorelo offers. You can change it whenever you like.
        </p>
        <div className="mt-1.5 grid gap-1.5">
          {AUTOMATION_CONSENT_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              name="automation-consent"
              value={option.value}
              label={option.label}
              description={option.description}
              selected={consent === option.value}
              onSelect={(value) => patch({ automationConsent: value as AutomationConsent })}
            />
          ))}
        </div>
        {consent === null && (
          <div className="mt-1.5">
            <InfoNote>
              Until you choose, Scorelo asks before every change — an unanswered question is never treated as
              permission to write to your store.
            </InfoNote>
          </div>
        )}
      </div>

      <Field label="Audit alerts" htmlFor="onboarding-alerts" hint="Applied to your email notification settings when you finish.">
        <SelectInput
          id="onboarding-alerts"
          value={draft.alertFrequency ?? ''}
          options={['', ...snapshot.options.alertFrequencies] as string[]}
          onChange={(value) => patch({ alertFrequency: value || null })}
        />
      </Field>
    </div>
  );
}
