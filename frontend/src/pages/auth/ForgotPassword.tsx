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
  const [sent, setSent] = useState(false);

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
      setSent(true);
    } catch {
      // Only genuine transport/server failures land here — an unknown address is a success.
      // The message stays generic so nothing about the account is inferable from a failure.
      setFormError('We could not process that request right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="If an account exists for that address, we've sent a password reset link."
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
        <div className="flex flex-col items-center rounded-xl border border-surface-200 bg-surface-50/60 p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MailCheck size={22} />
          </span>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            The link expires in 30 minutes and can be used once. If it doesn't arrive, check your
            spam folder or try again.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail(''); }}
            className="mt-4 text-sm font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Use a different email
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
