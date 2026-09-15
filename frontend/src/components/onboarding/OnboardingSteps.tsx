import { Loader2 } from 'lucide-react';
import {
  CheckCard,
  Chip,
  ChoiceCard,
  DetectedNote,
  FactTile,
  FormField,
  FormGrid,
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
 * EVERY STEP IS BUILT FROM ROWS on one FormGrid: either two equal fields side by side, or one item
 * spanning the full row. Fields in a row share their label, description and input lines (see
 * FormGrid), so inputs line up regardless of how long their help text is. Card groups use equal
 * columns, and a group with an odd card out lets the last one fill its row rather than leave a gap.
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

/**
 * Lets the last card of a group fill its row when the count does not divide evenly, so a grid of
 * five never ends with a single card beside an empty space. Spans are written out in full because
 * Tailwind only generates classes it can see in the source.
 */
function lastCardSpan(index: number, count: number, columns: { sm: number; lg: number }): string {
  if (index !== count - 1) return '';
  const sm = count % columns.sm === 0 ? '' : SM_SPAN[columns.sm - (count % columns.sm) + 1] ?? '';
  const lg = count % columns.lg === 0 ? 'lg:col-span-1' : LG_SPAN[columns.lg - (count % columns.lg) + 1] ?? '';
  return `${sm} ${lg}`.trim();
}

const SM_SPAN: Record<number, string> = { 2: 'sm:col-span-2', 3: 'sm:col-span-3' };
const LG_SPAN: Record<number, string> = { 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4' };

// ─── Step 1 · Your business ──────────────────────────────────────────

export function StepBusiness({ draft, patch, snapshot }: StepProps) {
  const shop = snapshot.detection.shop;

  return (
    <div className="space-y-8">
      {!snapshot.detection.available && snapshot.detection.unavailableReason && (
        <UnavailableNote>
          {snapshot.detection.unavailableReason} No suggestions could be read from your store — you can still type
          your answers, and they will be saved.
        </UnavailableNote>
      )}

      <FormGrid>
        <FormField
          label="Organisation name"
          htmlFor="onboarding-organization"
          hint="The business name used across your reports."
          extras={
            shop?.name ? (
              <DetectedNote
                action={{
                  label: 'Use this',
                  applied: draft.organizationName === shop.name,
                  onApply: () => patch({ organizationName: shop.name }),
                }}
              >
                Your Shopify store name is “{shop.name}”.
              </DetectedNote>
            ) : null
          }
        >
          <TextField
            id="onboarding-organization"
            value={draft.organizationName ?? ''}
            onChange={(value) => patch({ organizationName: value })}
            placeholder="Enter your business name"
          />
        </FormField>

        <FormField
          label="Brand name for page titles"
          htmlFor="onboarding-brand"
          hint="Added to product and collection titles, so keep it to the name customers know you by."
          extras={
            shop?.name ? (
              <DetectedNote
                action={{
                  label: 'Use this',
                  applied: draft.brandName === shop.name,
                  onApply: () => patch({ brandName: shop.name }),
                }}
              >
                Your Shopify store name is “{shop.name}”. Shorten it if it is long.
              </DetectedNote>
            ) : null
          }
        >
          <TextField
            id="onboarding-brand"
            value={draft.brandName ?? ''}
            onChange={(value) => patch({ brandName: value })}
            placeholder="Enter your brand name"
          />
        </FormField>

        <FormField
          label="Primary storefront domain"
          htmlFor="onboarding-domain"
          hint="The address Scorelo crawls and treats as canonical."
          className="md:col-span-2"
          extras={
            shop?.primaryUrl ? (
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
            ) : shop ? (
              <DetectedNote>Shopify did not return a primary domain for this store.</DetectedNote>
            ) : null
          }
        >
          <TextField
            id="onboarding-domain"
            value={draft.primaryDomain ?? ''}
            onChange={(value) => patch({ primaryDomain: value })}
            placeholder="Enter your storefront address"
          />
        </FormField>

        {shop && (
          <FormSection
            className="md:col-span-2"
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
      </FormGrid>
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

      <FormGrid>
        <FormField
          label="Industry"
          htmlFor="onboarding-industry"
          hint="Decides which checks apply — a B2B parts store is not judged on consumer retail signals."
          extras={
            <>
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
            </>
          }
        >
          <SelectField
            id="onboarding-industry"
            value={draft.industry ?? ''}
            options={snapshot.options.industries}
            placeholder="Select your industry"
            onChange={(value) => patch({ industry: value || null })}
          />
        </FormField>

        <FormField
          label="How you sell"
          htmlFor="onboarding-business-model"
          hint="Changes which conversion and structured-data checks run."
        >
          <SelectField
            id="onboarding-business-model"
            value={draft.businessModel ?? ''}
            options={snapshot.options.businessModels}
            placeholder="Select how you sell"
            onChange={(value) => patch({ businessModel: value || null })}
          />
        </FormField>

        <FormField
          label="What you sell, in one line"
          htmlFor="onboarding-sells"
          hint="Written for a person, not a search engine. The most useful input for generated copy."
          className="md:col-span-2"
        >
          <TextArea
            id="onboarding-sells"
            value={draft.sellsDescription ?? ''}
            onChange={(value) => patch({ sellsDescription: value })}
            placeholder="Describe what you sell in one sentence"
            maxLength={500}
            rows={2}
          />
        </FormField>

        <FormSection
          className="md:col-span-2"
          title="Catalogue shape"
          description="Sets how Scorelo plans a crawl of your store."
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
      </FormGrid>
    </div>
  );
}

// ─── Step 3 · Markets ────────────────────────────────────────────────

export function StepMarkets({ draft, patch, suggestions, suggestionsLoading }: StepProps) {
  const countries = draft.targetCountries ?? [];
  const languages = draft.targetLanguages ?? [];
  const available = countryNames();
  const selectable = available.filter((name) => !countries.includes(name));
  const locales = suggestions?.languages ?? null;

  const removeCountry = (country: string) => {
    const next = countries.filter((item) => item !== country);
    patch({
      targetCountries: next,
      // The primary market must stay one of the selected countries.
      primaryMarket: draft.primaryMarket === country ? (next[0] ?? null) : draft.primaryMarket,
    });
  };

  const addCountry = (country: string) => {
    if (!country || countries.includes(country)) return;
    patch({ targetCountries: [...countries, country], primaryMarket: draft.primaryMarket ?? country });
  };

  return (
    <div className="space-y-8">
      <FormGrid>
        <FormField
          label="Countries you sell to"
          htmlFor="onboarding-country-add"
          hint="Used to judge hreflang, canonical URLs and duplicate content across markets."
          extras={
            <>
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
            </>
          }
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
              className="flex h-10 items-center rounded-lg border border-dashed border-surface-300 bg-surface-50/70 px-3 text-[12.5px] text-surface-500"
            >
              {countries.length === 0 ? 'Add a country first.' : `${countries[0]} is your only market, so it is your primary one.`}
            </p>
          )}
        </FormField>

        <FormSection
          className="md:col-span-2"
          title="Languages your storefront publishes"
          description="Read from the locales enabled on your Shopify store. Tick the ones you want audited."
        >
          {suggestionsLoading && <SuggestionsPending />}

          {!suggestionsLoading && locales && locales.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {locales.map((locale, index) => (
                <div key={locale.locale} className={lastCardSpan(index, locales.length, { sm: 2, lg: 3 })}>
                  <CheckCard
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
                </div>
              ))}
            </div>
          )}

          {!suggestionsLoading && locales && locales.length === 0 && (
            <QuietNote>Shopify reported no enabled locales for this store.</QuietNote>
          )}

          {!suggestionsLoading && suggestions && locales === null && (
            <UnavailableNote>
              Scorelo could not read the languages enabled on your store. International checks will be judged against
              your primary market only until this is available.
            </UnavailableNote>
          )}
        </FormSection>
      </FormGrid>
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
      <FormGrid>
        <FormField
          label="Target keywords"
          htmlFor="onboarding-keywords"
          hint="The non-branded terms your audit measures you against. Pick from the suggestions below or type your own."
          className="md:col-span-2"
          extras={
            <div className="mt-3 space-y-3 empty:hidden">
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
                  Your store has no collections or product types we could turn into keyword suggestions yet, so this
                  list starts empty. Add the terms you want to rank for — you can refine them any time.
                </InfoNote>
              )}

              {!suggestionsLoading && suggestions && !suggestions.available && suggestions.unavailableReason && (
                <UnavailableNote>{suggestions.unavailableReason} Add your keywords manually.</UnavailableNote>
              )}
            </div>
          }
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
        </FormField>

        <FormField
          label="Branded terms"
          htmlFor="onboarding-branded"
          hint="Kept separate so branded search never flatters your non-branded performance."
          extras={
            !suggestionsLoading && brandSuggestions.length > 0 ? (
              <div className="mt-3">
                <SuggestionRow
                  label="From your store name"
                  suggestions={brandSuggestions}
                  selected={branded}
                  onAdd={(value) => branded.length < 10 && patch({ brandedTerms: [...branded, value] })}
                />
              </div>
            ) : null
          }
        >
          <TagInput
            id="onboarding-branded"
            values={branded}
            onChange={(next) => patch({ brandedTerms: next })}
            placeholder="Type a brand term"
            max={10}
          />
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
      </FormGrid>
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
  const goals = snapshot.options.primaryGoals;
  const alerts = snapshot.options.alertFrequencies;

  return (
    <div className="space-y-8">
      <FormGrid>
        <FormSection
          className="md:col-span-2"
          title="What matters most right now"
          description="Sets what your dashboard leads with."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {goals.map((goal, index) => (
              <ChoiceCard
                key={goal}
                name="primary-goal"
                value={goal}
                label={goal}
                selected={draft.primaryGoal === goal}
                onSelect={(value) => patch({ primaryGoal: value })}
                className={lastCardSpan(index, goals.length, { sm: 2, lg: 5 })}
              />
            ))}
          </div>
        </FormSection>

        <FormSection
          title="May Scorelo change your store?"
          badge="required"
          description="This governs every fix Scorelo offers. You can change it whenever you like."
        >
          <div className="grid gap-3">
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
            <div className="mt-3">
              <InfoNote>
                Choose one to finish setup. Until you do, Scorelo asks before every change — an unanswered question
                is never treated as permission to write to your store.
              </InfoNote>
            </div>
          )}
        </FormSection>

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

        <FormSection
          className="md:col-span-2"
          title="Audit alerts"
          description="How often Scorelo emails you. Applied to your notification settings when you finish."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alerts.map((frequency, index) => (
              <ChoiceCard
                key={frequency}
                name="alert-frequency"
                value={frequency}
                label={frequency}
                selected={draft.alertFrequency === frequency}
                onSelect={(value) => patch({ alertFrequency: value })}
                className={lastCardSpan(index, alerts.length, { sm: 2, lg: 4 })}
              />
            ))}
          </div>
        </FormSection>
      </FormGrid>
    </div>
  );
}
