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
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-surface-700">
        {label}
      </label>

      <div className="relative mt-1.5">
        <input
          {...inputProps}
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-[14px] text-surface-900 shadow-sm outline-none transition-colors placeholder:text-surface-400
            focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
            disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-400
            ${isPassword ? 'pr-11' : ''}
            ${error ? 'border-critical-300 focus:border-critical-500 focus:ring-critical-500/20' : 'border-surface-200'}`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            // Label rather than icon-only, so screen readers announce the action and its state.
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-surface-400 transition-colors hover:text-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {revealed ? <EyeOff size={16} strokeWidth={2} aria-hidden="true" /> : <Eye size={16} strokeWidth={2} aria-hidden="true" />}
          </button>
        )}
      </div>

      {error ? (
        // role="alert" so the message is announced the moment validation fails.
        <p id={errorId} role="alert" className="mt-1.5 text-[12px] font-medium text-critical-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-surface-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
