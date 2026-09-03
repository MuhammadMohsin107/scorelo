import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Optional clarifying text below the label, e.g. what the choice actually does. */
  hint?: ReactNode;
  disabled?: boolean;
}

/**
 * Deliberately styled checkbox that is still a REAL <input type="checkbox">.
 *
 * The native input stays in the accessibility tree (`sr-only`, not `hidden`) rather than being
 * replaced by a div with role="checkbox": that keeps space-to-toggle, form participation, focus
 * order and every assistive-tech behaviour for free. The visible box is driven entirely by
 * `peer-*` state, so the two can never disagree.
 *
 * Both the box and the label text live INSIDE the <label>. An earlier arrangement had the box as
 * a sibling, which meant the thing that looks like the checkbox was the one part of the control
 * that did not respond to a click — the visible span sits over the 1px input and swallowed the
 * event. The hint stays outside the label so it describes the control without becoming part of
 * its accessible name.
 */
export default function AuthCheckbox({ checked, onChange, label, hint, disabled }: AuthCheckboxProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label
        htmlFor={id}
        className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span className="relative flex h-5 flex-shrink-0 items-center">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={hint ? hintId : undefined}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-surface-300 bg-surface-0 text-white shadow-sm transition-colors
              peer-checked:border-brand-600 peer-checked:bg-brand-600
              peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2
              peer-disabled:bg-surface-100"
          >
            <Check size={12} strokeWidth={3} className={`transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`} />
          </span>
        </span>

        <span className="min-w-0 text-[13px] font-medium leading-5 text-surface-700">{label}</span>
      </label>

      {hint && (
        // Indented to line up with the label text: 18px box + 12px gap.
        <p id={hintId} className="mt-1 pl-[30px] text-[12px] leading-5 text-surface-500">
          {hint}
        </p>
      )}
    </div>
  );
}
