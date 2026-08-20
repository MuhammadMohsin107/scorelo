import { ArrowUpRight, Bot, Clock3, Plug, ShoppingBag, Wrench, type LucideIcon } from 'lucide-react';
import type { Finding, FindingSeverity, ResolutionType } from '../../data/pillars/finding.types';
import { potentialLift } from '../../data/pillars/finding.types';

interface Props {
  findings: Finding[];
  /** Optional section title override. */
  title?: string;
  subtitle?: string;
}

const severityBadge: Record<FindingSeverity, string> = {
  critical: 'bg-critical-50 text-critical-700 ring-1 ring-inset ring-critical-100',
  high: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100',
  medium: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-100',
  low: 'bg-surface-100 text-surface-600 ring-1 ring-inset ring-surface-200',
};

const resolutionMeta: Record<ResolutionType, { icon: LucideIcon; badge: string; cta: string; hint: string }> = {
  Automated: {
    icon: Bot,
    badge: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
    cta: 'bg-brand-600 text-white hover:bg-brand-700',
    hint: 'Scorelo can apply this fix for you',
  },
  Product: {
    icon: ShoppingBag,
    badge: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-100',
    cta: 'border border-surface-200 bg-white text-surface-800 hover:border-brand-300 hover:text-brand-700',
    hint: 'Resolved by installing an app',
  },
  Service: {
    icon: Wrench,
    badge: 'bg-surface-100 text-surface-700 ring-1 ring-inset ring-surface-200',
    cta: 'border border-surface-200 bg-white text-surface-800 hover:border-brand-300 hover:text-brand-700',
    hint: 'Scoped service engagement',
  },
  Integration: {
    icon: Plug,
    badge: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-100',
    cta: 'border border-surface-200 bg-white text-surface-800 hover:border-brand-300 hover:text-brand-700',
    hint: 'Connect a third-party tool',
  },
  Deferred: {
    icon: Clock3,
    badge: 'bg-surface-100 text-surface-500 ring-1 ring-inset ring-surface-200',
    cta: 'border border-surface-200 bg-surface-50 text-surface-400 cursor-not-allowed',
    hint: 'Snoozed — revisit later',
  },
};

/**
 * Audit-engine findings for one sub-pillar: what is wrong, how it gets
 * resolved, what it touches, and how many points fixing it is worth.
 */
export default function PillarFindingList({ findings, title = 'Findings', subtitle }: Props) {
  if (findings.length === 0) return null;
  const lift = potentialLift(findings);
  const automated = findings.filter((f) => f.resolution === 'Automated').length;

  return (
    <section className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)]" aria-labelledby="findings-title">
      <div className="flex flex-col gap-4 border-b border-surface-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">Resolution queue</div>
          <h2 id="findings-title" className="text-lg font-bold tracking-tight text-surface-900">{title}</h2>
          <p className="mt-1 text-xs text-surface-500">
            {subtitle ?? `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} · each one has a clear route to resolution.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-success-100 bg-success-50 px-2.5 py-1.5 font-semibold text-success-700">
            <ArrowUpRight size={13} />
            +{lift} pts potential lift
          </span>
          {automated > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-100 bg-brand-50 px-2.5 py-1.5 font-semibold text-brand-700">
              <Bot size={13} />
              {automated} automated {automated === 1 ? 'fix' : 'fixes'}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-surface-100">
        {findings.map((finding) => {
          const res = resolutionMeta[finding.resolution];
          const ResIcon = res.icon;
          const isDeferred = finding.resolution === 'Deferred';
          return (
            <article key={finding.id} className="px-5 py-5 transition-colors hover:bg-slate-50 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severityBadge[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${res.badge}`} title={res.hint}>
                      <ResIcon size={11} />
                      {finding.resolution}
                    </span>
                    {finding.resolvedBy && (
                      <span className="text-[11px] text-surface-500">
                        via <span className="font-medium text-surface-700">{finding.resolvedBy}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-surface-900">{finding.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-surface-600">{finding.problem}</p>
                  <p className="mt-1.5 text-xs leading-5 text-surface-500">
                    <span className="font-semibold text-surface-700">Why it matters:</span> {finding.impact}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500">
                    <span>
                      <span className="font-semibold tabular-nums text-surface-800">{finding.affected.toLocaleString()}</span> {finding.affectedLabel} affected
                    </span>
                    <span>
                      Score lift <span className="font-semibold tabular-nums text-success-700">+{finding.scoreLift} pts</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2 lg:flex-col lg:items-end">
                  <button
                    type="button"
                    disabled={isDeferred}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${res.cta}`}
                  >
                    {finding.ctaLabel}
                    {!isDeferred && <ArrowUpRight size={13} />}
                  </button>
                  {finding.resolution === 'Automated' && finding.affected > 1 && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                    >
                      Bulk fix all {finding.affected.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
