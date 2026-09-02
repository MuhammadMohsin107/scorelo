import { AtSign, BadgeCheck, Briefcase, CalendarDays, ShieldCheck, Store, UserRound } from 'lucide-react';
import type { SettingsState } from '../../data/settings.mock';
import { Field, PreviewNotice, SettingsCard, TextInput, settingsCard } from './SettingsPrimitives';

/** Two letters from the name being typed, so the avatar tracks the field live. */
function initialsOf(fullName: string): string {
  return (
    fullName
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'S'
  );
}

/** `createdAt` is an ISO string from the API; a malformed one must not render "Invalid Date". */
function monthAndYear(isoDate: string): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Small label/value pair used across the identity card's meta strip. */
function MetaPill({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-surface-200 bg-white px-3 py-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-surface-100 text-surface-600">
        <Icon size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-surface-400">{label}</span>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-surface-800">{value}</span>
      </span>
    </div>
  );
}

interface ProfileSectionProps {
  profile: SettingsState['profile'];
  workspace: SettingsState['workspace'];
  errors: Record<string, string>;
  onChange: (patch: Partial<SettingsState['profile']>) => void;
}

export default function ProfileSection({ profile, workspace, errors, onChange }: ProfileSectionProps) {
  const initials = initialsOf(profile.fullName);
  const memberSince = monthAndYear(profile.createdAt);
  const displayName = profile.fullName.trim() || 'Your name';

  return (
    <>
      {/* ── Identity card ───────────────────────────────────────────── */}
      <section className={`${settingsCard} overflow-hidden`}>
        {/* The band is decorative only — it gives the avatar something to sit against and
            anchors the section visually without inventing any content. */}
        <div className="h-24 bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800" aria-hidden="true">
          <div className="h-full w-full bg-[radial-gradient(circle_at_18%_120%,rgba(255,255,255,0.28),transparent_58%)]" />
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <span
                className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold tracking-tight text-white shadow-[0_12px_28px_-12px_rgba(67,56,202,0.75)] ring-4 ring-white"
                aria-hidden="true"
              >
                {initials}
              </span>
              <div className="min-w-0 pb-1">
                <h3 className="truncate text-xl font-bold tracking-tight text-surface-950">{displayName}</h3>
                <p className="mt-0.5 truncate text-sm text-surface-500">
                  {profile.jobTitle.trim() || 'No job title set'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700">
                <ShieldCheck size={13} aria-hidden="true" />
                {profile.role}
              </span>
              {/* Shown only when the address genuinely is confirmed. Scorelo has no email
                  verification flow yet — `users.email_verified_at` is never written — so an
                  "unverified" counterpart would be a permanent warning about something the
                  customer has no way to resolve. */}
              {profile.emailVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-success-100 bg-success-50 px-2.5 py-1.5 text-[11px] font-bold text-success-700">
                  <BadgeCheck size={13} aria-hidden="true" />
                  Email verified
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <MetaPill icon={AtSign} label="Email" value={profile.email || '—'} />
            {memberSince && <MetaPill icon={CalendarDays} label="Member since" value={memberSince} />}
            <MetaPill icon={Store} label="Workspace" value={workspace.workspaceName || '—'} />
          </div>
        </div>
      </section>

      {/* ── Editable details ────────────────────────────────────────── */}
      <SettingsCard
        title="Personal information"
        description="Shown across your Scorelo workspace and used as the address for account email."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={errors.fullName} hint="Used across your Scorelo workspace.">
            <TextInput
              id="fullName"
              value={profile.fullName}
              onChange={(value) => onChange({ fullName: value })}
              placeholder="Your full name"
              invalid={Boolean(errors.fullName)}
              describedBy={errors.fullName ? 'fullName-error' : 'fullName-hint'}
            />
          </Field>

          <Field
            label="Email address"
            htmlFor="email"
            error={errors.email}
            hint="Used to sign in and as the address for account email."
          >
            <TextInput
              id="email"
              type="email"
              value={profile.email}
              onChange={(value) => onChange({ email: value })}
              placeholder="you@example.com"
              invalid={Boolean(errors.email)}
              describedBy={errors.email ? 'email-error' : 'email-hint'}
            />
          </Field>

          <Field label="Job title" htmlFor="jobTitle" hint="Optional. Helps tailor recommendations.">
            <TextInput
              id="jobTitle"
              value={profile.jobTitle}
              onChange={(value) => onChange({ jobTitle: value })}
              placeholder="e.g. Head of Ecommerce"
              describedBy="jobTitle-hint"
            />
          </Field>

          {/* Role is assigned server-side, so it is presented as a value rather than as a
              disabled input that looks like it could be typed into. */}
          <div>
            <p className="block text-sm font-semibold text-surface-800">Role</p>
            <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white text-brand-600 ring-1 ring-surface-200">
                <Briefcase size={13} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-surface-700">{profile.role}</span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-surface-500">Roles are assigned by the workspace owner.</p>
          </div>
        </div>
      </SettingsCard>

      {/* ── Avatar ──────────────────────────────────────────────────── */}
      <SettingsCard title="Avatar" description="How you appear in the header and on shared reports.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {/* The same monogram at the three sizes the app actually renders it. */}
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white">
              {initials}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[13px] font-bold text-white">
              {initials}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white">
              {initials}
            </span>
          </div>
          <p className="text-xs leading-5 text-surface-500">
            Your avatar is a monogram generated from your name — it updates as soon as you save.
          </p>
        </div>
        <div className="mt-4">
          <PreviewNotice>
            Image uploads need a file storage service, which is not connected in this build, so the monogram is
            the only avatar Scorelo renders.
          </PreviewNotice>
        </div>
      </SettingsCard>
    </>
  );
}
