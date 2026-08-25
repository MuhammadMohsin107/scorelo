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
      // aria-busy lets assistive tech announce the in-flight state; the label text changes too,
      // so the state is never communicated by the spinner alone.
      aria-busy={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 size={16} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
