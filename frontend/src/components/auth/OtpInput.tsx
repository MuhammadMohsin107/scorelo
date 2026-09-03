import { useEffect, useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired once the final digit lands, so the form can submit without a second click. */
  onComplete?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  describedBy?: string;
  autoFocus?: boolean;
}

const LENGTH = 6;

/**
 * Six-box entry for a one-time code, shared by email verification and password reset.
 *
 * WHY BOXES RATHER THAN ONE FIELD: a code arrives as six digits read off a screen, and a single
 * text input gives no feedback about how many have landed. The trade-off is that boxes are easy
 * to build badly — so the behaviours people actually rely on are handled explicitly here:
 *
 *   · pasting the whole code fills every box, however the customer pastes it
 *   · Backspace in an empty box steps back rather than doing nothing
 *   · arrow keys move between boxes
 *   · non-digits never enter the value at all
 *   · the value is one contiguous string, so the form submits six characters, not an array
 *
 * The rendered value carries no security weight. The code is verified server-side against a
 * bcrypt hash with an attempt budget; this component is a keypad, not a guard.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  label,
  describedBy,
  autoFocus = false,
}: OtpInputProps) {
  const groupId = useId();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.();
  };

  const focusBox = (index: number) => {
    inputs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();
  };

  const handleInput = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    // Typing into the middle replaces from that point rather than inserting, which is what a
    // fixed-width code behaves like. Multi-character input (autofill, a fast paste into one box)
    // spills forward instead of being truncated to one digit.
    const chars = value.split('');
    for (let offset = 0; offset < typed.length && index + offset < LENGTH; offset++) {
      chars[index + offset] = typed[offset];
    }
    const next = chars.join('').slice(0, LENGTH);
    commit(next);
    focusBox(index + typed.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const chars = value.split('');
      if (chars[index]) {
        // Clear this box and stay put — one press, one digit removed.
        chars[index] = '';
        commit(chars.join('').replace(/\s/g, ''));
      } else if (index > 0) {
        chars[index - 1] = '';
        commit(chars.join('').replace(/\s/g, ''));
        focusBox(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    // Codes get pasted with spaces, dashes or a trailing newline depending on where they were
    // copied from. Strip to digits and take the first six.
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    commit(pasted);
    focusBox(pasted.length);
  };

  return (
    <div role="group" aria-labelledby={`${groupId}-label`} aria-describedby={describedBy}>
      <span id={`${groupId}-label`} className="mb-2 block text-sm font-semibold text-surface-800">
        {label}
      </span>
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { inputs.current[index] = element; }}
            // 'tel' rather than 'number': it brings up a numeric keypad on mobile without the
            // spinner, scroll-to-change and locale quirks a number input drags along.
            type="tel"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            value={digit.trim()}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            onChange={(event) => handleInput(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            className={`h-14 w-full min-w-0 rounded-xl border bg-surface-0 text-center text-xl font-bold tabular-nums text-surface-900 outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:text-surface-400 ${
              invalid
                ? 'border-critical-300 focus:border-critical-500 focus:ring-critical-100'
                : 'border-surface-200 focus:border-brand-400 focus:ring-brand-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
