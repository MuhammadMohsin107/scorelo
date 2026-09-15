import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Lock, Mail, Store } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import OtpInput from '../../components/auth/OtpInput';
import { useAuth } from '../../context/AuthContext';
import {
  describeShopifySignInFailure,
  readShopifyGrant,
  readShopifyLaunch,
  resendTwoFactorCode,
  sendTwoFactorCode,
  startShopifyLaunch,
  startShopifySignIn,
} from '../../data/auth.repository';
import { normalizeShopDomain } from '../../data/shopify.repository';
import { ApiError } from '../../lib/api';

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Matches the backend's resend limit with room to spare. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * ─── Sign in ─────────────────────────────────────────────────────────
 *
 * SHOPIFY FIRST. A merchant signs in — and a new merchant gets their account — by naming their
 * store and approving Scorelo on Shopify's own screen. Email and password remain for accounts that
 * were created that way, one click away.
 *
 * This page is also where Shopify sign-in ARRIVES, in two ways that need no form at all:
 *   • Shopify opened Scorelo (App Store install, or Apps in the admin) with a signed query — the
 *     page sends the merchant straight on to Shopify's authorization, with nothing typed.
 *   • Shopify's authorization finished and the backend returned a grant in the URL fragment — the
 *     page redeems it and signs the merchant in.
 */
function describeShopifyError(error: unknown): string {
  if (error instanceof ApiError) {
    // The rate limiter's wording is already merchant-safe.
    if (error.status === 429) return error.message;
    return describeShopifySignInFailure(error.code);
  }
  return 'We could not reach Scorelo. Check your connection and try again.';
}

export default function Login() {
  const { login, completeShopifySignIn, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [method, setMethod] = useState<'shopify' | 'email'>('shopify');
  const [shopInput, setShopInput] = useState('');
  const [shopError, setShopError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  /**
   * What the page is doing because of HOW it was opened, before any form is shown. Derived from the
   * URL on first render so a merchant arriving from Shopify never sees a form flash before the
   * redirect or the sign-in completes.
   */
  const [arrival, setArrival] = useState<'none' | 'redirecting' | 'completing'>(() =>
    readShopifyGrant(location.hash) ? 'completing' : readShopifyLaunch(location.search) ? 'redirecting' : 'none',
  );
  // A grant's nonce is single-use, so the arrival must be handled exactly once — including under
  // StrictMode, which runs mount effects twice in development.
  const arrivalHandled = useRef(false);

  // ─── Second factor ──────────────────────────────────────────────────
  // A non-empty ticket means the first factor succeeded — a password, or Shopify. It is held here
  // and nowhere else: never in localStorage, never in the URL. A page refresh loses it and the
  // customer signs in again — the correct outcome for a half-finished authentication.
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

  // ─── Arriving from Shopify ──────────────────────────────────────────
  // Reads the URL the page was OPENED with, once. What arrived is stripped from the address bar
  // straight away with replaceState rather than a router navigation, so a grant never lingers in
  // history and the page does not re-render into a state that has lost it.
  useEffect(() => {
    if (arrivalHandled.current) return;
    arrivalHandled.current = true;

    const grant = readShopifyGrant(location.hash);
    const launch = readShopifyLaunch(location.search);
    const params = new URLSearchParams(location.search);
    const outcome = params.get('shopify');

    if (grant || launch || outcome) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }

    if (grant) {
      void finishShopifySignIn(grant);
      return;
    }

    if (launch) {
      startShopifyLaunch(launch).catch((error: unknown) => {
        setArrival('none');
        setFormError(describeShopifyError(error));
      });
      return;
    }

    if (outcome === 'cancelled') setFormError(describeShopifySignInFailure('access_denied'));
    else if (outcome === 'failed') setFormError(describeShopifySignInFailure(params.get('reason')));
    // Deliberately no dependencies: this reads the URL the page was opened with, once.
  }, []);

  async function finishShopifySignIn(grant: string) {
    setArrival('completing');
    try {
      const result = await completeShopifySignIn(grant);

      // Shopify proved the store; the account's own second factor is still owed. Nothing was typed
      // on this page, so the address field starts empty — the customer confirms their own address.
      if (result.status === 'two-factor') {
        setTicket(result.ticket);
        setTwoFactorEmail('');
        setStep('confirm-email');
        setArrival('none');
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      setArrival('none');
      setFormError(describeShopifyError(error));
    }
  }

  async function handleShopifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError('');

    const shop = normalizeShopDomain(shopInput);
    if (!shop) {
      setShopError('Enter your store’s .myshopify.com address.');
      return;
    }
    setShopError('');

    setPending(true);
    try {
      await startShopifySignIn(shop);
      // The browser is on its way to Shopify. The button stays pending until the page unloads, so
      // a second click cannot start a second sign-in over the first one's nonce.
    } catch (error) {
      setFormError(describeShopifyError(error));
      setPending(false);
    }
  }

  function switchMethod(next: 'shopify' | 'email') {
    setMethod(next);
    setFormError('');
    setFieldErrors({});
    setShopError('');
  }

  /**
   * Step 2a: confirm the address, and the server sends the code.
   *
   * After a password sign-in the field is prefilled with what was typed at the password step, so
   * for almost everyone this is one click. It is still a real check — the server compares it
   * against the account's registered address and mails that row, never this value.
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
      // caller who has already passed the first factor. 401 means the ticket died; send them back
      // rather than leaving them on a step that can no longer succeed.
      if (error instanceof ApiError && error.status === 401) {
        resetToPassword('Your sign-in timed out. Please sign in again.');
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

  /** Drops every trace of the half-finished sign-in and returns to the sign-in form. */
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
      // error they cannot act on.
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

  // ─── Arriving from Shopify: nothing to fill in ──────────────────────
  if (arrival !== 'none') {
    const completing = arrival === 'completing';
    return (
      <AuthLayout
        title={completing ? 'Signing you in' : 'Opening Shopify'}
        subtitle={
          completing
            ? 'Shopify confirmed your store. Finishing your sign-in…'
            : 'Taking you to Shopify to confirm your store…'
        }
      >
        <div role="status" aria-live="polite" className="flex justify-center py-6">
          <Loader2
            size={30}
            strokeWidth={2.25}
            className="animate-spin text-[color:var(--auth-accent)] motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="sr-only">{completing ? 'Signing you in' : 'Opening Shopify'}</span>
        </div>
      </AuthLayout>
    );
  }

  // ─── Step 2a: where the code should go ──────────────────────────────
  // Replaces the sign-in form rather than sitting beside it, so there is one thing to do. The
  // customer is NOT signed in at this point — no tokens exist, and no code has been sent yet.
  //
  // It is a CONFIRMATION, not a choice: the server checks it against the account's own address and
  // mails that row. Typing someone else's address here sends nothing anywhere.
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
            placeholder="Enter the email on your account"
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
                placeholder="Enter a recovery code"
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

  // ─── Step 1: sign in ────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Sign in to Scorelo"
      subtitle={
        method === 'shopify'
          ? 'Use your Shopify store to sign in. New to Scorelo? The same step creates your account.'
          : 'Sign in with the email address and password on your Scorelo account.'
      }
      footer={
        <>
          Installed Scorelo from the Shopify App Store? Open it from{' '}
          <span className="font-semibold text-white">Apps</span> in your Shopify admin to sign in without typing
          anything.
        </>
      }
    >
      {method === 'shopify' ? (
        <form onSubmit={handleShopifySubmit} noValidate>
          {formError && <AuthAlert message={formError} />}

          <AuthField
            label="Shopify store address"
            type="text"
            name="shop"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="url"
            placeholder="your-store.myshopify.com"
            icon={Store}
            value={shopInput}
            onChange={(event) => {
              setShopInput(event.target.value);
              setShopError('');
            }}
            error={shopError || undefined}
            hint="Find it in your Shopify admin under Settings → Domains."
            disabled={pending}
            required
          />

          <div className="mt-5">
            <AuthSubmitButton pending={pending} pendingLabel="Opening Shopify…">
              Continue with Shopify
            </AuthSubmitButton>
          </div>

          <p className="mt-3 text-center text-[12px] leading-5 text-surface-500">
            You approve access on Shopify’s own screen. Scorelo never asks for your Shopify password.
          </p>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {formError && <AuthAlert message={formError} />}

          <div className="space-y-4">
            <AuthField
              label="Email address"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Enter your email address"
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
      )}

      <div
        className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--auth-divider-text)' }}
      >
        <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--auth-divider)' }} />
        or
        <span aria-hidden="true" className="h-px flex-1" style={{ background: 'var(--auth-divider)' }} />
      </div>

      <button
        type="button"
        className="auth-sso-btn"
        onClick={() => switchMethod(method === 'shopify' ? 'email' : 'shopify')}
        disabled={pending}
      >
        {method === 'shopify' ? (
          <>
            <Mail size={16} strokeWidth={2} aria-hidden="true" />
            Sign in with email and password
          </>
        ) : (
          <>
            <Store size={16} strokeWidth={2} aria-hidden="true" />
            Sign in with your Shopify store
          </>
        )}
      </button>
    </AuthLayout>
  );
}
