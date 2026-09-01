import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

/**
 * ─── Outbound email ──────────────────────────────────────────────────
 * Plain SMTP via nodemailer. Deliberately not a hosted email API: password reset is an
 * authentication primitive, and Scorelo owns its authentication end to end.
 *
 * NOT CONFIGURED IS A REAL STATE, NOT AN ERROR.
 * SMTP is optional at startup so the rest of the API keeps working without it, mirroring how
 * `shopifyConfigured()` gates the Shopify routes. What must never happen is a caller being told
 * an email was sent when no transport exists — `sendMail` throws in that case, and the
 * password-reset service turns it into a logged server-side failure rather than a false success.
 *
 * NOTHING SECRET IS EVER LOGGED: not the SMTP password, not the recipient's token, not the URL
 * that carries it. Log lines carry the message id and nothing more.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** True when every SMTP value needed to actually connect is present. */
export function mailerConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpFrom);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (!mailerConfigured()) {
    throw new Error('SMTP is not configured (SMTP_HOST / SMTP_PORT / SMTP_FROM)');
  }
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort!,
    // Implicit TLS on 465; STARTTLS is negotiated on 587/25. Driving this off the port rather
    // than a separate flag removes a way to misconfigure the pair into a silent plaintext send.
    secure: env.smtpPort === 465,
    // Some relays (internal MTAs, MailHog, ses-smtp with IAM) take no credentials at all.
    auth: env.smtpUser && env.smtpPassword ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  });
  return transporter;
}

/**
 * Sends one message. Throws on failure — callers decide whether a delivery failure should surface
 * to the customer, and for password reset it deliberately does not (see the enumeration note in
 * password-reset.service.ts).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const info = await getTransporter().sendMail({
    from: env.smtpFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  // Message id only. The recipient address is intentionally omitted: reset mail proves an account
  // exists, and logs are read by more people than the database is.
  console.log(`[scorelo-mail] sent message ${info.messageId}`);
}

/** Verifies the SMTP connection without sending. Used by the startup/diagnostic path. */
export async function verifyMailer(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}
