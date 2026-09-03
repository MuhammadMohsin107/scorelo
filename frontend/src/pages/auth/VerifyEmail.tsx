import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailWarning } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import OtpInput from '../../components/auth/OtpInput';
import { resendVerification, verifyEmail } from '../../data/auth.repository';
import { ApiError } from '../../lib/api';

/** Matches the backend's resend limit (3 per 15 minutes) with room to spare, so the button
 * discourages the request that would be refused rather than firing it and showing a 429. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Confirms that the customer controls the address they signed up with.
 *
 * This is NOT a second authentication factor and does not sign anyone in — the backend issues no
 * session here, so a code read out of an inbox can never substitute for the password. On success
 * the customer goes to sign in normally.
 *
 * The address arrives via router state (from signup) or the query string (from a link or a
 * refresh). Nothing about verification is kept in storage: the server owns that state, and the
 * only thing this page can do is ask it.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const routeState = location.state as { email?: string; verificationSent?: boolean } | null;
  const email = routeState?.email ?? searchParams.get('email') ?? '';
  const deliveryFailed = routeState?.verificationSent === false;

  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit() {
    if (code.length !== 6 || pending) return;
    setFormError('');
    setNotice('');
    setPending(true);
    try {
      await verifyEmail(email, code);
      setDone(true);
    } catch (error) {
      // The backend answers invalid, expired, already-used and attempts-exhausted with one
      // identical 400 — that uniformity is the point, and its wording is safe to show as-is.
      // 429 carries its own message from the rate limiter. Anything else stays generic.
      setFormError(
        error instanceof ApiError && (error.status === 400 || error.status === 429)
          ? error.message
          : 'We could not verify that code right now. Please try again.',
      );
      setCode('');
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setFormError('');
    setNotice('');
    setResending(true);
    try {
      const message = await resendVerification(email);
      setNotice(message);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 429
          ? error.message
          : 'We could not send a new code right now. Please try again shortly.',
      );
    } finally {
      setResending(false);
    }
  }

  // Reaching this page without an address means the flow was entered sideways — a bookmark, or a
  // refresh that dropped router state. Say so rather than presenting a form guaranteed to fail.
  if (!email) {
    return (
      <AuthLayout
        title="Verification link incomplete"
        subtitle="We do not know which address to verify."
        footer={
          <Link
            to="/login"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Back to sign in
          </Link>
        }
      >
        <AuthAlert message="Sign in to continue — we will send a new code if your address still needs verifying." />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Email verified"
        subtitle="Your address is confirmed. Sign in to continue."
        footer={null}
      >
        <div className="flex flex-col items-center rounded-xl border border-surface-200 bg-surface-50/60 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50 text-success-700">
            <CheckCircle2 size={22} />
          </span>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            Thanks — we know this address belongs to you.
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
      footer={
        <>
          Wrong address?{' '}
          <Link
            to="/signup"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Start again
          </Link>
        </>
      }
    >
      {/* An honest signal, not an error: the account exists, the code did not get out. Saying so
          is what makes the Resend button below a fix rather than a guess. */}
      {deliveryFailed && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-100 bg-warning-50 p-3.5">
          <MailWarning size={16} className="mt-0.5 flex-shrink-0 text-warning-600" aria-hidden="true" />
          <p className="text-sm leading-6 text-warning-800">
            Your account was created, but we could not send the code. Use <strong>Send a new code</strong> below.
          </p>
        </div>
      )}

      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void submit();
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
          label="Verification code"
          value={code}
          onChange={setCode}
          onComplete={() => void submit()}
          disabled={pending}
          invalid={Boolean(formError)}
          autoFocus
        />

        <p className="mt-3 text-xs leading-5 text-surface-500">
          The code expires 10 minutes after it was sent and can be used once.
        </p>

        <div className="mt-6">
          {/* AuthSubmitButton disables itself while pending; an incomplete code is guarded in
              submit() rather than by disabling, so the button never looks inert mid-typing. */}
          <AuthSubmitButton pending={pending} pendingLabel="Verifying…">
            Verify email
          </AuthSubmitButton>
        </div>
      </form>

      <div className="mt-5 border-t border-surface-200 pt-5 text-center">
        <p className="text-sm text-surface-600">Did not get it? Check your spam folder.</p>
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={resending || cooldown > 0}
          className="mt-2 cursor-pointer rounded text-sm font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-surface-400 disabled:no-underline"
        >
          {resending
            ? 'Sending…'
            : cooldown > 0
              ? `Send a new code (${cooldown}s)`
              : 'Send a new code'}
        </button>
        <p className="mt-3 text-xs text-surface-500">
          Already verified?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="cursor-pointer rounded font-semibold text-brand-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
