import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

// Mirrors the backend's signupSchema (auth.schema.ts) so the customer is told about a
// problem before a round-trip — the server still enforces the same rule authoritatively.
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = 'Enter your name.';
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Choose a password.';
    else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
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
      await signup({ fullName: fullName.trim(), email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: 'An account with this email already exists.' });
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError('Please check your details and try again.');
      } else {
        setFormError('We could not create your account right now. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start auditing your Shopify store across SEO, content, speed, CRO and AI discovery."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError && <AuthAlert message={formError} />}

        <div className="space-y-4">
          <AuthField
            label="Full name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={fieldErrors.fullName}
            disabled={pending}
            required
          />

          <AuthField
            label="Work email"
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
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            disabled={pending}
            required
          />
        </div>

        <div className="mt-6">
          <AuthSubmitButton pending={pending} pendingLabel="Creating account…">
            Create account
          </AuthSubmitButton>
        </div>

        <p className="mt-4 text-center text-[12px] leading-5 text-surface-400">
          Scorelo requests read-only access to your store and never modifies your storefront.
        </p>
      </form>
    </AuthLayout>
  );
}
