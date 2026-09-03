import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

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
      // Straight to code entry. The response is deliberately identical whether or not the address
      // has an account, so advancing here reveals nothing — someone probing an address they do
      // not own reaches a form whose codes will never arrive and never match.
      navigate('/reset-password', { state: { email: trimmed.toLowerCase() } });
    } catch {
      // Only genuine transport/server failures land here — an unknown address is a success.
      // The message stays generic so nothing about the account is inferable from a failure.
      setFormError('We could not process that request right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  // The old "check your email" interstitial lived here. It is gone because the flow now continues
  // on the next screen: the customer types the emailed code there, so a dead-end confirmation page
  // would only add a click. The unconditional wording it existed to protect moved with it — the
  // code screen makes no claim about whether the address is registered either.

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
