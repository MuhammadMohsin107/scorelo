import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import OtpInput from '../../components/auth/OtpInput';
import { useAuth } from '../../context/AuthContext';
import { resendTwoFactorCode } from '../../data/auth.repository';
import { ApiError } from '../../lib/api';

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Matches the backend's resend limit with room to spare. */
const RESEND_COOLDOWN_SECONDS = 60;

export default function Login() {
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  // ─── Second factor ──────────────────────────────────────────────────
  // A non-empty ticket means the password step succeeded and the form is now asking for the
  // emailed code. It is held here and nowhere else: never in localStorage, never in the URL. A
  // page refresh loses it and the customer signs in again — the correct outcome for a
  // half-finished authentication, not something to work around.
  const [ticket, setTicket] = useState('');
  const [codeSent, setCodeSent] = useState(true);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

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
      await completeTwoFactorLogin(ticket, code);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // One uniform 401 covers wrong, expired, spent and exhausted — its wording is safe to show.
      setFormError(
        error instanceof ApiError && (error.status === 401 || error.status === 429)
          ? error.message
          : 'We could not verify that code right now. Please try again.',
      );
      setCode('');
    } finally {
      setPending(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0 || resending) return;
    setFormError('');
    setResending(true);
    try {
      setNotice(await resendTwoFactorCode(ticket));
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

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      const result = await login({ email: email.trim(), password });

      // The password was right but the sign-in is not finished. NO session exists yet — the
      // server issued no tokens — so this switches the form to the code step rather than
      // navigating anywhere. The ticket lives only in this component's state.
      if (result.status === 'two-factor') {
        setTicket(result.ticket);
        setCodeSent(result.codeSent);
        setPassword('');
        return;
      }

      // Return the customer to wherever they were headed before the guard intercepted them.
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // An unverified address is not a failed sign-in — the password was correct, the account
      // simply is not confirmed yet. Send the customer to finish that rather than showing an
      // error they cannot act on. The backend has already sent (or will resend) the code; nothing
      // here decides whether they are allowed in, it only routes them to the right screen.
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', { replace: true, state: { email: email.trim().toLowerCase() } });
        return;
      }

      // Show a specific message for the expected failures, but never leak internals. 429 carries
      // its own wording from the rate limiter and is safe to surface as-is.
      setFormError(
        error instanceof ApiError && error.status === 401
          ? 'That email or password is incorrect.'
          : error instanceof ApiError && error.status === 429
            ? error.message
            : 'We could not sign you in right now. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  // ─── Step two: the emailed code ─────────────────────────────────────
  // Replaces the password form rather than sitting beside it, so there is one thing to do. The
  // customer is NOT signed in at this point — no tokens exist until the code is verified.
  if (ticket) {
    return (
      <AuthLayout
        title="Confirm it's you"
        subtitle="Enter the 6-digit code we sent to your email address."
        footer={
          <button
            type="button"
            onClick={() => { setTicket(''); setCode(''); setFormError(''); setNotice(''); }}
            className="cursor-pointer rounded font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Back to sign in
          </button>
        }
      >
        {/* Honest, not an error: the sign-in genuinely paused and the code did not get out. */}
        {!codeSent && (
          <div className="mb-4 rounded-xl border border-warning-100 bg-warning-50 p-3.5">
            <p className="text-sm leading-6 text-warning-800">
              We could not send your code. Use <strong>Send a new code</strong> below.
            </p>
          </div>
        )}

        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submitCode(); }}
          noValidate
        >
          {formError && <AuthAlert message={formError} />}
          {notice && !formError && (
            <div role="status" className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-3.5">
              <p className="text-sm leading-6 text-brand-800">{notice}</p>
            </div>
          )}

          <OtpInput
            label="Sign-in code"
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
            <AuthSubmitButton pending={pending} pendingLabel="Verifying…">
              Verify and sign in
            </AuthSubmitButton>
          </div>
        </form>

        <div className="mt-5 border-t border-surface-200 pt-5 text-center">
          <button
            type="button"
            onClick={() => void handleResendCode()}
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
      title="Sign in to Scorelo"
      subtitle="Welcome back. Enter your details to view your store audits."
      footer={
        <>
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError && <AuthAlert message={formError} />}

        <div className="space-y-4">
          <AuthField
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            disabled={pending}
            required
          />

          <AuthField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            disabled={pending}
            required
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Forgot password?
          </Link>
        </div>

        <div className="mt-4">
          <AuthSubmitButton pending={pending} pendingLabel="Signing in…">
            Sign in
          </AuthSubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
}
