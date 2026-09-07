import type { ReactNode } from 'react';
import ScoreloLogo from '../components/auth/ScoreloLogo';

interface AuthLayoutProps {
  title: string;
  /** Optional. Omitted — or empty — renders NO element, rather than an empty <p> that still
   * claims its top margin and a line box. */
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'default' | 'wide';
}

/**
 * ─── Floating-card authentication shell ──────────────────────────────────────
 *
 * One card, centred on a solid coloured page, split in two:
 *
 *   LEFT  — a gradient brand panel: logo, a welcome, one sentence, and a cluster of diagonal
 *           light streaks rising from the bottom-left corner.
 *   RIGHT — the form on a clean sheet.
 *
 * Every colour that belongs to this shell — the page, the panel gradient, the accent used for
 * the title, links and focus rings, the button gradient — is a `--auth-*` custom property set
 * by `.auth-shell` in index.css, with dark-mode overrides in the same place as every other
 * token. Nothing here names a hex, so re-skinning the auth pages is a one-block change.
 *
 * The right sheet uses the app's surface tokens, so it is white in light mode and the raised
 * dark sheet in dark mode while the page and the brand panel stay as designed — they are brand
 * colour, not theme colour.
 *
 * DELIBERATELY NOT HERE: pillar names, check counts, invented testimonials or customer numbers.
 * The one sentence on the panel is true of the product as built.
 *
 * RESPONSIVE: below `lg` the brand panel is hidden, the logo moves above the card, and the sheet
 * takes the full card width.
 */

/** Decorative streaks. Each row is one pill: where it sits inside the rotated cluster, how big
 * it is, and which of the two gradients it takes. Hand-placed — a formula gives an even fan,
 * which reads as a chart; this reads as light. */
const STREAKS: { left: number; top: number; width: number; height: number; tone: 'a' | 'b'; opacity: number }[] = [
  { left: -30, top: 30, width: 300, height: 40, tone: 'a', opacity: 1 },
  { left: 130, top: 88, width: 330, height: 46, tone: 'b', opacity: 0.95 },
  { left: 20, top: 156, width: 240, height: 34, tone: 'a', opacity: 0.9 },
  { left: 220, top: 208, width: 280, height: 42, tone: 'b', opacity: 0.85 },
  { left: -40, top: 250, width: 190, height: 28, tone: 'a', opacity: 0.8 },
  { left: 150, top: 300, width: 220, height: 32, tone: 'b', opacity: 0.7 },
];

const STREAK_TONES = {
  a: 'linear-gradient(90deg, var(--auth-streak-a-from) 0%, var(--auth-streak-a-to) 100%)',
  b: 'linear-gradient(90deg, var(--auth-streak-b-from) 0%, var(--auth-streak-b-to) 100%)',
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  width = 'default',
}: AuthLayoutProps) {
  return (
    <div className="auth-shell h-full overflow-y-auto" style={{ background: 'var(--auth-page)' }}>
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className={`w-full ${width === 'wide' ? 'max-w-[1080px]' : 'max-w-[1000px]'}`}>
          {/* Mobile-only logo — the brand panel is hidden below lg. */}
          <div className="mb-6 flex justify-center lg:hidden">
            <ScoreloLogo tone="dark" />
          </div>

          {/* ── The card ─────────────────────────────────────────────────── */}
          <div className="auth-rise auth-card grid overflow-hidden rounded-2xl lg:grid-cols-[1.06fr_1fr]">
            {/* Brand panel */}
            <aside
              className="relative hidden flex-col justify-between overflow-hidden p-11 lg:flex"
              style={{ background: 'var(--auth-panel)' }}
            >
              <div className="relative z-10">
                <ScoreloLogo tone="dark" />
              </div>

              <div className="relative z-10 max-w-sm pb-28">
                <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.025em] text-white">
                  Welcome to Scorelo
                </h2>
                <p className="mt-4 text-[14.5px] leading-[1.7] text-white/75">
                  Know exactly what&apos;s holding your store back. Connect your Shopify store
                  with read-only access — nothing is ever modified — and see what to fix first.
                </p>
              </div>

              {/* Streak cluster. The wrapper is rotated as a whole so every pill shares one
                  angle, and it floats a few pixels on a slow loop — the only motion on the page.
                  Sized larger than the corner it lives in and clipped by the panel, so the pills
                  run off the edges the way light does rather than ending inside the frame. */}
              <div
                aria-hidden="true"
                className="auth-float pointer-events-none absolute -bottom-10 -left-16 h-[380px] w-[560px]"
              >
                {STREAKS.map((streak, index) => (
                  <span
                    key={index}
                    className="absolute rounded-full"
                    style={{
                      left: streak.left,
                      top: streak.top,
                      width: streak.width,
                      height: streak.height,
                      opacity: streak.opacity,
                      background: STREAK_TONES[streak.tone],
                      boxShadow: '0 12px 30px -12px rgba(0,0,0,0.35)',
                    }}
                  />
                ))}
                {/* Two loose dots, as in a burst that has thrown off a little light. */}
                <span className="absolute left-[330px] top-[150px] h-3 w-3 rounded-full bg-white/70" />
                <span className="absolute left-[90px] top-[340px] h-2.5 w-2.5 rounded-full bg-white/55" />
              </div>
            </aside>

            {/* Form sheet. `auth-sheet` pins it to the light surface ramp in every theme (see
                index.css) — the card is a designed object, and its white half is part of the
                design. `[&_a]` overrides recolour the links each page brings with it (Forgot
                password, etc.) to this shell's accent, so pages need not know the palette. */}
            <main className="auth-sheet bg-surface-0 px-7 py-9 sm:px-10 sm:py-11 [&_a]:text-[color:var(--auth-accent)] [&_a:hover]:text-[color:var(--auth-accent-hover)]">
              <header className="text-center">
                <h1 className="text-[13px] font-bold uppercase tracking-[0.22em] text-[color:var(--auth-accent)]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mx-auto mt-2.5 max-w-xs text-[13.5px] leading-[1.55] text-surface-500">{subtitle}</p>
                )}
              </header>

              <div className="mt-7">{children}</div>
            </main>
          </div>

          {footer && (
            <div className="mt-6 text-center text-[13px] text-white/75 [&_a]:font-semibold [&_a]:text-white [&_a:hover]:text-white/85">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
