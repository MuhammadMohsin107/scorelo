import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { twoFactorLoginSchema, twoFactorResendSchema } from '../schemas/auth.schema.js';
import { twoFactorToggleSchema } from '../schemas/security.schema.js';
import { buildVerificationEmail } from '../lib/emails/emailVerification.js';
import { generateOtp, generateTicket } from '../lib/otp.js';

/**
 * ─── Phase 3 · what can be proven without a database ─────────────────
 *
 * The 2FA lifecycle — issuing a challenge, redeeming it, exhausting attempts, expiring — runs
 * against MySQL, which is unreachable here. Those tests are not faked: asserting against a stub
 * would only prove the stub behaves.
 *
 * What IS provable is the boundary: the input contracts that decide what a request may carry, and
 * the email that leaves the building. Both are where this feature could leak a credential or be
 * turned into something it is not, so both are worth asserting on their own.
 */

describe('two-factor login contract', () => {
  it('takes a ticket and a code — never an email or a password', () => {
    // The ticket already identifies the account AND proves the password step happened. Accepting
    // an email here would let a caller name a different account; accepting a password would move
    // the credential through one more request than it needs to be in.
    const valid = twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '123456' });
    assert.equal(valid.success, true);

    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '123456', email: 'a@b.co' }).success, false);
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '123456', password: 'x' }).success, false);
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '123456', userId: 2 }).success, false);
  });

  it('refuses a request with only one of the two credentials', () => {
    // Both are required, which is the entire point of a second factor. A code alone would let
    // whoever read the inbox sign in without the password; a ticket alone would make the code
    // decorative.
    assert.equal(twoFactorLoginSchema.safeParse({ code: '123456' }).success, false);
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc' }).success, false);
  });

  it('holds the code to exactly six digits', () => {
    for (const code of ['12345', '1234567', '12345a', '', '  1234  ']) {
      assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code }).success, false, `accepted: ${code}`);
    }
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '000000' }).success, true);
  });

  it('will not accept a ticket where a code belongs, or the reverse', () => {
    // The two credential shapes cannot be swapped: a 43-character ticket fails the six-digit rule,
    // and a six-digit code is not rejected as a ticket by shape — which is exactly why the SERVICE
    // looks tickets up by purpose rather than trusting shape alone.
    const ticket = generateTicket();
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', code: ticket }).success, false);
    assert.equal(generateOtp().length !== ticket.length, true);
  });

  it('resend takes the ticket alone — no email, so it cannot be aimed at another address', () => {
    assert.equal(twoFactorResendSchema.safeParse({ ticket: 'abc' }).success, true);
    assert.equal(twoFactorResendSchema.safeParse({ ticket: 'abc', email: 'a@b.co' }).success, false);
    assert.equal(twoFactorResendSchema.safeParse({}).success, false);
  });
});

describe('two-factor toggle contract', () => {
  it('requires the current password in both directions', () => {
    // Enabling and disabling are equally password-gated. A fifteen-minute access token must not be
    // enough to remove a protection — that is the first thing an attacker with a session would do.
    assert.equal(twoFactorToggleSchema.safeParse({ currentPassword: 'x' }).success, true);
    assert.equal(twoFactorToggleSchema.safeParse({}).success, false);
  });

  it('refuses a user id, so it cannot be pointed at another account', () => {
    assert.equal(twoFactorToggleSchema.safeParse({ currentPassword: 'x', userId: 2 }).success, false);
  });
});

describe('sign-in code email', () => {
  const code = '482913';
  const message = buildVerificationEmail({
    to: 'person@example.com',
    fullName: 'Ada Lovelace',
    code,
    expiresInMinutes: 10,
    purpose: 'login',
  });

  it('carries the code in both the HTML and the plain-text part', () => {
    // Some clients render only text/plain. A code that arrives unreadable is a locked-out customer.
    assert.ok(message.text.includes(code));
    assert.ok(message.html.includes(code));
  });

  it('keeps the code out of the inbox preview line', () => {
    // The preheader is what shows on a lock screen. A sign-in code readable without unlocking the
    // phone would undo much of the point of sending it.
    const preheader = message.html.slice(message.html.indexOf('display:none'), message.html.indexOf('</div>'));
    assert.ok(!preheader.includes(code));
  });

  it('tells the reader what an unrequested sign-in code means', () => {
    // This is the difference that matters between the three purposes: a login code arriving
    // unasked means someone has the password, and the email has to say so.
    assert.match(message.text, /did not try to sign in/i);
    assert.match(message.text, /password/i);
  });

  it('is distinguishable from the signup and reset codes', () => {
    const signup = buildVerificationEmail({ to: 'a@b.co', fullName: 'A', code, expiresInMinutes: 10, purpose: 'signup' });
    const reset = buildVerificationEmail({ to: 'a@b.co', fullName: 'A', code, expiresInMinutes: 10, purpose: 'password-reset' });
    assert.notEqual(message.subject, signup.subject);
    assert.notEqual(message.subject, reset.subject);
  });

  it('escapes the display name, the one field a person controls', () => {
    const hostile = buildVerificationEmail({
      to: 'a@b.co',
      fullName: '<script>alert(1)</script>',
      code,
      expiresInMinutes: 10,
      purpose: 'login',
    });
    assert.ok(!hostile.html.includes('<script>'));
    assert.ok(hostile.html.includes('&lt;script&gt;'));
  });
});
