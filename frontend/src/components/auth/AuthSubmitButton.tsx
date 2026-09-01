import { Loader2 } from 'lucide-react';

interface AuthSubmitButtonProps {
  pending: boolean;
  pendingLabel: string;
  children: string;
}

export default function AuthSubmitButton({ pending, pendingLabel, children }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="auth-submit-btn group relative inline-flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl text-[15px] font-semibold text-white transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0"
      style={{
        background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 55%, #4338ca 100%)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.08), 0 0 0 1px rgba(79,70,229,0.18), inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 32px -8px rgba(79,70,229,0.52)',
      }}
    >
      {/* Top inner highlight edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      {/* Sheen sweep on hover */}
      <span
        aria-hidden="true"
        className="auth-btn-sheen pointer-events-none absolute inset-0 rounded-xl"
      />

      {pending && (
        <Loader2
          size={17}
          strokeWidth={2.5}
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      <span className="relative">{pending ? pendingLabel : children}</span>
    </button>
  );
}
