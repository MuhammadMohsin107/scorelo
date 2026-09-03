import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import AuthField from '../../components/auth/AuthField';
import AuthAlert from '../../components/auth/AuthAlert';
import AuthCheckbox from '../../components/auth/AuthCheckbox';
import AuthSubmitButton from '../../components/auth/AuthSubmitButton';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

// Mirrors the backend's signupSchema (auth.schema.ts) so the customer is told about a problem
// before a round-trip — the server still enforces the same rules authoritatively. Keep these in
// step with that schema: a frontend rule the backend does not have would reject a valid signup,
// and a missing one just moves the error to a slower round trip.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const MAX_NAME_LENGTH = 160;
const MAX_EMAIL_LENGTH = 200;

type FieldName = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: FormValues = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const email = values.email.trim();

  if (!firstName) errors.firstName = 'Enter your first name.';
  if (!lastName) errors.lastName = 'Enter your last name.';
  // The backend caps the COMBINED name at 160 characters, so the limit is checked against the
  // value actually sent rather than each half.
  else if (`${firstName} ${lastName}`.length > MAX_NAME_LENGTH) errors.lastName = 'That name is too long.';

  if (!email) errors.email = 'Enter your email address.';
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address.';
  else if (email.length > MAX_EMAIL_LENGTH) errors.email = 'That email address is too long.';

  if (!values.password) errors.password = 'Choose a password.';
  else if (values.password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (values.password.length > MAX_PASSWORD_LENGTH) errors.password = `Use at most ${MAX_PASSWORD_LENGTH} characters.`;

  if (!values.confirmPassword) errors.confirmPassword = 'Re-enter your password.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';

  return errors;
}

/** Guidance only. The backend enforces length alone, so this must never gate submission —
 * telling someone their password is "too weak" when the server would accept it is a lie. */
function passwordStrength(password: string): { label: string; score: 0 | 1 | 2 | 3; tone: string } {
  if (password.length < MIN_PASSWORD_LENGTH) return { label: 'Too short', score: 0, tone: 'bg-critical-500' };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (password.length >= 12 && variety >= 3) return { label: 'Strong', score: 3, tone: 'bg-success-600' };
  if (variety >= 2) return { label: 'Good', score: 2, tone: 'bg-brand-500' };
  return { label: 'Fair', score: 1, tone: 'bg-warning-500' };
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [pending, setPending] = useState(false);
  // Errors appear on submit, then correct themselves live. Validating every keystroke from the
  // first character tells someone their email is invalid while they are still typing it.
  const [submitted, setSubmitted] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  // Bumped whenever a rejected submit should move focus. The focus itself has to happen in an
  // effect: at the point the handler sets the errors React has not committed them to the DOM
  // yet, so querying for [aria-invalid] there finds nothing.
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (focusRequest === 0) return;
    // Move focus to the first problem so keyboard and screen-reader users are not left hunting
    // for what changed. The field's own role="alert" message is announced with it.
    formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [focusRequest]);

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  function update(field: FieldName, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setFormError('');
    // Once a field has been flagged, re-check the whole form so fixing the password also clears
    // a stale "passwords do not match" on the confirm field.
    if (submitted) setFieldErrors(validate(next));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards against a double submit from a fast second click or an Enter keypress landing
    // while the first request is still in flight.
    if (pending) return;

    setSubmitted(true);
    setFormError('');

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFocusRequest((count) => count + 1);
      return;
    }

    setPending(true);
    try {
      const email = values.email.trim().toLowerCase();
      const result = await signup({
        // The backend stores one `fullName`, so the two inputs are composed here rather than
        // adding columns the product does not need.
        fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
        email,
        password: values.password,
        rememberMe,
      });

      // Where to go next is the SERVER's answer, not a local guess. When verification is enforced
      // no session was created, so landing on the dashboard would only bounce straight back out.
      // The address travels in router state rather than the URL — it is not a secret, but it does
      // not belong in browser history or a referrer header either.
      if (result.needsVerification) {
        navigate('/verify-email', {
          replace: true,
          state: { email, verificationSent: result.verificationSent },
        });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_DELIVERY_UNAVAILABLE') {
        // Nothing was created — the server refused before writing, precisely so there is no
        // unverifiable account left behind. Say that plainly rather than blaming the details.
        setFormError('We cannot create accounts right now because verification email is unavailable. Please try again shortly.');
      } else if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setFieldErrors({ email: 'An account with this email already exists.' });
        setFocusRequest((count) => count + 1);
      } else if (error instanceof ApiError && error.status === 400) {
        setFormError('Please check your details and try again.');
      } else if (error instanceof ApiError && error.status >= 500) {
        setFormError('Something went wrong on our side. Please try again in a moment.');
      } else {
        // Covers the offline / DNS / aborted cases, where there is no ApiError at all.
        setFormError('We could not reach Scorelo. Check your connection and try again.');
      }
    } finally {
      // Always released, so a failure leaves the form usable rather than permanently disabled.
      setPending(false);
    }
  }

  return (
    <AuthLayout
      width="wide"
      title="Create your account"
      subtitle="Start auditing your Shopify store across SEO, content, speed, CRO and AI discovery."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded font-semibold text-brand-600 underline-offset-2 hover:text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        {formError && <AuthAlert message={formError} />}

        <div className="space-y-4">
          {/* Paired on tablet and up; stacked on phones so neither field becomes too narrow
              to read its own placeholder. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthField
              label="First name"
              type="text"
              name="given-name"
              autoComplete="given-name"
              placeholder="Ada"
              value={values.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              error={fieldErrors.firstName}
              disabled={pending}
              required
            />
            <AuthField
              label="Last name"
              type="text"
              name="family-name"
              autoComplete="family-name"
              placeholder="Lovelace"
              value={values.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              error={fieldErrors.lastName}
              disabled={pending}
              required
            />
          </div>

          <AuthField
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
            error={fieldErrors.email}
            disabled={pending}
            required
          />

          <div>
            <AuthField
              label="Password"
              type="password"
              name="new-password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={values.password}
              onChange={(event) => update('password', event.target.value)}
              error={fieldErrors.password}
              hint={values.password ? undefined : `At least ${MIN_PASSWORD_LENGTH} characters.`}
              disabled={pending}
              required
            />
            {values.password && !fieldErrors.password && (
              <div className="mt-2 flex items-center gap-2.5">
                <span className="flex flex-1 gap-1" aria-hidden="true">
                  {[0, 1, 2].map((segment) => (
                    <span
                      key={segment}
                      className={`h-1 flex-1 rounded-full transition-colors ${segment < strength.score ? strength.tone : 'bg-surface-200'}`}
                    />
                  ))}
                </span>
                {/* Announced politely: useful, but not worth interrupting typing for. */}
                <span aria-live="polite" className="text-[11px] font-medium text-surface-500">
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <AuthField
            label="Confirm password"
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={values.confirmPassword}
            onChange={(event) => update('confirmPassword', event.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={pending}
            required
          />
        </div>

        <div className="mt-5">
          <AuthCheckbox
            checked={rememberMe}
            onChange={setRememberMe}
            disabled={pending}
            label="Remember me on this device"
            hint="Stay signed in after closing your browser. Leave this off on shared computers."
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
