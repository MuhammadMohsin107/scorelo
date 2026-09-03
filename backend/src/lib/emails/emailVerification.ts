import type { MailMessage } from '../mailer.js';

interface VerificationEmailInput {
  to: string;
  fullName: string;
  /** The one-time code. Rendered into the message and nowhere else — never logged, never stored. */
  code: string;
  expiresInMinutes: number;
  /** What the code is for, which changes the wording and the subject line. */
  purpose: 'signup' | 'password-reset' | 'login';
}

/** Minimal escaping for the one interpolated value that comes from user input (the display name).
 * The code itself is generated digits, so it cannot carry markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The Scorelo one-time-code email, used by both signup verification and password reset.
 *
 * Same construction as buildPasswordResetEmail: table layout, inline styles, and a plain-text
 * alternative that always ships alongside the HTML — some clients render only that, and a code
 * that arrives unreadable is a locked-out customer.
 *
 * The code is spaced out visually but kept contiguous in the text part, so a customer copying it
 * from either version pastes six digits and nothing else.
 */
export function buildVerificationEmail(input: VerificationEmailInput): MailMessage {
  const name = input.fullName.trim().split(/\s+/)[0] || 'there';
  const safeName = escapeHtml(name);
  const { code, expiresInMinutes } = input;

  // Three purposes, one template. The wording differs because the closing line matters most: what
  // a customer should DO when a code arrives they did not ask for is different in each case, and a
  // sign-in code arriving unrequested is the one that means someone has their password.
  const copy = {
    signup: {
      subject: 'Verify your Scorelo email address',
      heading: 'Verify your email address',
      lead: 'Enter this code in Scorelo to confirm this email address belongs to you.',
      footer: 'If you did not create a Scorelo account, you can safely ignore this email.',
    },
    'password-reset': {
      subject: 'Your Scorelo password reset code',
      heading: 'Reset your password',
      lead: 'Enter this code in Scorelo to continue resetting your password.',
      footer: 'If you did not request this, you can safely ignore this email — your password will not change.',
    },
    login: {
      subject: 'Your Scorelo sign-in code',
      heading: 'Confirm it is you',
      lead: 'Enter this code to finish signing in to Scorelo.',
      footer:
        'If you did not try to sign in, someone else may know your password. Change it as soon as you can — this code alone will not let them in.',
    },
  }[input.purpose];

  const { subject, heading, lead, footer } = copy;

  const text = [
    `Hi ${name},`,
    '',
    lead,
    '',
    code,
    '',
    `This code expires in ${expiresInMinutes} minutes and can be used once.`,
    '',
    footer,
    '',
    '— Scorelo',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <!-- Preheader: shown in the inbox preview, hidden in the body. Deliberately excludes the code,
       so it is not readable from a lock-screen notification. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Scorelo code expires in ${expiresInMinutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px 8px 32px;">
          <p style="margin:0;font:600 18px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4f46e5;letter-spacing:-0.01em;">scorelo</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 12px 0;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">${heading}</h1>
          <p style="margin:0 0 8px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">Hi ${safeName},</p>
          <p style="margin:0 0 20px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">${lead}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="border-radius:10px;background:#f4f4f5;border:1px solid #e4e4e7;padding:18px 12px;">
              <span style="font:700 30px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#18181b;letter-spacing:0.32em;">${code}</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <p style="margin:0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">This code expires in ${expiresInMinutes} minutes and can only be used once. Scorelo will never ask you for it by phone or email.</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #f4f4f5;">
          <p style="margin:16px 0 0 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">${footer}</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#a1a1aa;">Scorelo · Store performance</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: input.to, subject, text, html };
}
