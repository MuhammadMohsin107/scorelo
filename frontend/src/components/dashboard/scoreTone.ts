import type { ScoreStatus } from '../../data/dashboard/dashboard.types';

/** Score thresholds shared across the dashboard. */
export const SCORE_TARGET = 90; // "Excellent" threshold, shown as a target marker on bars

export function statusFromScore(score: number): ScoreStatus {
  if (score >= SCORE_TARGET) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'needs-work';
  return 'critical';
}

export interface Tone {
  /** Small pill/badge styling. */
  badge: string;
  /** Filled bar / dot color. */
  bar: string;
  /** Plain text tint. */
  text: string;
  /** Hex used inside SVG rings. */
  hex: string;
}

// Full class strings so Tailwind can see them at build time.
export const statusTone: Record<ScoreStatus, Tone> = {
  excellent: {
    badge: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100',
    bar: 'bg-success-500',
    text: 'text-success-700',
    hex: '#16a34a',
  },
  good: {
    badge: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
    bar: 'bg-brand-500',
    text: 'text-brand-700',
    hex: '#4f46e5',
  },
  'needs-work': {
    badge: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100',
    bar: 'bg-warning-500',
    text: 'text-warning-700',
    hex: '#ca8a04',
  },
  critical: {
    badge: 'bg-critical-50 text-critical-700 ring-1 ring-inset ring-critical-100',
    bar: 'bg-critical-500',
    text: 'text-critical-700',
    hex: '#dc2626',
  },
  // Neutral on purpose: an unmeasured store is not failing, so it must not borrow the
  // critical/warning palette that would read as a bad result.
  'not-measured': {
    badge: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-200',
    bar: 'bg-surface-300',
    text: 'text-surface-600',
    hex: '#d4d4d8',
  },
};

/** Shared card shell used by every dashboard section. */
export const cardClass =
  'rounded-2xl border border-surface-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.03)]';

/** Re-exported from the canonical definition in data/pillarMeta.ts so this module's existing
 * importers keep working while there is only one map to maintain. */
export { pillarRoutes } from '../../data/pillarMeta';
