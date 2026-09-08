import type { MailMessage } from '../mailer.js';

interface PasswordResetLinkInput {
  to: string;
  fullName: string;
  /** The full https URL, already carrying the one-time token. Never logged. */
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * The password-reset email: a button and the same URL in plain text.
 *
 * WHY A LINK RATHER THAN A CODE. Recovery used to email six digits that were exchanged for a
 * ticket. That was secure, but it made the customer the transport: read the code, switch windows,
 * type it correctly, before it expired. A link carries the credential itself, so the only step is
 * a click — and the credential is stronger, because the token in the URL is 256 bits of CSPRNG
 * output rather than a million-space number a person could guess.
 *
 * The URL appears TWICE on purpose. Some clients strip the button, some show plain text only, and
 * a corporate gateway may rewrite the href — a customer who cannot click still has something they
 * can copy. A reset mail that arrives unusable is a locked-out account.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPasswordResetLinkEmail(input: PasswordResetLinkInput): MailMessage {
  const name = input.fullName.trim().split(/\s+/)[0] || 'there';
  const safeName = escapeHtml(name);
  // The URL is ours and built from a hex token plus FRONTEND_URL, but it is interpolated into an
  // href, so it is escaped like any other value rather than trusted for being internal.
  const safeUrl = escapeHtml(input.resetUrl);
  const { expiresInMinutes } = input;

  const subject = 'Reset your Scorelo password';
  const footer = 'If you did not ask to reset your password, you can ignore this email — your password stays as it is, and the link above will expire on its own.';

  const text = [
    `Hi ${name},`,
    '',
    'Use the link below to choose a new Scorelo password.',
    '',
    input.resetUrl,
    '',
    `This link expires in ${expiresInMinutes} minutes and can be used once.`,
    '',
    footer,
    '',
    '— Scorelo',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <!-- Preheader: the inbox preview line. It deliberately does not contain the link, so the
       credential is not readable from a lock-screen notification. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Choose a new password. This link expires in ${expiresInMinutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
        <tr><td style="padding:28px 32px 8px 32px;">
          <p style="margin:0;font:600 18px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4f46e5;letter-spacing:-0.01em;">scorelo</p>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="margin:0 0 12px 0;font:600 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">Reset your password</h1>
          <p style="margin:0 0 8px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">Hi ${safeName},</p>
          <p style="margin:0 0 20px 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f3f46;">Click the button below to choose a new Scorelo password.</p>
        </td></tr>
        <tr><td style="padding:0 32px 20px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="border-radius:10px;background:#4f46e5;">
              <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">Choose a new password</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <p style="margin:0 0 6px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">Or copy this address into your browser:</p>
          <p style="margin:0;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#3f3f46;word-break:break-all;">${safeUrl}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px 32px;">
          <p style="margin:0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#71717a;">This link expires in ${expiresInMinutes} minutes and can only be used once.</p>
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
