// Visual tokens for every SEO sub-pillar page.
//
// Direction (approved on Title Tags): hairline borders instead of soft
// shadows, tinted section headers for structure, accent colour used
// sparingly at high contrast.

import type { Severity } from '../../../data/seo/subpillar.model';

export type Tone = Severity | 'healthy';

/** Full class strings so Tailwind sees them at build time. */
export const toneStyles: Record<Tone, { badge: string; bar: string; dot: string; tile: string; text: string; rail: string }> = {
  healthy: {
    badge: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/15',
    bar: 'bg-success-500',
    dot: 'bg-success-500',
    tile: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/15',
    text: 'text-success-700',
    rail: 'bg-success-500',
  },
  critical: {
    badge: 'bg-critical-50 text-critical-700 ring-1 ring-inset ring-critical-600/15',
    bar: 'bg-critical-500',
    dot: 'bg-critical-500',
    tile: 'bg-critical-50 text-critical-700 ring-1 ring-inset ring-critical-600/15',
    text: 'text-critical-700',
    rail: 'bg-critical-500',
  },
  high: {
    badge: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/20',
    bar: 'bg-warning-500',
    dot: 'bg-warning-500',
    tile: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/20',
    text: 'text-warning-700',
    rail: 'bg-warning-500',
  },
  medium: {
    badge: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-600/15',
    bar: 'bg-info-500',
    dot: 'bg-info-500',
    tile: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-600/15',
    text: 'text-info-700',
    rail: 'bg-info-500',
  },
  low: {
    badge: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-900/10',
    bar: 'bg-surface-400',
    dot: 'bg-surface-400',
    tile: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-900/10',
    text: 'text-surface-600',
    rail: 'bg-surface-300',
  },
};

/** Hairline-bordered surface. No drop shadow — the border does the work. */
export const card = 'rounded-2xl border border-surface-200 bg-white';

/** Tinted header band that separates a card's title from its content. */
export const cardHeader = 'border-b border-surface-200 bg-surface-50/60';

/** Small uppercase section eyebrow. */
export const eyebrow = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-surface-400';

/** Section heading inside a card. */
export const cardTitle = 'text-[15px] font-semibold tracking-[-0.01em] text-surface-950';

export const statusFromScore = (score: number) =>
  score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 50 ? 'Needs Work' : 'Critical';

export const scoreHex = (score: number) =>
  score >= 90 ? '#16a34a' : score >= 75 ? '#4f46e5' : score >= 50 ? '#ca8a04' : '#dc2626';
