import type { ReactNode } from 'react';
import ScoreloLogo from '../components/auth/ScoreloLogo';
import AuthScene from '../components/auth/AuthScene';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'default' | 'wide';
}

/**
 * Split-screen authentication shell — Premium 2026 edition.
 *
 * LEFT — a live 3D "Performance Intelligence" scene rendered with React Three
 * Fiber: orbit rings for each audit pillar, pulsing data nodes and energy
 * streams all feeding a central store core. Five pillar badges float below
 * the headline, reinforcing Scorelo's product identity.
 *
 * RIGHT — frosted glass auth card over a softly tinted aurora ground.
 *
 * RESPONSIVE: brand panel hidden below `lg`. Phone sees full-viewport form
 * plus a compact aurora/logo header — no WebGL canvas on mobile.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  width = 'default',
}: AuthLayoutProps) {
  return (
    <div className="grid h-full grid-cols-1 overflow-y-auto bg-[#04070f] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Brand panel ─────────────────────────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden lg:flex" style={{ background: 'linear-gradient(135deg, #04070f 0%, #080d1f 50%, #060b18 100%)' }}>

        {/* Multi-layer aurora wash */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="auth-aurora absolute -left-40 -top-40 h-[38rem] w-[38rem] rounded-full opacity-[0.18] blur-[130px]" style={{ background: 'radial-gradient(circle, #4f46e5 0%, #3730a3 60%, transparent 100%)' }} />
          <div className="auth-aurora auth-aurora-slow absolute -bottom-44 -right-28 h-[32rem] w-[32rem] rounded-full opacity-[0.14] blur-[120px]" style={{ background: 'radial-gradient(circle, #7c3aed 0%, #5b21b6 60%, transparent 100%)' }} />
          <div className="auth-aurora absolute left-1/3 top-1/2 h-[26rem] w-[26rem] rounded-full opacity-[0.07] blur-[130px]" style={{ background: 'radial-gradient(circle, #0ea5e9 0%, #0369a1 60%, transparent 100%)', animationDelay: '-8s' }} />
          <div className="auth-aurora auth-aurora-slow absolute -bottom-24 left-1/4 h-[22rem] w-[22rem] rounded-full opacity-[0.06] blur-[140px]" style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 100%)', animationDelay: '-16s' }} />
        </div>

        {/* Fine noise grain — premium texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />

        {/* Live 3D analytics scene */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[680px] w-[680px] max-w-none opacity-[0.92]">
            <AuthScene />
          </div>
        </div>

        {/* Legibility gradient scrim — bottom-heavy so copy reads on top of 3D */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(to top, #04070f 0%, #04070f 12%, rgba(4,7,15,0.75) 35%, rgba(4,7,15,0.2) 60%, rgba(4,7,15,0.35) 100%)',
          }}
        />

        {/* Top-left logo */}
        <div className="relative px-12 pt-12">
          <ScoreloLogo tone="dark" />
        </div>

        {/* Bottom copy block */}
        <div className="relative px-12 pb-12">
          {/* Headline */}
          <div className="auth-rise" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-[44px] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
              Know exactly what's<br />holding your store back.
            </h2>
            <p className="mt-4 max-w-sm text-[16px] leading-[1.65] text-white/50">
              Scorelo audits your Shopify store across five pillars, then turns
              every finding into a prioritised, evidence-backed fix list.
            </p>
          </div>

        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <main className="relative flex items-center justify-center overflow-y-auto bg-surface-50 px-5 py-10 sm:px-8 lg:px-14">
        {/* Subtle tinted ambient blobs for the form side */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="auth-aurora absolute -right-20 -top-16 h-72 w-72 rounded-full bg-indigo-100 opacity-70 blur-[90px]" />
          <div className="auth-aurora auth-aurora-slow absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-violet-100 opacity-60 blur-[90px]" />
          <div className="auth-aurora absolute bottom-1/3 right-1/3 h-48 w-48 rounded-full bg-sky-100 opacity-40 blur-[80px]" style={{ animationDelay: '-6s' }} />
        </div>

        {/* Very faint dot grid for depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />

        <div className={`auth-rise relative w-full ${width === 'wide' ? 'max-w-[480px]' : 'max-w-[428px]'}`}>

          {/* Mobile-only logo */}
          <div className="mb-8 flex flex-col items-center gap-4 lg:hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2">
              <div className="auth-aurora h-44 w-44 rounded-full bg-brand-300 opacity-30 blur-[70px]" />
            </div>
            <ScoreloLogo />
          </div>

          {/* Auth card */}
          <div className="auth-card rounded-2xl p-8 sm:p-9">
            <header>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-surface-950">
                {title}
              </h1>
              <p className="mt-2.5 text-[14.5px] leading-[1.6] text-surface-500">{subtitle}</p>
            </header>

            <div className="mt-8">{children}</div>
          </div>

          {footer && (
            <div className="mt-5 text-center text-[13px] text-surface-500">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
