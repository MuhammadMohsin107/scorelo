import type { ReactNode } from 'react';
import { Search, FileText, Zap, Target, Sparkles, ShieldCheck } from 'lucide-react';
import ScoreloLogo from '../components/auth/ScoreloLogo';

// The five pillars Scorelo actually audits — the same set as pillarMeta.ts. This is static
// brand/marketing copy, not business data, so it is legitimately hard-coded here.
const pillars = [
  { icon: <Search size={15} strokeWidth={2.2} />, label: 'SEO', hint: 'Titles, schema, canonicals, sitemaps' },
  { icon: <FileText size={15} strokeWidth={2.2} />, label: 'Content', hint: 'Descriptions, metafields, duplication' },
  { icon: <Zap size={15} strokeWidth={2.2} />, label: 'Speed', hint: 'Core Web Vitals and page weight' },
  { icon: <Target size={15} strokeWidth={2.2} />, label: 'CRO', hint: 'Trust, clarity and checkout signals' },
  { icon: <Sparkles size={15} strokeWidth={2.2} />, label: 'AI Discovery', hint: 'Machine-readable product data' },
];

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Rendered under the form — typically the link to the opposite auth page. */
  footer: ReactNode;
}

/**
 * Split-screen authentication shell: a deep-slate brand panel on the left (matching the app
 * sidebar) and the form on the right. The brand panel is decorative, so it is hidden below
 * `lg` rather than stacked — on mobile the form gets the full viewport and its own logo.
 */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid h-full grid-cols-1 overflow-y-auto bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0f172a] px-12 py-12 lg:flex">
        {/* Depth wash — purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#4f46e5] opacity-[0.18] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-[#6366f1] opacity-[0.12] blur-3xl"
        />

        <div className="relative">
          <ScoreloLogo tone="dark" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[30px] font-semibold leading-[1.2] tracking-tight text-white">
            Know exactly what's holding your store back.
          </h2>
          <p className="mt-4 text-[14px] leading-6 text-white/60">
            Scorelo audits your Shopify store across five pillars, then turns every finding into a
            prioritised, evidence-backed fix list.
          </p>

          <ul className="mt-9 space-y-3.5">
            {pillars.map((pillar) => (
              <li key={pillar.label} className="flex items-start gap-3.5">
                <span className="mt-px flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[#a5b4fc]">
                  {pillar.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white/90">{pillar.label}</span>
                  <span className="block text-[12px] leading-5 text-white/45">{pillar.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-[12px] text-white/40">
          <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
          Read-only access. Scorelo never changes your storefront.
        </p>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only logo, since the brand panel is hidden at this width */}
          <div className="mb-9 lg:hidden">
            <ScoreloLogo />
          </div>

          <header>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-surface-950">{title}</h1>
            <p className="mt-2 text-[14px] leading-6 text-surface-500">{subtitle}</p>
          </header>

          <div className="mt-8">{children}</div>

          <div className="mt-7 text-center text-[13px] text-surface-500">{footer}</div>
        </div>
      </main>
    </div>
  );
}
