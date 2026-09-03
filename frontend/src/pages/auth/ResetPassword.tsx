import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import OtpInput from '../../components/auth/OtpInput';
import { requestPasswordReset, resetPassword, verifyResetCode } from '../../data/auth.repository';
import { ApiError } from '../../lib/api';

/** Mirrors the backend policy in auth.schema.ts. Client-side validation is a convenience only —
 * the server enforces the same rule, so a request that skips this page cannot set a weak one. */
const MIN_PASSWORD_LENGTH = 8;

/** Matches the backend's forgot-password limit with room to spare. */
const RESEND_COOLDOWN_SECONDS = 60;

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Step 2 of password recovery.
 *
 * TWO CREDENTIALS, NOT ONE. The emailed six-digit code only proves the customer read the inbox;
 * exchanging it yields a high-entropy, single-use ticket, and that is what actually authorises the
 * change. A number a person can type is never the thing that sets a password.
 *
 * The ticket lives in component state for the length of the flow and is never written to storage,
 * never rendered and never logged. A refresh loses it, which is correct — the customer re-enters a
 * fresh code rather than the browser holding a reusable credential.
 *
 * The legacy `?token=` link from before this flow is still honoured, unchanged, so links already
 * sitting in inboxes keep working for one release.
 */
export default function ResetPassword() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const legacyToken = searchParams.get('token') ?? '';
  const emailFromState = (location.state as { email?: string } | null)?.email ?? '';
  const [email] = useState(emailFromState || searchParams.get('email') || '');

  // A legacy link arrives already verified by its own token, so it skips straight to the password.
  const [ticket, setTicket] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [done, setDone] = useState(false);

  const stage: 'code' | 'password' = legacyToken || ticket ? 'password' : 'code';

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submitCode() {
    if (code.length !== 6 || pending) return;
    setFormError('');
    setNotice('');
    setPending(true);
    try {
      setTicket(await verifyResetCode(email, code));
    } catch (error) {
      // One identical 400 covers invalid, expired, already-used and attempts-exhausted — that
      // uniformity is deliberate, and its wording is safe to show as-is.
      setFormError(
        error instanceof ApiError && (error.status === 400 || error.status === 429)
          ? error.message
          : 'We could not check that code right now. Please try again.',
      );
      setCode('');
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !email) return;
    setFormError('');
    setNotice('');
    setResending(true);
    try {
      await requestPasswordReset(email);
      setNotice('If an account exists for that address, a new code is on its way.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setFormError('We could not send a new code right now. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!password) errors.password = 'Choose a new password.';
    else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (!confirmPassword) errors.confirmPassword = 'Re-enter your new password.';
    else if (password && confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
    return errors;
  }

  async function submitPassword() {
    setFormError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      // Exactly one credential goes with the request — the backend rejects a body carrying both.
      const credential = ticket ? { ticket } : { token: legacyToken };
      await resetPassword({ ...credential, password, confirmPassword });
      setDone(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError && (error.status === 400 || error.status === 429)
          ? error.message
          : 'We could not reset your password right now. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  // No address and no legacy token means the flow was entered sideways — a bookmark, or a refresh
  // that dropped router state. Say so rather than presenting a form guaranteed to fail.
  if (!email && !legacyToken) {
    return (
      <AuthLayout
        title="Reset link not valid"
        subtitle="We do not know which account to reset."
        footer={
          <Link
            to="/forgot-password"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Start again
          </Link>
        }
      >
        <AuthAlert message="Request a new code from the forgot-password page." />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Your password has been changed. Sign in with your new password to continue."
        footer={
          <>
            Need help?{' '}
            <Link
              to="/forgot-password"
              className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
            >
              Start again
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center rounded-xl border border-surface-200 bg-surface-50/60 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-700">
            <CheckCircle2 size={22} />
          </span>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            For your security, any other devices signed in to this account have been signed out.
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (stage === 'code') {
    return (
      <AuthLayout
        title="Enter your code"
        // Deliberately makes no claim that an account exists — the same reticence the
        // forgot-password response carries. "If an account exists" is the whole guarantee.
        subtitle={`If an account exists for ${email}, we have sent it a 6-digit code.`}
        footer={
          <>
            Remembered it?{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
            >
              Back to sign in
            </Link>
          </>
        }
      >
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submitCode();
          }}
          noValidate
        >
          {formError && <AuthAlert message={formError} />}
          {notice && !formError && (
            <div role="status" className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
              <p className="text-sm leading-6 text-brand-800">{notice}</p>
            </div>
          )}

          <OtpInput
            label="Reset code"
            value={code}
            onChange={setCode}
            onComplete={() => void submitCode()}
            disabled={pending}
            invalid={Boolean(formError)}
            autoFocus
          />

          <p className="mt-3 text-xs leading-5 text-surface-500">
            The code expires 10 minutes after it was sent and can be used once.
          </p>

          <div className="mt-6">
            <AuthSubmitButton pending={pending} pendingLabel="Checking…">
              Continue
            </AuthSubmitButton>
          </div>
        </form>

        <div className="mt-5 border-t border-surface-200 pt-5 text-center">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || cooldown > 0}
            className="cursor-pointer rounded text-sm font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-surface-400 disabled:no-underline"
          >
            {resending ? 'Sending…' : cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your Scorelo account."
      footer={
        <>
          Changed your mind?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void submitPassword();
        }}
        noValidate
      >
        {formError && <AuthAlert message={formError} />}

        <div className="space-y-4">
          <AuthField
            label="New password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={pending}
            required
          />

          <AuthField
            label="Confirm new password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={pending}
            required
          />
        </div>

        <div className="mt-6">
          <AuthSubmitButton pending={pending} pendingLabel="Updating…">
            Reset password
          </AuthSubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
}
