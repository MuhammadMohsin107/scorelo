import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { Button } from '../workflows/WorkflowPrimitives';
import { SettingsCard } from '../settings/SettingsPrimitives';
import {
  AUTOMATION_CONSENT_OPTIONS,
  STEP_META,
  TOTAL_STEPS,
  fetchOnboarding,
  type OnboardingSnapshot,
} from '../../data/onboarding.repository';

/**
 * Guided setup, summarised inside Settings → Workspace & store.
 *
 * Its real job is to be the permanent way back in. The answers given during setup drive scoring
 * context and, in the case of automation consent, whether Scorelo may write to the merchant's
 * store at all — so every one of them has to remain changeable from a place a merchant would
 * think to look.
 *
 * Shows what is actually stored, never a placeholder: an unanswered step reads "Not answered".
 */
export default function GuidedSetupCard() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await fetchOnboarding();
        if (!cancelled) setSnapshot(state);
      } catch {
        // Leaves the card unrendered rather than showing an error inside a settings form.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot || !snapshot.connected) return null;

  const complete = snapshot.progress.filter((entry) => entry.status === 'complete').length;
  const { answers } = snapshot;
  const consent = AUTOMATION_CONSENT_OPTIONS.find((option) => option.value === answers.automationConsent);

  const rows: Array<{ label: string; value: string | null }> = [
    { label: 'Organisation', value: answers.organizationName },
    { label: 'Brand name in titles', value: answers.brandName },
    { label: 'Industry', value: answers.industry },
    { label: 'Markets', value: answers.targetCountries.length > 0 ? answers.targetCountries.join(', ') : null },
    {
      label: 'Target keywords',
      value: answers.targetKeywords.length > 0 ? `${answers.targetKeywords.length} set` : null,
    },
    // Null reads as "ask before every change" because that is genuinely how the product behaves
    // when the question is unanswered — not as a blank that implies no rule is in force.
    { label: 'Permission to change your store', value: consent?.label ?? 'Ask me before every change' },
  ];

  return (
    <SettingsCard
      title="Guided setup"
      description="The answers Scorelo scores your store against."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-surface-500">
            {snapshot.completedAt
              ? `Completed ${new Date(snapshot.completedAt).toLocaleDateString()}.`
              : `${complete} of ${TOTAL_STEPS} steps answered — ${STEP_META.filter(
                  (meta) =>
                    snapshot.progress.find((entry) => entry.step === meta.step)?.status !== 'complete',
                )
                  .map((meta) => meta.title)
                  .join(', ')} outstanding.`}
          </p>
          <Button variant="secondary" onClick={() => navigate('/onboarding')}>
            {snapshot.completedAt ? 'Review answers' : 'Continue setup'}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <ListChecks size={14} aria-hidden="true" />
        </span>
        <dl className="min-w-0 flex-1">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-100 py-1.5 last:border-0"
            >
              <dt className="text-[12.5px] font-semibold text-surface-800">{row.label}</dt>
              <dd className={`text-[12.5px] ${row.value ? 'text-surface-700' : 'text-surface-400'}`}>
                {row.value ?? 'Not answered'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </SettingsCard>
  );
}
