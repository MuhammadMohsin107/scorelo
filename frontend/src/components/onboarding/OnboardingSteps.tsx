import { Loader2 } from 'lucide-react';
import {
  CheckCard,
  Chip,
  ChoiceCard,
  DetectedNote,
  FactTile,
  FormField,
  FormSection,
  InfoNote,
  PriorityList,
  QuietNote,
  SelectField,
  SuggestionRow,
  TagInput,
  TextArea,
  TextField,
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
 * LAID OUT IN TWO COLUMNS on wide screens: short fields that belong together share a row, so a step
 * fits in far less scrolling. Every grid collapses to one column on narrow screens.
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
    <QuietNote>
      <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Reading your catalogue…
    </QuietNote>
  );
}

// ─── Step 1 · Your business ──────────────────────────────────────────

export function StepBusiness({ draft, patch, snapshot }: StepProps) {
  const shop = snapshot.detection.shop;

  return (
    <div className="space-y-7">
      {!snapshot.detection.available && snapshot.detection.unavailableReason && (
        <UnavailableNote>
          {snapshot.detection.unavailableReason} No suggestions could be read from your store — you can still type
          your answers, and they will be saved.
        </UnavailableNote>
      )}

      <div className="grid items-start gap-x-6 gap-y-6 md:grid-cols-2">
        <FormField
          label="Organisation name"
          htmlFor="onboarding-organization"
          hint="The business name used across your reports."
        >
          <TextField
            id="onboarding-organization"
            value={draft.organizationName ?? ''}
            onChange={(value) => patch({ organizationName: value })}
            placeholder="Enter your business name"
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
        </FormField>

        <FormField
          label="Brand name for page titles"
          htmlFor="onboarding-brand"
          hint="Added to product and collection titles, so keep it to the name customers know you by."
        >
          <TextField
            id="onboarding-brand"
            value={draft.brandName ?? ''}
            onChange={(value) => patch({ brandName: value })}
            placeholder="Enter your brand name"
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
        </FormField>

        <FormField
          label="Primary storefront domain"
          htmlFor="onboarding-domain"
          hint="The address Scorelo crawls and treats as canonical."
          className="md:col-span-2"
        >
          <div className="md:max-w-[calc(50%-12px)]">
            <TextField
              id="onboarding-domain"
              value={draft.primaryDomain ?? ''}
              onChange={(value) => patch({ primaryDomain: value })}
              placeholder="Enter your storefront address"
            />
          </div>
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
        </FormField>
      </div>

      {shop && (
        <FormSection
          title="Already known from Shopify"
          description="You are not asked for these. They are read from your store each time, so changes in Shopify show up here."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <FactTile label="Currency" value={shop.currencyCode} />
            <FactTile label="Timezone" value={shop.ianaTimezone} />
            <FactTile label="Country" value={shop.country} />
          </div>
        </FormSection>
      )}
    </div>
  );
}

// ─── Step 2 · What you sell ──────────────────────────────────────────

export function StepProducts({ draft, patch, snapshot, suggestions, suggestionsLoading }: StepProps) {
  const derivedIndustry = suggestions?.industry ?? null;
  const derivedShape = suggestions?.catalogShape ?? null;

  return (
    <div className="space-y-8">
      {!suggestionsLoading && suggestions && !suggestions.available && suggestions.unavailableReason && (
        <UnavailableNote>{suggestions.unavailableReason} Choose your answers manually below.</UnavailableNote>
      )}

      <div className="grid items-start gap-x-6 gap-y-6 md:grid-cols-2">
        <FormField
          label="Industry"
          htmlFor="onboarding-industry"
          hint="Decides which checks apply — a B2B parts store is not judged on consumer retail signals."
        >
          <SelectField
            id="onboarding-industry"
            value={draft.industry ?? ''}
            options={snapshot.options.industries}
            placeholder="Select your industry"
            onChange={(value) => patch({ industry: value || null })}
          />
          {suggestionsLoading && (
            <div className="mt-2">
              <SuggestionsPending />
            </div>
          )}
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
            <DetectedNote>We could not tell your industry from your collections and product types — please choose one.</DetectedNote>
          )}
        </FormField>

        <FormField
          label="What you sell, in one line"
          htmlFor="onboarding-sells"
          hint="Written for a person, not a search engine. The most useful input for generated copy."
        >
          <TextArea
            id="onboarding-sells"
            value={draft.sellsDescription ?? ''}
            onChange={(value) => patch({ sellsDescription: value })}
            placeholder="Describe what you sell in one sentence"
            maxLength={500}
            rows={3}
          />
        </FormField>
      </div>

      <FormSection title="How you sell" description="Changes which conversion and structured-data checks run.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
      </FormSection>

      <FormSection title="Catalogue shape" description="Sets how Scorelo plans a crawl of your store.">
        <div className="grid gap-2.5 sm:grid-cols-2">
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
        {suggestionsLoading && (
          <div className="mt-2">
            <SuggestionsPending />
          </div>
        )}
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
      </FormSection>
    </div>
  );
}

// ─── Step 3 · Markets ────────────────────────────────────────────────

export function StepMarkets({ draft, patch, suggestions, suggestionsLoading }: StepProps) {
  const countries = draft.targetCountries ?? [];
  const languages = draft.targetLanguages ?? [];
  const available = countryNames();
  const selectable = available.filter((name) => !countries.includes(name));

  const removeCountry = (country: string) => {
    const next = countries.filter((item) => item !== country);
    patch({
      targetCountries: next,
      // The primary market must stay one of the selected countries.
      primaryMarket: draft.primaryMarket === country ? (next[0] ?? null) : draft.primaryMarket,
    });
  };

  const addCountry = (country: string) => {
    if (!country) return;
    patch({ targetCountries: [...countries, country], primaryMarket: draft.primaryMarket ?? country });
  };

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-x-6 gap-y-6 md:grid-cols-2">
        <FormField
          label="Countries you sell to"
          htmlFor="onboarding-country-add"
          hint="Used to judge hreflang, canonical URLs and duplicate content across markets."
        >
          {available.length > 0 ? (
            <SelectField
              id="onboarding-country-add"
              value=""
              options={selectable}
              placeholder="Add a country…"
              onChange={addCountry}
            />
          ) : (
            <UnavailableNote>
              Your browser could not provide a country list. You can continue and set markets later in Settings.
            </UnavailableNote>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {countries.map((country) => (
              <Chip key={country} label={country} onRemove={() => removeCountry(country)} />
            ))}
            {countries.length === 0 && <QuietNote>No countries selected yet.</QuietNote>}
          </div>

          {suggestions?.detectedCountry && (
            <DetectedNote
              action={{
                label: `Add ${suggestions.detectedCountry}`,
                applied: countries.includes(suggestions.detectedCountry),
                onApply: () => addCountry(suggestions.detectedCountry as string),
              }}
            >
              Your Shopify billing address is in {suggestions.detectedCountry}.
            </DetectedNote>
          )}
        </FormField>

        <FormField
          label="Primary market"
          htmlFor="onboarding-primary-market"
          hint="Which country wins when market signals conflict."
        >
          {countries.length > 1 ? (
            <SelectField
              id="onboarding-primary-market"
              value={draft.primaryMarket ?? ''}
              options={countries}
              placeholder="Select your primary market"
              onChange={(value) => patch({ primaryMarket: value || null })}
            />
          ) : (
            <p
              id="onboarding-primary-market"
              className="flex min-h-10 items-center rounded-lg border border-dashed border-surface-300 bg-surface-50/70 px-3 py-2 text-[12.5px] text-surface-500"
            >
              {countries.length === 0
                ? 'Add a country first.'
                : `${countries[0]} is your only market, so it is your primary one.`}
            </p>
          )}
        </FormField>
      </div>

      <FormSection
        title="Languages your storefront publishes"
        description="Read from the locales enabled on your Shopify store. Tick the ones you want audited."
      >
        {suggestionsLoading && <SuggestionsPending />}

        {!suggestionsLoading && suggestions?.languages && suggestions.languages.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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

        {!suggestionsLoading && suggestions?.languages && suggestions.languages.length === 0 && (
          <QuietNote>Shopify reported no enabled locales for this store.</QuietNote>
        )}

        {!suggestionsLoading && suggestions && suggestions.languages === null && (
          <UnavailableNote>
            Scorelo could not read the languages enabled on your store. International checks will be judged against
            your primary market only until this is available.
          </UnavailableNote>
        )}
      </FormSection>
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
    <div className="space-y-8">
      <FormField
        label="Target keywords"
        htmlFor="onboarding-keywords"
        hint="The non-branded terms your audit measures you against. Pick from the suggestions below or type your own."
      >
        <TagInput
          id="onboarding-keywords"
          values={keywords}
          onChange={(next) => patch({ targetKeywords: next })}
          placeholder="Type a keyword"
          max={10}
          transform={(raw) => {
            const value = raw.trim().replace(/\s+/g, ' ').toLowerCase();
            return value.length >= 3 ? value : null;
          }}
        />

        <div className="mt-3 space-y-3">
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
        </div>
      </FormField>

      <div className="grid items-start gap-x-6 gap-y-6 md:grid-cols-2">
        <FormField
          label="Branded terms"
          htmlFor="onboarding-branded"
          hint="Kept separate so branded search never flatters your non-branded performance."
        >
          <TagInput
            id="onboarding-branded"
            values={branded}
            onChange={(next) => patch({ brandedTerms: next })}
            placeholder="Type a brand term"
            max={10}
          />
          {!suggestionsLoading && brandSuggestions.length > 0 && (
            <div className="mt-3">
              <SuggestionRow
                label="From your store name"
                suggestions={brandSuggestions}
                selected={branded}
                onAdd={(value) => branded.length < 10 && patch({ brandedTerms: [...branded, value] })}
              />
            </div>
          )}
        </FormField>

        <FormField
          label="Competitors"
          htmlFor="onboarding-competitors"
          badge="optional"
          hint="Up to three storefronts to compare against."
        >
          <TagInput
            id="onboarding-competitors"
            values={competitors}
            onChange={(next) => patch({ competitorDomains: next })}
            placeholder="Type a competitor’s domain"
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
        </FormField>
      </div>
    </div>
  );
}

// ─── Step 5 · Goals and permissions ──────────────────────────────────

export function StepGoals({ draft, patch, snapshot }: StepProps) {
  // An unsaved order arrives as an empty list; the product's own order is shown — and labelled as
  // such — until they move one.
  const ordered = Boolean(draft.priorityPillars?.length);
  const pillars = ordered ? (draft.priorityPillars as string[]) : snapshot.options.pillars;
  const consent = (draft.automationConsent ?? null) as AutomationConsent | null;

  return (
    <div className="space-y-8">
      <FormSection title="What matters most right now" description="Sets what your dashboard leads with.">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
      </FormSection>

      <div className="grid items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        <FormSection
          title="May Scorelo change your store?"
          badge="required"
          description="This governs every fix Scorelo offers. You can change it whenever you like."
        >
          <div className="grid gap-2.5">
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
            <div className="mt-2.5">
              <InfoNote>
                Until you choose, Scorelo asks before every change — an unanswered question is never treated as
                permission to write to your store.
              </InfoNote>
            </div>
          )}
        </FormSection>

        <div className="space-y-7">
          <FormSection
            title="Priority order"
            description={
              ordered
                ? 'Findings are ranked in this order when their severity is equal.'
                : 'Findings are ranked in this order when their severity is equal. This is Scorelo’s default order until you move something.'
            }
          >
            <PriorityList
              items={pillars.map((key) => ({ key, label: PILLAR_LABELS[key] ?? key }))}
              onReorder={(keys) => patch({ priorityPillars: keys })}
            />
          </FormSection>

          <FormField
            label="Audit alerts"
            htmlFor="onboarding-alerts"
            hint="Applied to your email notification settings when you finish."
          >
            <SelectField
              id="onboarding-alerts"
              value={draft.alertFrequency ?? ''}
              options={snapshot.options.alertFrequencies}
              placeholder="Choose how often to be emailed"
              onChange={(value) => patch({ alertFrequency: value || null })}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
