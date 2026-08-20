import { ArrowRight } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  description: string;
  footnote?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/** Shared stat card used in the left column of every pillar sub-page. */
export default function PillarMetricCard({ label, value, description, footnote, ctaLabel, onCta }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-surface-200 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_14px_30px_-20px_rgba(79,70,229,0.35)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-cyan-400 opacity-80" />
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-surface-500">{label}</h3>
      <div className="mb-2 text-4xl font-bold tracking-tight text-surface-900 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <p className="mb-4 text-sm leading-5 text-surface-600">{description}</p>
      {footnote && <div className="mb-4 text-xs text-surface-500">{footnote}</div>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="flex items-center gap-1 text-sm font-bold text-brand-600 transition-colors hover:text-brand-700"
        >
          {ctaLabel} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}
