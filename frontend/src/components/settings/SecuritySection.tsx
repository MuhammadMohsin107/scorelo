import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Check, Laptop, RefreshCw, ShieldCheck } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  eventLabel,
  fetchSecurityEvents,
  fetchSecurityProfile,
  fetchSessions,
  formatSecurityDate,
  revokeOtherSessions,
  revokeSession,
  type SecurityEventRecord,
  type SecurityProfile,
  type SessionRecord,
} from '../../data/security.repository';
import { Button } from '../workflows/WorkflowPrimitives';
import { Field, SettingsCard, TextInput } from './SettingsPrimitives';

/** Mirrors the backend policy. The server enforces the same minimum, so this is a convenience. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * ─── Settings → Security ─────────────────────────────────────────────
 *
 * Everything on this page is a real database row. Nothing is illustrative.
 *
 * This replaces a block that stated "Last changed 30 days ago", "Windows · Chrome", "Today,
 * 09:14 AM" and "Karachi, Pakistan" as facts about the customer's account. None of it had a
 * source; all of it is gone. Where the backend has no answer, this page says so — "Not recorded",
 * "Unknown", "No security activity yet" — rather than filling the space with something plausible.
 *
 * Two absences are deliberate and worth naming:
 *   · NO DEVICE NAME. A "device" is guessed from the User-Agent, which anyone can set. The raw
 *     header is shown instead, so what is displayed is exactly what was received.
 *   · NO LOCATION. Geolocation needs a database this project does not carry. An IP is shown when
 *     the request had one; nothing is inferred from it.
 */
export default function SecuritySection() {
  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [events, setEvents] = useState<SecurityEventRecord[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [togglingTwoFactor, setTogglingTwoFactor] = useState(false);

  /** Read from the server's record, never from local state — the backend owns whether 2FA is on. */
  const twoFactorOn = Boolean(profile?.twoFactorEnabledAt);

  async function handleToggleTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTwoFactorError('');
    setTogglingTwoFactor(true);
    try {
      if (twoFactorOn) await disableTwoFactor(twoFactorPassword);
      else await enableTwoFactor(twoFactorPassword);
      setTwoFactorPassword('');
      // Re-read rather than flipping a local boolean: the page shows what the database says.
      await load();
    } catch (error) {
      // 400 covers a wrong password and an unverified address; 503 means mail is down and
      // enabling would lock the customer out. All are specific and safe to show.
      setTwoFactorError(
        error instanceof ApiError && [400, 429, 503].includes(error.status)
          ? error.message
          : 'We could not change that setting right now. Please try again.',
      );
    } finally {
      setTogglingTwoFactor(false);
    }
  }

  const load = useCallback(async () => {
    try {
      setState('loading');
      const [nextProfile, nextSessions, nextEvents] = await Promise.all([
        fetchSecurityProfile(),
        fetchSessions(),
        fetchSecurityEvents(),
      ]);
      setProfile(nextProfile);
      setSessions(nextSessions);
      setEvents(nextEvents);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRevoke(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      await revokeSession(id);
      await load();
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeOthers() {
    if (busy) return;
    setBusy(true);
    try {
      await revokeOtherSessions();
      await load();
    } catch {
      setState('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Your new passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordNotice(
        result.otherSessionsRevoked > 0
          ? `Password updated. ${result.otherSessionsRevoked} other device${result.otherSessionsRevoked === 1 ? ' was' : 's were'} signed out.`
          : 'Password updated.',
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await load();
    } catch (error) {
      // The backend's 400s are specific and safe to show — a wrong current password and an
      // unchanged password are both things the customer can act on. 429 carries the rate
      // limiter's own wording. Everything else stays generic.
      setPasswordError(
        error instanceof ApiError && (error.status === 400 || error.status === 429)
          ? error.message
          : 'We could not change your password right now. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (state === 'loading') {
    return (
      <SettingsCard title="Security" description="Loading your account security details.">
        <div className="space-y-3">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      </SettingsCard>
    );
  }

  if (state === 'error') {
    return (
      <SettingsCard title="Security" description="Your security settings could not be loaded.">
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-critical-50 text-critical-600">
            <AlertCircle size={22} />
          </span>
          <p className="mt-3 text-sm text-surface-600">Nothing was changed.</p>
          <div className="mt-5">
            <Button onClick={load}>
              <RefreshCw size={15} />
              Retry
            </Button>
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <>
      {/* ── Password ─────────────────────────────────────────────── */}
      <SettingsCard
        title="Password"
        description="Changing your password signs out every other device. This one stays signed in."
      >
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-surface-100 pb-4">
          <p className="text-sm font-semibold text-surface-800">Last changed</p>
          <p className="text-sm text-surface-700">
            {profile?.passwordChangedAt
              ? formatSecurityDate(profile.passwordChangedAt)
              : /* Genuinely unknown: nothing recorded a change before this feature existed, and no
                   date was invented for accounts that predate it. */
                <span className="text-surface-500">Not recorded</span>}
          </p>
        </div>

        <form onSubmit={handleChangePassword} noValidate>
          {passwordError && (
            <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-critical-200 bg-critical-50 p-3.5">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-critical-600" aria-hidden="true" />
              <p className="text-sm leading-6 text-critical-800">{passwordError}</p>
            </div>
          )}
          {passwordNotice && !passwordError && (
            <div role="status" className="mb-4 flex items-start gap-2.5 rounded-lg border border-success-100 bg-success-50 p-3.5">
              <Check size={15} className="mt-0.5 flex-shrink-0 text-success-700" aria-hidden="true" />
              <p className="text-sm leading-6 text-success-800">{passwordNotice}</p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Current password" htmlFor="currentPassword" className="sm:col-span-2">
              <TextInput
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Your current password"
              />
            </Field>
            <Field label="New password" htmlFor="newPassword" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              <TextInput id="newPassword" type="password" value={newPassword} onChange={setNewPassword} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmNewPassword">
              <TextInput id="confirmNewPassword" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            </Field>
          </div>

          <div className="mt-5">
            <Button type="submit" disabled={saving || !currentPassword || !newPassword}>
              {saving ? 'Updating…' : 'Change password'}
            </Button>
          </div>
        </form>
      </SettingsCard>

      {/* ── Two-factor authentication ────────────────────────────── */}
      <SettingsCard
        title="Two-factor authentication"
        description="When it is on, signing in also needs a 6-digit code sent to your email address."
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-surface-800">
              {twoFactorOn ? (
                <>
                  <ShieldCheck size={15} className="text-success-700" aria-hidden="true" />
                  On since {formatSecurityDate(profile!.twoFactorEnabledAt!)}
                </>
              ) : (
                <>
                  <ShieldCheck size={15} className="text-surface-400" aria-hidden="true" />
                  Off
                </>
              )}
            </p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-surface-500">
              {/* Stated plainly rather than sold. Email 2FA is a real improvement over a password
                  alone and is weaker than an authenticator app — a customer deciding whether to
                  turn it on deserves to know which one this is. */}
              The second factor is access to your inbox. Scorelo does not support authenticator
              apps yet, and there are no backup codes — if you lose access to your email you will
              not be able to sign in.
            </p>
          </div>
        </div>

        {/* The email gate is enforced server-side; showing it here explains the refusal before the
            customer runs into it. */}
        {!profile?.emailVerifiedAt && !twoFactorOn && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warning-100 bg-warning-50 p-3.5">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-warning-600" aria-hidden="true" />
            <p className="text-sm leading-6 text-warning-800">
              Verify your email address first — the codes are sent there, so turning this on before
              then would lock you out.
            </p>
          </div>
        )}

        {twoFactorError && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg border border-critical-200 bg-critical-50 p-3.5">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-critical-600" aria-hidden="true" />
            <p className="text-sm leading-6 text-critical-800">{twoFactorError}</p>
          </div>
        )}

        <form
          onSubmit={handleToggleTwoFactor}
          className="mt-5 flex flex-wrap items-end gap-3 border-t border-surface-100 pt-5"
          noValidate
        >
          <Field
            label="Current password"
            htmlFor="twoFactorPassword"
            hint={twoFactorOn ? 'Required to turn it off.' : 'Required to turn it on.'}
            className="min-w-[220px] flex-1"
          >
            <TextInput
              id="twoFactorPassword"
              type="password"
              value={twoFactorPassword}
              onChange={setTwoFactorPassword}
              placeholder="Your current password"
            />
          </Field>
          <div className="pb-6">
            <Button
              type="submit"
              variant={twoFactorOn ? 'danger' : 'primary'}
              disabled={
                togglingTwoFactor || !twoFactorPassword || (!twoFactorOn && !profile?.emailVerifiedAt)
              }
            >
              {togglingTwoFactor ? 'Saving…' : twoFactorOn ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        </form>
      </SettingsCard>

      {/* ── Sessions ─────────────────────────────────────────────── */}
      <SettingsCard
        title="Active sessions"
        description="Devices with a valid sign-in to this account. Signing one out takes effect immediately."
        footer={
          sessions.length > 1 ? (
            <button
              type="button"
              onClick={handleRevokeOthers}
              disabled={busy}
              className="cursor-pointer rounded text-sm font-semibold text-critical-700 underline-offset-2 transition-colors hover:text-critical-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-critical-500 disabled:cursor-not-allowed disabled:text-surface-400 disabled:no-underline"
            >
              Sign out all other devices
            </button>
          ) : undefined
        }
      >
        {sessions.length === 0 ? (
          // Honest empty state. Reached when every session has been revoked or expired — including
          // right after Phase 2 ships, when pre-existing sign-ins have no session row.
          <p className="py-4 text-sm text-surface-500">No active sessions.</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {sessions.map((session) => (
              <li key={session.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-surface-600">
                    <Laptop size={15} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-800">
                      Last active {formatSecurityDate(session.lastUsedAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-500">
                      Signed in {formatSecurityDate(session.createdAt)} · IP{' '}
                      {session.ipAddress ?? <span className="text-surface-400">unknown</span>}
                    </p>
                    {/* The raw header, not a guess about the device it names. */}
                    {session.userAgent && (
                      <p className="mt-1 break-all font-mono text-[11px] leading-4 text-surface-400">
                        {session.userAgent}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(session.id)}
                  disabled={busy}
                  className="cursor-pointer rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-semibold text-surface-700 transition-colors hover:border-critical-200 hover:bg-critical-50 hover:text-critical-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      {/* ── Activity ─────────────────────────────────────────────── */}
      <SettingsCard title="Security activity" description="Recent security events on your account.">
        {events.length === 0 ? (
          // A new account genuinely has no history. Nothing is seeded to make this look populated.
          <p className="py-4 text-sm text-surface-500">No security activity yet.</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-surface-800">
                    {event.type === 'login_failed' ? (
                      <AlertCircle size={14} className="flex-shrink-0 text-warning-600" aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={14} className="flex-shrink-0 text-surface-400" aria-hidden="true" />
                    )}
                    {eventLabel(event.type)}
                  </p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    IP {event.ipAddress ?? <span className="text-surface-400">unknown</span>}
                  </p>
                </div>
                <p className="text-xs text-surface-500 tabular-nums">{formatSecurityDate(event.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}
