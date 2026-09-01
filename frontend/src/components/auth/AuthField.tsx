import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** Field-level validation message. Also drives aria-invalid / aria-describedby. */
  error?: string;
  /** Persistent helper text (e.g. password rules) shown when there is no error. */
  hint?: string;
}

/** Labelled text input with accessible error wiring and an optional password reveal toggle. */
export default function AuthField({ label, error, hint, type = 'text', ...inputProps }: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const resolvedType = isPassword && revealed ? 'text' : type;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="auth-field-group">
      <label
        htmlFor={id}
        className="block text-[12.5px] font-semibold tracking-wide text-surface-600 uppercase transition-colors duration-200"
      >
        {label}
      </label>

      <div className="relative mt-2">
        <input
          {...inputProps}
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`auth-input h-12 w-full rounded-xl border bg-white px-4 text-[14.5px] text-surface-900 shadow-sm outline-none transition-all duration-200 placeholder:text-surface-300
            hover:border-surface-300 hover:shadow-[0_2px_10px_-4px_rgba(99,102,241,0.12)]
            focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12),0_4px_20px_-6px_rgba(79,70,229,0.22)]
            disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-400 disabled:hover:border-surface-200 disabled:hover:shadow-none
            ${isPassword ? 'pr-12' : ''}
            ${
              error
                ? 'border-critical-400 focus:border-critical-500 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1),0_4px_16px_-4px_rgba(220,38,38,0.18)]'
                : 'border-surface-200'
            }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-surface-400 transition-all duration-200 hover:bg-surface-100 hover:text-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {revealed
              ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
              : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
          </button>
        )}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="auth-rise mt-2 flex items-center gap-1.5 text-[12px] font-medium text-critical-600"
          style={{ animationDuration: '0.28s' }}
        >
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-critical-500" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-[12px] text-surface-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
