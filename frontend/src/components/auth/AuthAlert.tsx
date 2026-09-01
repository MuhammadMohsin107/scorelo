import { AlertCircle } from 'lucide-react';

/** Form-level error banner. Uses an icon + text (not colour alone) to convey the state. */
export default function AuthAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="auth-rise mb-5 flex items-start gap-2.5 rounded-xl border border-critical-100 bg-critical-50/80 px-3.5 py-3 shadow-[0_2px_8px_-2px_rgba(220,38,38,0.08)] backdrop-blur-sm"
      style={{ animationDuration: '0.35s' }}
    >
      <AlertCircle size={16} strokeWidth={2} className="mt-px flex-shrink-0 text-critical-600" aria-hidden="true" />
      <p className="text-[13px] leading-5 text-critical-700">{message}</p>
    </div>
  );
}
