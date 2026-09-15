import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Loader2, Store } from 'lucide-react';
import ScoreloLogo from '../../components/auth/ScoreloLogo';
import { Button } from '../../components/workflows/WorkflowPrimitives';
import { StepHeader, Stepper, UnavailableNote } from '../../components/onboarding/OnboardingPrimitives';
import {
  StepBusiness,
  StepGoals,
  StepKeywords,
  StepMarkets,
  StepProducts,
  type StepProps,
} from '../../components/onboarding/OnboardingSteps';
import {
  STEP_META,
  TOTAL_STEPS,
  completeOnboarding,
  deferOnboarding,
  describeOnboardingError,
  fetchOnboarding,
  fetchOnboardingSuggestions,
  saveOnboardingStep,
  skipOnboardingStep,
  type OnboardingSnapshot,
  type OnboardingSuggestions,
  type StepPayload,
} from '../../data/onboarding.repository';

/**
 * ─── Guided setup ────────────────────────────────────────────────────
 *
 * Five steps, shown on their own page rather than inside the app shell: a merchant answering
 * these has nothing to navigate to yet, and a sidebar full of empty dashboards is a distraction
 * from the only task on screen.
 *
 * ONE DRAFT, HELD HERE. The step components are presentational, so switching steps cannot lose an
 * answer to a component unmounting. Each step is persisted when the merchant leaves it, which is
 * what makes "finish later" resume exactly where they were on any device.
 *
 * PRE-FILL RULES. A field is pre-filled only from something read out of the merchant's real store,
 * and only while they have not edited it themselves. Two fields are deliberately never pre-filled:
 * the primary goal, and permission to change the store. Both are decisions only the merchant can
 * make, and a pre-selected answer to either would be us deciding on their behalf.
 */

const STEP_FIELDS: Record<number, Array<keyof StepPayload>> = {
  1: ['organizationName', 'brandName', 'primaryDomain'],
  2: ['industry', 'sellsDescription', 'businessModel', 'catalogShape'],
  3: ['targetCountries', 'targetLanguages', 'primaryMarket'],
  4: ['targetKeywords', 'brandedTerms', 'competitorDomains'],
  5: ['primaryGoal', 'priorityPillars', 'automationConsent', 'alertFrequency'],
};

const STEP_COMPONENTS: Record<number, (props: StepProps) => ReactElement> = {
  1: StepBusiness,
  2: StepProducts,
  3: StepMarkets,
  4: StepKeywords,
  5: StepGoals,
};

/** How many derived keywords are placed in the field. The rest stay as one-click suggestions —
 * ten pre-filled terms is a list to prune, which is the work the seeding exists to remove. */
const SEEDED_KEYWORD_COUNT = 5;

export default function Onboarding() {
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [draft, setDraft] = useState<StepPayload>({ step: 1 });
  const [step, setStep] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Fields the merchant has edited. A pre-fill never overwrites one of these, so suggestions
   * arriving late cannot undo something already typed. */
  const touched = useRef(new Set<keyof StepPayload>());

  const patch = useCallback((changes: Partial<StepPayload>) => {
    for (const key of Object.keys(changes) as Array<keyof StepPayload>) touched.current.add(key);
    setDraft((previous) => ({ ...previous, ...changes }));
    setSaveError(null);
  }, []);

  /** Fills a field only if it is still empty and untouched. */
  const seed = useCallback((current: StepPayload, key: keyof StepPayload, value: unknown): StepPayload => {
    if (touched.current.has(key)) return current;
    const existing = current[key];
    const isEmpty = existing === null || existing === undefined || (Array.isArray(existing) && existing.length === 0);
    if (!isEmpty || value === null || value === undefined) return current;
    if (Array.isArray(value) && value.length === 0) return current;
    return { ...current, [key]: value };
  }, []);

  // ── Initial load ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const state = await fetchOnboarding();
        if (cancelled) return;

        // A completed setup is not redirected away — the gate never sends anyone here once it is
        // finished, so arriving with `completedAt` set means the merchant came deliberately to
        // change an answer. The page becomes an edit surface, and saving leaves it complete.
        setSnapshot(state);
        setStep(state.completedAt ? 1 : state.currentStep);

        // Answers already saved take precedence over anything derived — they are the merchant's.
        let next: StepPayload = { step: state.currentStep, ...state.answers };
        const shop = state.detection.shop;
        if (shop) {
          next = seed(next, 'organizationName', shop.name);
          next = seed(next, 'brandName', shop.name);
          next = seed(next, 'primaryDomain', shop.primaryUrl);
        }
        // The pillar order is a real default (the product's own order), not a guess about them.
        next = seed(next, 'priorityPillars', state.options.pillars);
        setDraft(next);
      } catch (error) {
        if (!cancelled) setLoadError(describeOnboardingError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, seed]);

  // ── Catalogue-derived suggestions ──────────────────────────────────
  // Fetched once, in parallel with the merchant reading step 1, so steps 2–4 are ready when they
  // arrive rather than making them wait on a catalogue read.
  useEffect(() => {
    if (!snapshot?.connected) {
      setSuggestionsLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const derived = await fetchOnboardingSuggestions();
        if (cancelled) return;
        setSuggestions(derived);

        setDraft((current) => {
          let next = current;
          // Only pre-select an industry we are reasonably sure of. A weak match is shown as a
          // note under the field instead, for the merchant to accept deliberately.
          if (derived.industry && derived.industry.confidence !== 'low') {
            next = seed(next, 'industry', derived.industry.value);
          }
          if (derived.catalogShape) next = seed(next, 'catalogShape', derived.catalogShape.value);
          if (derived.detectedCountry) next = seed(next, 'targetCountries', [derived.detectedCountry]);
          if (derived.detectedCountry) next = seed(next, 'primaryMarket', derived.detectedCountry);
          if (derived.languages) {
            const published = derived.languages.filter((locale) => locale.published).map((locale) => locale.locale);
            next = seed(next, 'targetLanguages', published);
          }
          if (derived.brandedTerms.length > 0) {
            next = seed(next, 'brandedTerms', derived.brandedTerms);
            // The shortest variant is the one that belongs in a title tag suffix.
            const shortest = [...derived.brandedTerms].sort((a, b) => a.length - b.length)[0];
            next = seed(next, 'brandName', shortest);
          }
          if (derived.keywords.length > 0) {
            next = seed(
              next,
              'targetKeywords',
              derived.keywords.slice(0, SEEDED_KEYWORD_COUNT).map((keyword) => keyword.value),
            );
          }
          return next;
        });
      } catch {
        // Suggestions are an accelerant, not a dependency. A failure leaves the fields empty and
        // the steps say so — it never blocks setup.
        if (!cancelled) setSuggestions(null);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot?.connected, seed]);

  /** Only the current step's fields, so a save can never write across the form. */
  const payloadForStep = (target: number): StepPayload => {
    const payload: StepPayload = { step: target };
    for (const field of STEP_FIELDS[target]) {
      const value = draft[field];
      if (value !== undefined) Object.assign(payload, { [field]: value });
    }
    return payload;
  };

  const persist = async (target: number): Promise<OnboardingSnapshot | null> => {
    try {
      const saved = await saveOnboardingStep(payloadForStep(target));
      setSnapshot(saved);
      return saved;
    } catch (error) {
      setSaveError(describeOnboardingError(error));
      return null;
    }
  };

  const goTo = async (target: number) => {
    if (busy) return;
    setBusy(true);
    // Save what is on screen before moving, in both directions — going back to review step 2 must
    // not discard what was typed on step 3.
    const saved = await persist(step);
    setBusy(false);
    if (saved) setStep(Math.min(TOTAL_STEPS, Math.max(1, target)));
  };

  const onSkip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Answers already typed on a skipped step are kept — skipping means "not now", not "discard".
      await persist(step);
      const saved = await skipOnboardingStep(step);
      setSnapshot(saved);
      setStep(Math.min(TOTAL_STEPS, step + 1));
    } catch (error) {
      setSaveError(describeOnboardingError(error));
    } finally {
      setBusy(false);
    }
  };

  const onFinishLater = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await persist(step);
      await deferOnboarding();
      navigate('/', { replace: true });
    } catch (error) {
      setSaveError(describeOnboardingError(error));
      setBusy(false);
    }
  };

  const onFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await persist(TOTAL_STEPS);
      if (!saved) {
        setBusy(false);
        return;
      }
      await completeOnboarding();
      navigate('/', { replace: true });
    } catch (error) {
      setSaveError(describeOnboardingError(error));
      setBusy(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <Shell>
        <div className="px-4 py-6">
          <UnavailableNote>{loadError}</UnavailableNote>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!snapshot) {
    return (
      <Shell>
        <div className="flex items-center gap-2 px-4 py-8 text-[12.5px] text-surface-500">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading your store…
        </div>
      </Shell>
    );
  }

  // Setup pre-fills every answer from the connected store, so there is nothing useful to do
  // without one. Sending the merchant to connect is the only honest next step.
  if (!snapshot.connected) {
    return (
      <Shell>
        <div className="px-4 py-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Store size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-bold tracking-tight text-surface-950">Connect your Shopify store first</h1>
              <p className="mt-1 max-w-md text-[12.5px] leading-[1.5] text-surface-500">
                Guided setup fills in your business details, markets and keyword suggestions from your real store data.
                Connect Shopify and it will take about two minutes.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate('/integrations')}>Go to Integrations</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Skip for now
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  const meta = STEP_META[step - 1];
  const StepComponent = STEP_COMPONENTS[step];
  const editing = Boolean(snapshot.completedAt);
  const stepperSteps = STEP_META.map((entry) => ({
    step: entry.step,
    title: entry.title,
    status: snapshot.progress.find((progress) => progress.step === entry.step)?.status ?? 'pending',
  }));

  return (
    <Shell>
      {editing && (
        <div className="flex items-center gap-2 border-b border-success-100 bg-success-50 px-4 py-2">
          <Check size={13} className="flex-shrink-0 text-success-700" aria-hidden="true" />
          <p className="text-[11.5px] leading-[1.45] text-success-700">
            Setup is complete. Change anything you like — every step stays available, and saving keeps your setup
            finished.
          </p>
        </div>
      )}

      <div className="border-b border-surface-200 bg-surface-50/60">
        <Stepper current={step} steps={stepperSteps} onJump={(target) => void goTo(target)} />
      </div>

      <StepHeader step={step} total={TOTAL_STEPS} title={meta.title} purpose={meta.purpose} />

      <div className="px-4 py-3.5">
        <StepComponent
          draft={draft}
          patch={patch}
          snapshot={snapshot}
          suggestions={suggestions}
          suggestionsLoading={suggestionsLoading}
        />
      </div>

      {saveError && (
        <div className="px-4 pb-2">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-critical-700">
            <AlertTriangle size={12} aria-hidden="true" />
            {saveError}
          </p>
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-200 bg-surface-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => void goTo(step - 1)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-surface-600 transition-colors hover:text-surface-900 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => void onFinishLater()}
            disabled={busy}
            className="rounded-md px-1.5 py-1 text-[12px] font-medium text-surface-500 underline-offset-2 transition-colors hover:text-surface-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {editing ? 'Save and close' : 'Finish later'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Skipping is meaningless once setup is complete — there is nothing left to defer, and
              recording a skip against a finished step would misreport it on the dashboard. */}
          {!editing && (
            <Button variant="secondary" onClick={() => void onSkip()} disabled={busy}>
              Skip this step
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button onClick={() => void goTo(step + 1)} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Next' : 'Continue'}
            </Button>
          ) : (
            <Button onClick={() => void onFinish()} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Finish setup'}
            </Button>
          )}
        </div>
      </footer>
    </Shell>
  );
}

/** The page frame: logo, a single card, nothing else competing for attention. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full overflow-y-auto bg-surface-50">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 py-6 sm:py-10">
        <div className="mb-4 flex justify-center">
          <ScoreloLogo />
        </div>
        <div className="overflow-hidden rounded-lg border border-surface-200 bg-surface-0 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]">
          {children}
        </div>
        <p className="mt-3 text-center text-[11.5px] text-surface-500">
          Your answers are saved as you go. You can change any of them later in Settings.
        </p>
      </div>
    </div>
  );
}
