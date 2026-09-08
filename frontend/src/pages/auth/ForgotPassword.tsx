import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { requestPasswordReset } from '../../data/auth.repository';

/**
 * Step 1 of password recovery.
 *
 * THE SUCCESS STATE IS DELIBERATELY UNCONDITIONAL. It says the same thing whether or not the
 * address has an account, because the backend answers identically either way. Confirming "we
 * found you" would let anyone test which addresses are registered, so the UI must not imply it —
 * even though a more specific message would feel more helpful.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setFieldError('Enter a valid email address.');
      return;
    }
    setFieldError('');

    setPending(true);
    try {
      await requestPasswordReset(trimmed);
      // The recovery credential is a LINK now, so this screen ends here rather than pushing the
      // customer to a form to type something into. It previously advanced to code entry — the
      // right move when a code was emailed, and a confusing dead end once one is not.
      setSentTo(trimmed.toLowerCase());
    } catch {
      // Only genuine transport/server failures land here — an unknown address is a success.
      // The message stays generic so nothing about the account is inferable from a failure.
      setFormError('We could not process that request right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  // ── Sent ────────────────────────────────────────────────────────────
  // Note the wording: "if an account exists". It is not hedging — the backend answers identically
  // for every address, and a confirmation that said "we've sent it" would turn this form into a
  // way to test which addresses are registered.
  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={`If an account exists for ${sentTo}, a password reset link is on its way.`}
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
        <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 text-center">
          <MailCheck size={22} className="mx-auto text-brand-600" aria-hidden="true" />
          <p className="mt-2 text-[12.5px] leading-[1.5] text-surface-700">
            Open the email and click <span className="font-semibold">Choose a new password</span>.
            The link works once and expires in 30 minutes.
          </p>
          <p className="mt-2 text-[11.5px] leading-[1.5] text-surface-500">
            Nothing arrived? Check your spam folder, then request another link — a new one replaces
            the old.
          </p>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => { setSentTo(''); setFormError(''); }}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] font-semibold text-surface-700 transition-colors hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Use a different address
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email address and we'll send you a reset link."
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
      <form onSubmit={handleSubmit} noValidate>
        {formError && <AuthAlert message={formError} />}

        <AuthField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
          disabled={pending}
          required
        />

        <div className="mt-6">
          <AuthSubmitButton pending={pending} pendingLabel="Sending…">
            Send reset link
          </AuthSubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
}
