import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>}
        <h2 className="mt-1 text-xl font-bold tracking-tight text-surface-950">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricTile({ label, value, detail, tone = 'neutral' }: { label: string; value: string | number; detail?: string; tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' }) {
  const toneClass = {
    neutral: 'border-surface-200',
    success: 'border-success-200',
    warning: 'border-warning-200',
    critical: 'border-critical-200',
    info: 'border-info-200',
  }[tone];
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-surface-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-surface-950 tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-xs text-surface-500">{detail}</p>}
    </div>
  );
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'critical' | 'info' }) {
  const classes = {
    neutral: 'bg-surface-100 text-surface-700 border-surface-200',
    success: 'bg-success-50 text-success-700 border-success-100',
    warning: 'bg-warning-50 text-warning-700 border-warning-100',
    critical: 'bg-critical-50 text-critical-700 border-critical-100',
    info: 'bg-info-50 text-info-700 border-info-100',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${classes}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}

export function ModuleHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 border-b border-surface-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-surface-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-600">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Drawer({ open, title, eyebrow, onClose, children }: { open: boolean; title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="workflow-drawer-title">
      <button className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Close details" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-surface-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-surface-200 px-6 py-5">
          <div>
            {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>}
            <h2 id="workflow-drawer-title" className="mt-1 text-xl font-bold tracking-tight text-surface-950">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-surface-400 transition hover:bg-surface-100 hover:text-surface-900" aria-label="Close details"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}

export function Button({ children, variant = 'primary', onClick, disabled = false, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  const classes = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-surface-200 bg-white text-surface-700 hover:border-surface-300 hover:bg-surface-50',
    ghost: 'text-surface-600 hover:bg-surface-100 hover:text-surface-950',
    danger: 'border border-critical-100 bg-critical-50 text-critical-700 hover:bg-critical-100',
  }[variant];
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold leading-5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}>{children}</button>;
}
