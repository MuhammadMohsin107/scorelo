import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { resetPassword } from '../../data/auth.repository';
import { ApiError } from '../../lib/api';

/** Mirrors the backend policy in auth.schema.ts. Client-side validation is a convenience only —
 * the server enforces the same rule, so a request that skips this page cannot set a weak one. */
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Step 2 of password recovery: redeem the emailed token.
 *
 * The token is read from the query string and sent as-is. It is never rendered, never logged and
 * never written to storage — it lives only in this component's props for the length of the
 * request. On success the customer is sent to sign in normally rather than being logged in
 * automatically, which matches how the backend behaves (it issues no session here).
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!password) errors.password = 'Choose a new password.';
    else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (!confirmPassword) errors.confirmPassword = 'Re-enter your new password.';
    else if (password && confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
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
      await resetPassword({ token, password, confirmPassword });
      setDone(true);
    } catch (error) {
      // 400 is the backend's single, deliberately indistinguishable rejection for a token that is
      // missing, expired or already spent — its wording is safe to show. Anything else is
      // unexpected and gets a generic message so no internals reach the browser.
      setFormError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : 'We could not reset your password right now. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  // A link with no token at all never reached the API — say so immediately rather than letting
  // someone fill in a form that is guaranteed to fail.
  if (!token) {
    return (
      <AuthLayout
        title="Reset link not valid"
        subtitle="This password reset link is missing its token."
        footer={
          <Link
            to="/forgot-password"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Request a new link
          </Link>
        }
      >
        <AuthAlert message="Open the link from your reset email, or request a new one." />
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
              Request another link
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
      <form onSubmit={handleSubmit} noValidate>
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
