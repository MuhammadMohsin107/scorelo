import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Globe,
  Loader2,
  Package,
  Search,
  Store,
  Target,
  type LucideIcon,
} from 'lucide-react';
import ScoreloLogo from '../../components/auth/ScoreloLogo';
import {
  ActionButton,
  StepHeader,
  StepRail,
  Stepper,
  UnavailableNote,
} from '../../components/onboarding/OnboardingPrimitives';
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
 * WIDE, NOT TALL. A progress rail sits beside the step on large screens and the step's fields pair
 * up in two columns, so most steps fit with little scrolling. The action bar is pinned to the bottom
 * of the card so Continue is always in reach on the longer ones.
 *
 * ONE DRAFT, HELD HERE. The step components are presentational, so switching steps cannot lose an
 * answer to a component unmounting. Each step is persisted when the merchant leaves it, which is
 * what makes "finish later" resume exactly where they were on any device.
 *
 * NOTHING IS PRE-FILLED. Every field opens empty unless the merchant saved an answer to it. What
 * Shopify tells us about the store is shown beside a field as a one-click suggestion, never written
 * into it: each step is saved on Continue, Skip and Finish later, so a value placed in a field for
 * the merchant would be stored as their answer, tick the step as complete, and reappear on every
 * reload as if they had typed it.
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

const STEP_ICONS: Record<number, LucideIcon> = {
  1: Building2,
  2: Package,
  3: Globe,
  4: Search,
  5: Target,
};

/**
 * Where setup opens. A merchant who has answered nothing always starts at step 1.
 *
 * Derived from what is actually answered, not from the stored `currentStep` pointer: setup opens at
 * the first step that is neither answered nor deliberately skipped. The pointer only ever moved
 * forward, so clearing an earlier answer — or pressing Continue past steps without answering them —
 * could still send the merchant to a later step than the first one that needs them. A completed
 * setup opens at step 1, because arriving then means reviewing answers from the top.
 */
function openingStep(state: OnboardingSnapshot): number {
  if (state.completedAt) return 1;
  const firstOpen = [...state.progress]
    .sort((a, b) => a.step - b.step)
    .find((entry) => entry.status === 'pending');
  return firstOpen?.step ?? TOTAL_STEPS;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [draft, setDraft] = useState<StepPayload>({ step: 1 });
  const [step, setStep] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = useCallback((changes: Partial<StepPayload>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setSaveError(null);
  }, []);

  // A new step starts at its top. The action bar is pinned to the bottom, so without this the
  // merchant would land halfway down the next step with its heading scrolled out of view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

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
        const opening = openingStep(state);
        setSnapshot(state);
        setStep(opening);

        // Only what the merchant saved. Shopify's values are offered by the steps as suggestions.
        setDraft({ step: opening, ...state.answers });
      } catch (error) {
        if (!cancelled) setLoadError(describeOnboardingError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // ── Catalogue-derived suggestions ──────────────────────────────────
  // Fetched once, in parallel with the merchant reading step 1, so steps 2–4 are ready when they
  // arrive rather than making them wait on a catalogue read. Shown as suggestions only.
  useEffect(() => {
    if (!snapshot?.connected) {
      setSuggestionsLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const derived = await fetchOnboardingSuggestions();
        if (!cancelled) setSuggestions(derived);
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
  }, [snapshot?.connected]);

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
    // The one answer setup cannot finish without: whether Scorelo may write to the store. Every
    // other question can be skipped, but finishing without this would leave the write gate on a
    // default the merchant never saw chosen.
    if (!draft.automationConsent) {
      setSaveError('Choose whether Scorelo may change your store before finishing setup.');
      return;
    }
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
      <Frame scrollRef={scrollRef}>
        <Card>
          <div className="space-y-4 px-5 py-6 sm:px-7">
            <UnavailableNote>{loadError}</UnavailableNote>
            <ActionButton variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </ActionButton>
          </div>
        </Card>
      </Frame>
    );
  }

  if (!snapshot) {
    return (
      <Frame scrollRef={scrollRef}>
        <Card>
          <div role="status" className="flex items-center gap-2.5 px-5 py-8 text-[13px] text-surface-500 sm:px-7">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading your store…
          </div>
        </Card>
      </Frame>
    );
  }

  // Setup's suggestions all come from the connected store, so there is nothing useful to do
  // without one. Sending the merchant to connect is the only honest next step.
  if (!snapshot.connected) {
    return (
      <Frame scrollRef={scrollRef}>
        <Card>
          <div className="px-5 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                <Store size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold tracking-tight text-surface-950">Connect your Shopify store first</h1>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-surface-500">
                  Guided setup suggests your business details, markets and keywords from your real store data.
                  Connect Shopify and it will take about two minutes.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton onClick={() => navigate('/integrations')}>Go to Integrations</ActionButton>
              <ActionButton variant="ghost" onClick={() => navigate('/')}>
                Skip for now
              </ActionButton>
            </div>
          </div>
        </Card>
      </Frame>
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
  const jump = (target: number) => void goTo(target);

  return (
    <Frame scrollRef={scrollRef} rail={<StepRail current={step} steps={stepperSteps} onJump={jump} />}>
      <Card>
        {editing && (
          <div className="flex items-center gap-2 rounded-t-xl border-b border-success-100 bg-success-50 px-5 py-2.5 sm:px-7">
            <Check size={14} className="flex-shrink-0 text-success-700" aria-hidden="true" />
            <p className="text-[12px] leading-[1.45] text-success-700">
              Setup is complete. Change anything you like — every step stays available, and saving keeps your setup
              finished.
            </p>
          </div>
        )}

        <div className="border-b border-surface-200 lg:hidden">
          <Stepper current={step} steps={stepperSteps} onJump={jump} />
        </div>

        <StepHeader step={step} total={TOTAL_STEPS} title={meta.title} purpose={meta.purpose} icon={STEP_ICONS[step]} />

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <StepComponent
            draft={draft}
            patch={patch}
            snapshot={snapshot}
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
          />
        </div>

        <footer className="sticky bottom-0 z-10 rounded-b-xl border-t border-surface-200 bg-surface-0/95 px-5 py-3.5 backdrop-blur-sm sm:px-7">
          {saveError && (
            <p role="alert" className="mb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-critical-700">
              <AlertTriangle size={13} aria-hidden="true" />
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {step > 1 && (
                <ActionButton variant="ghost" onClick={() => void goTo(step - 1)} disabled={busy}>
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back
                </ActionButton>
              )}
              <ActionButton variant="ghost" onClick={() => void onFinishLater()} disabled={busy}>
                {editing ? 'Save and close' : 'Finish later'}
              </ActionButton>
            </div>

            {/* ml-auto keeps the forward actions on the right even when the bar wraps on a phone. */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {/* Skipping is offered on every step but the last. Once setup is complete there is
                  nothing left to defer, and on the last step a skip would only record itself and
                  leave the merchant where they are — Finish later is the honest way out there. */}
              {!editing && step < TOTAL_STEPS && (
                <ActionButton variant="secondary" onClick={() => void onSkip()} disabled={busy}>
                  Skip this step
                </ActionButton>
              )}
              {step < TOTAL_STEPS ? (
                <ActionButton onClick={() => void goTo(step + 1)} disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Next' : 'Continue'}
                  {!busy && <ArrowRight size={15} aria-hidden="true" />}
                </ActionButton>
              ) : (
                <ActionButton onClick={() => void onFinish()} disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Finish setup'}
                  {!busy && <Check size={15} aria-hidden="true" />}
                </ActionButton>
              )}
            </div>
          </div>
        </footer>
      </Card>
    </Frame>
  );
}

/**
 * The page frame: logo, an optional progress rail, and the step card.
 *
 * `h-full`, not `min-h-full`: html, body and #root are fixed to the viewport with overflow hidden,
 * so this div must be exactly viewport-high to become the scroll container. With `min-h-full` it
 * grew to fit the card and the bottom of a long step was clipped with no way to scroll to it.
 *
 * Without a rail (loading, errors, not connected) the card is centred at a reading width.
 */
function Frame({
  children,
  rail,
  scrollRef,
}: {
  children: ReactNode;
  rail?: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overscroll-contain bg-surface-50"
      // A soft brand wash at the top of the page. Built from the theme's own tokens, so it follows
      // light and dark mode instead of fixing a colour.
      style={{ backgroundImage: 'radial-gradient(1200px 420px at 50% -120px, var(--c-brand-100), transparent 70%)' }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <header className="mb-5 flex items-center justify-between gap-4 lg:mb-7">
          <ScoreloLogo />
          <p className="hidden text-right text-[12px] text-surface-500 sm:block">
            Your answers are saved as you go. You can change any of them later in Settings.
          </p>
        </header>

        {rail ? (
          <div className="grid flex-1 items-start gap-6 lg:grid-cols-[264px_minmax(0,1fr)] xl:gap-8">
            <aside className="hidden lg:sticky lg:top-6 lg:block">{rail}</aside>
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-xl">{children}</div>
        )}
      </div>
    </div>
  );
}

/** No `overflow-hidden`: it would stop the action bar from sticking. Corners are rounded on the
 * first and last children instead. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-0 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)]">
      {children}
    </div>
  );
}
