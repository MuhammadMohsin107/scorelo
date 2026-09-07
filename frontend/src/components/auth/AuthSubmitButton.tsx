import { Loader2 } from 'lucide-react';

interface AuthSubmitButtonProps {
  pending: boolean;
  pendingLabel: string;
  children: string;
}

/**
 * Pill submit button on the shell's two-stop gradient (`--auth-btn-from` → `--auth-btn-to`).
 *
 * The gradient is NOT theme-inverted, unlike the accent used for text: it is the one saturated
 * surface in the card and its label is white, so lifting it in dark mode would push the label
 * below readable contrast. Both stops are chosen dark enough for white type at 14.5px semibold.
 */
export default function AuthSubmitButton({ pending, pendingLabel, children }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="auth-submit-btn group relative inline-flex h-11 w-full items-center justify-center gap-2.5 overflow-hidden rounded-full text-[14.5px] font-semibold text-white transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--auth-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0"
      style={{
        background: 'linear-gradient(90deg, var(--auth-btn-from) 0%, var(--auth-btn-to) 100%)',
        boxShadow: '0 10px 24px -10px var(--auth-btn-glow), inset 0 1px 0 rgba(255,255,255,0.18)',
      }}
    >
      {/* Sheen sweep on hover */}
      <span aria-hidden="true" className="auth-btn-sheen pointer-events-none absolute inset-0 rounded-full" />

      {pending && (
        <Loader2 size={17} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      <span className="relative">{pending ? pendingLabel : children}</span>
    </button>
  );
}
