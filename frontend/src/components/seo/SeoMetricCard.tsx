import { ArrowRight } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  description: string;
  footnote?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function SeoMetricCard({ label, value, description, footnote, ctaLabel, onCta }: Props) {
  return (
    <div className="bg-white border border-surface-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
      <h3 className="text-sm font-semibold text-surface-600 uppercase mb-3">{label}</h3>
      <div className="text-4xl font-bold text-surface-900 mb-2 tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <p className="text-sm text-surface-600 mb-4">{description}</p>
      {footnote && <div className="text-xs text-surface-500 mb-4">{footnote}</div>}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 group"
        >
          {ctaLabel} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
