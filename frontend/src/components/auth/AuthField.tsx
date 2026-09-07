import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** Field-level validation message. Also drives aria-invalid / aria-describedby. */
  error?: string;
  /** Persistent helper text (e.g. password rules) shown when there is no error. */
  hint?: string;
  /** Leading icon inside the pill. Decorative — the label carries the meaning, so it is
   * aria-hidden and the input keeps its full accessible name without it. */
  icon?: LucideIcon;
}

/**
 * Labelled pill input with accessible error wiring, an optional leading icon, and a password
 * reveal toggle.
 *
 * FILLED, NOT OUTLINED. The field is a tinted well (`bg-surface-50`) on the sheet (`surface-0`):
 * one step darker than the sheet in dark mode, a light grey well in light mode. That is how an
 * inset field is expressed in both themes without a hard border doing the work — the border here
 * is a faint hairline that only becomes visible as a state (hover, focus, error).
 *
 * Focus uses the shell's `--auth-accent` / `--auth-ring` rather than the app's brand token, so
 * the fields match the title, links and button around them.
 */
export default function AuthField({ label, error, hint, icon: Icon, type = 'text', ...inputProps }: AuthFieldProps) {
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
        className="block text-[12px] font-semibold uppercase tracking-wide text-surface-600 transition-colors duration-200"
      >
        {label}
      </label>

      {/* h-11 (44px) is the WCAG 2.5.5 minimum touch target, and the floor here. */}
      <div className="relative mt-1.5">
        {Icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}

        <input
          {...inputProps}
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`auth-input h-11 w-full rounded-full border bg-surface-50 text-[14px] text-surface-900 outline-none transition-all duration-200 placeholder:text-surface-400
            ${Icon ? 'pl-11' : 'pl-5'} ${isPassword ? 'pr-12' : 'pr-5'}
            focus:bg-surface-0 focus:shadow-[0_0_0_3px_var(--auth-ring)]
            disabled:cursor-not-allowed disabled:text-surface-400 disabled:hover:border-surface-200
            ${
              error
                ? 'border-critical-400 focus:border-critical-500 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
                : 'border-surface-200/80 hover:border-surface-300 focus:border-[color:var(--auth-accent)]'
            }`}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-surface-400 transition-all duration-200 hover:bg-surface-100 hover:text-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--auth-accent)]"
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
          className="auth-rise mt-1.5 flex items-center gap-1.5 pl-1 text-[12px] font-medium text-critical-600"
          style={{ animationDuration: '0.28s' }}
        >
          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-critical-500" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 pl-1 text-[12px] text-surface-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
