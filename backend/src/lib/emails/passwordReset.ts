import type { MailMessage } from '../mailer.js';

interface PasswordResetEmailInput {
  to: string;
  fullName: string;
  /** Absolute URL built from FRONTEND_URL — never hardcoded, so local and staging both work. */
  resetUrl: string;
  expiresInMinutes: number;
}

/** Minimal escaping for the one interpolated value that comes from user input (the display name).
 * Without this a name containing markup would be injected into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The Scorelo password-reset email.
 *
 * Table-based layout with inline styles, because email clients are not browsers: Outlook ignores
 * most of a stylesheet and flexbox/grid do not survive. A plain-text alternative always ships
 * alongside the HTML — some clients render only that, and a reset link that arrives unusable is
 * a locked-out customer.
 *
 * Carries no secret other than the reset URL itself, and states the expiry so the link's limited
 * lifetime is not a surprise.
 */
export function buildPasswordResetEmail(input: PasswordResetEmailInput): MailMessage {
  const name = input.fullName.trim().split(/\s+/)[0] || 'there';
  const safeName = escapeHtml(name);
  const url = input.resetUrl;

  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset the password on your Scorelo account.',
    '',
    'Open this link to choose a new password:',
    url,
    '',
    `This link expires in ${input.expiresInMinutes} minutes and can be used once.`,
    '',
    'If you did not request this, you can ignore this email — your password will not change.',
    '',
    '— Scorelo',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your Scorelo password</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <!-- Preheader: shown in the inbox preview, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Reset your Scorelo password — this link expires in ${input.expiresInMinutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px 8px 32px;">
          <p style="margin:0;font:600 18px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4f46e5;letter-spacing:-0.01em;">scorelo</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 12px 0;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">Reset your password</h1>
          <p style="margin:0 0 8px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">Hi ${safeName},</p>
          <p style="margin:0 0 20px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">We received a request to reset the password on your Scorelo account. Choose a new one using the button below.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:8px;background:#4f46e5;">
              <a href="${url}" style="display:inline-block;padding:12px 22px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <p style="margin:0 0 6px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">This link expires in ${input.expiresInMinutes} minutes and can only be used once.</p>
          <p style="margin:0 0 14px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">If the button does not work, copy this link into your browser:</p>
          <p style="margin:0;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#52525b;word-break:break-all;">${url}</p>
        </td></tr>
        <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #f4f4f5;">
          <p style="margin:16px 0 0 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">If you did not request this, you can safely ignore this email — your password will not change.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#a1a1aa;">Scorelo · Store performance</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: input.to, subject: 'Reset your Scorelo password', text, html };
}
