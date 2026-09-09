/**
 * Read-only check that outbound email actually works.
 *
 *   npm run verify:smtp                          # connect and authenticate only
 *   SMTP_VERIFY_TO=you@example.com npm run verify:smtp   # also send one real test message
 *
 * Why this exists: SMTP is optional at startup, and deploy.sh does not check it. That is
 * deliberate — the API must keep serving audits without a mail transport — but it means a
 * deployment can run for weeks with email silently broken, and the first person to find out is a
 * customer who cannot turn on 2FA or reset their password.
 *
 * Worse, the failure is invisible from the outside. `mailerConfigured()` only asks whether the
 * variables are PRESENT; it cannot know whether the credentials are ACCEPTED. A .env with a
 * plausible-looking password passes every other check in this repo and still sends nothing.
 * This script is the only thing that closes that gap.
 *
 * It sends nothing unless SMTP_VERIFY_TO is set, and writes nothing to the database.
 *
 * NOTHING SECRET IS PRINTED: not the password, not its length, not the credentials. Only the host,
 * the port, and what the server said.
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { mailerConfigured } from '../lib/mailer.js';

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const RESET = '[0m';

function fail(message: string, hint?: string): never {
  console.error(`${RED}FAILED${RESET} ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

// ─── 1. Configuration ─────────────────────────────────────────────────
// Checked first, and reported by NAME only, so an operator can see which variable is missing
// without the value ever reaching a terminal or a CI log.
const missing = (['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'] as const).filter((key) => !process.env[key]);
if (missing.length > 0 || !mailerConfigured()) {
  fail(
    `SMTP is not configured. Missing or empty: ${missing.join(', ') || 'SMTP_HOST / SMTP_PORT / SMTP_FROM'}`,
    'Until these are set, Scorelo sends no email at all: no signup verification, no password\n' +
      'reset, and no two-factor sign-in codes. Add them to backend/.env and restart the API.',
  );
}

console.log(`Host       ${env.smtpHost}:${env.smtpPort}`);
console.log(`Encryption ${env.smtpPort === 465 ? 'implicit TLS (port 465)' : 'STARTTLS'}`);
console.log(`From       ${env.smtpFrom}`);
console.log(`Auth       ${env.smtpUser && env.smtpPassword ? 'username + password' : 'none (open relay)'}`);

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort!,
  secure: env.smtpPort === 465,
  auth: env.smtpUser && env.smtpPassword ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
});

// ─── 2. Connect and authenticate ──────────────────────────────────────
// `verify()` opens the connection and completes the AUTH exchange without sending a message, so a
// rejected password is caught here rather than discovered by a customer mid-signup.
try {
  await transporter.verify();
  console.log(`\n${GREEN}OK${RESET}   the server accepted the connection and the credentials`);
} catch (error) {
  const err = error as { code?: string; responseCode?: number; message?: string };
  const detail = err.message?.split('\n')[0] ?? String(error);

  // The three failures worth naming, because each has a different fix and guessing between them
  // is where an afternoon goes.
  const hint =
    err.code === 'EAUTH'
      ? 'The host is reachable but rejected the credentials.\n\n' +
        'For Gmail: a normal account password will NOT work — Google stopped accepting those for\n' +
        'SMTP in May 2022. You need an App Password:\n' +
        '  1. Turn on 2-Step Verification for the Google account\n' +
        '  2. Create an App Password at https://myaccount.google.com/apppasswords\n' +
        '  3. Put the 16 characters in SMTP_PASSWORD, with no spaces and no quotes\n'
      : err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ESOCKET'
        ? 'Could not reach the server. Check SMTP_HOST and SMTP_PORT, and whether the host\n' +
          'firewall allows outbound connections on that port — many providers block 25 and 587.\n'
        : undefined;

  fail(`${detail}${err.responseCode ? ` (SMTP ${err.responseCode})` : ''}`, hint);
}

// ─── 3. Optionally send one real message ──────────────────────────────
// Opt-in, because a verification run should not put mail in someone's inbox unless asked.
const to = process.env.SMTP_VERIFY_TO;
if (!to) {
  console.log(
    `${YELLOW}NOTE${RESET} no message was sent. To send a real test message:\n` +
      '       SMTP_VERIFY_TO=you@example.com npm run verify:smtp',
  );
  process.exit(0);
}

try {
  const info = await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject: 'Scorelo SMTP test',
    text: 'This is a test message from Scorelo. If you are reading it, outbound email works.',
    html: '<p>This is a test message from Scorelo. If you are reading it, outbound email works.</p>',
  });
  // Message id only, matching lib/mailer.ts — the recipient is not logged.
  console.log(`${GREEN}OK${RESET}   test message accepted for delivery (id ${info.messageId})`);
  console.log('\nCheck the inbox — including the spam folder.');
} catch (error) {
  fail(
    `the server authenticated but refused the message: ${(error as Error).message.split('\n')[0]}`,
    'A common cause is SMTP_FROM using an address the account is not allowed to send as.\n',
  );
}
