import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, Mail } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import OtpInput from '../../components/auth/OtpInput';
import { useAuth } from '../../context/AuthContext';
import { resendTwoFactorCode, sendTwoFactorCode } from '../../data/auth.repository';
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
  // A non-empty ticket means the password step succeeded. It is held here and nowhere else: never
  // in localStorage, never in the URL. A page refresh loses it and the customer signs in again —
  // the correct outcome for a half-finished authentication, not something to work around.
  //
  // THREE STEPS, because no code is sent until the customer confirms where it should go:
  //   'password' → 'confirm-email' → 'code'
  const [step, setStep] = useState<'password' | 'confirm-email' | 'code'>('password');
  const [ticket, setTicket] = useState('');
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [codeSent, setCodeSent] = useState(true);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // ─── Recovery codes ─────────────────────────────────────────────────
  // The way in when the inbox itself is unreachable — which is the failure mode email 2FA has and
  // an authenticator app does not. Offered on the code step rather than as a separate screen, so a
  // customer who has just discovered they cannot read their mail does not have to go looking.
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /**
   * Step 2a: confirm the address, and the server sends the code.
   *
   * The field is prefilled with what was typed at the password step, so for almost everyone this is
   * one click. It is still a real check — the server compares it against the account's registered
   * address and mails that row, never this value.
   */
  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingCode || !twoFactorEmail.trim()) return;
    setFormError('');
    setNotice('');
    setSendingCode(true);
    try {
      const sent = await sendTwoFactorCode(ticket, twoFactorEmail.trim());
      setCodeSent(sent);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      // 400 is the address not matching the account — specific, actionable, and safe to show to a
      // caller who has already passed the password step. 401 means the ticket died; send them back
      // rather than leaving them on a step that can no longer succeed.
      if (error instanceof ApiError && error.status === 401) {
        resetToPassword('Your sign-in timed out. Please enter your password again.');
        return;
      }
      setFormError(
        error instanceof ApiError && (error.status === 400 || error.status === 429)
          ? error.message
          : 'We could not send your code right now. Please try again.',
      );
    } finally {
      setSendingCode(false);
    }
  }

  /** Drops every trace of the half-finished sign-in and returns to the password form. */
  function resetToPassword(message = '') {
    setStep('password');
    setTicket('');
    setCode('');
    setRecoveryCode('');
    setUseRecoveryCode(false);
    setNotice('');
    setPassword('');
    setFormError(message);
  }

  async function submitCode() {
    const credential = useRecoveryCode
      ? { recoveryCode: recoveryCode.trim() }
      : { code };
    const ready = useRecoveryCode ? recoveryCode.trim().length > 0 : code.length === 6;
    if (!ready || pending) return;

    setFormError('');
    setNotice('');
    setPending(true);
    try {
      await completeTwoFactorLogin(ticket, credential);
      // Return the customer to wherever they were headed before the guard intercepted them. How
      // many recovery codes remain is shown on Settings → Security, which reads the live count —
      // rather than carried through navigation state that a refresh would drop anyway.
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // One uniform 401 covers wrong, expired, spent and exhausted, for both credential kinds.
        setFormError(
          useRecoveryCode
            ? 'That recovery code is not valid, or it has already been used.'
            : error.message,
        );
      } else {
        setFormError(
          error instanceof ApiError && error.status === 429
            ? error.message
            : 'We could not verify that right now. Please try again.',
        );
      }
      // A spent ticket cannot be retried, so clear the input rather than inviting a second attempt
      // against a credential the server has already consumed.
      setCode('');
      setRecoveryCode('');
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

      // The password was right but the sign-in is not finished. NO session exists yet — the server
      // issued no tokens and has NOT sent a code — so this switches the form to the address
      // confirmation step rather than navigating anywhere. The ticket lives only in this
      // component's state.
      if (result.status === 'two-factor') {
        setTicket(result.ticket);
        // Prefilled with what was just typed, so confirming is one click for anyone signing in
        // normally. It is still checked server-side against the account.
        setTwoFactorEmail(email.trim());
        setStep('confirm-email');
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

  // ─── Step 2a: where the code should go ──────────────────────────────
  // Replaces the password form rather than sitting beside it, so there is one thing to do. The
  // customer is NOT signed in at this point — no tokens exist, and no code has been sent yet.
  //
  // The field is prefilled from the password step, so for a normal sign-in this is one click. It is
  // a CONFIRMATION, not a choice: the server checks it against the account's own address and mails
  // that row. Typing someone else's address here sends nothing anywhere.
  if (step === 'confirm-email') {
    return (
      <AuthLayout
        title="Confirm it's you"
        subtitle="We'll send a 6-digit sign-in code to your email address."
        footer={
          <button
            type="button"
            onClick={() => resetToPassword()}
            className="cursor-pointer rounded font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Back to sign in
          </button>
        }
      >
        <form onSubmit={submitEmail} noValidate>
          {formError && <AuthAlert message={formError} />}

          <AuthField
            label="Email address"
            type="email"
            name="twoFactorEmail"
            autoComplete="email"
            placeholder="you@company.com"
            icon={Mail}
            value={twoFactorEmail}
            onChange={(event) => setTwoFactorEmail(event.target.value)}
            disabled={sendingCode}
            required
          />

          <p className="mt-3 text-xs leading-5 text-surface-500">
            This must be the address on your account. The code expires 10 minutes after it is sent.
          </p>

          <div className="mt-6">
            <AuthSubmitButton pending={sendingCode} pendingLabel="Sending…">
              Send code
            </AuthSubmitButton>
          </div>
        </form>

        {/* Offered here too, because a customer who already knows their inbox is gone should not
            have to send a code they will never read before reaching the way around it. */}
        <div className="mt-5 border-t border-surface-200 pt-5 text-center">
          <button
            type="button"
            onClick={() => { setUseRecoveryCode(true); setStep('code'); setFormError(''); }}
            className="cursor-pointer rounded text-sm font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Can't access your email? Use a recovery code
          </button>
        </div>
      </AuthLayout>
    );
  }

  // ─── Step 2b: the code itself ───────────────────────────────────────
  // Either the emailed six digits or a recovery code. Still no session — tokens exist only after
  // one of them verifies server-side.
  if (step === 'code') {
    return (
      <AuthLayout
        title={useRecoveryCode ? 'Use a recovery code' : "Confirm it's you"}
        subtitle={
          useRecoveryCode
            ? 'Enter one of the recovery codes you saved when you turned on two-factor authentication.'
            : `Enter the 6-digit code we sent to ${twoFactorEmail}.`
        }
        footer={
          <button
            type="button"
            onClick={() => resetToPassword()}
            className="cursor-pointer rounded font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Back to sign in
          </button>
        }
      >
        {/* Honest, not an error: the sign-in genuinely paused and the code did not get out. */}
        {!codeSent && !useRecoveryCode && (
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

          {useRecoveryCode ? (
            <>
              <AuthField
                label="Recovery code"
                type="text"
                name="recoveryCode"
                autoComplete="one-time-code"
                placeholder="ABCD-EFGH-JKMN-PQRS"
                icon={KeyRound}
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                disabled={pending}
                required
              />
              <p className="mt-3 text-xs leading-5 text-surface-500">
                Each recovery code works once. Dashes and capitals do not matter.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="mt-6">
            <AuthSubmitButton pending={pending} pendingLabel="Verifying…">
              Verify and sign in
            </AuthSubmitButton>
          </div>
        </form>

        <div className="mt-5 space-y-2 border-t border-surface-200 pt-5 text-center">
          {!useRecoveryCode && (
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={resending || cooldown > 0}
              className="block w-full cursor-pointer rounded text-sm font-semibold text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-surface-400 disabled:no-underline"
            >
              {resending ? 'Sending…' : cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setUseRecoveryCode((previous) => !previous);
              setFormError('');
              setNotice('');
              setCode('');
              setRecoveryCode('');
            }}
            className="block w-full cursor-pointer rounded text-sm font-semibold text-surface-600 underline-offset-2 transition-colors hover:text-surface-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {useRecoveryCode ? 'Use the code sent to my email instead' : "Can't access your email? Use a recovery code"}
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
            icon={Mail}
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
            icon={Lock}
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
