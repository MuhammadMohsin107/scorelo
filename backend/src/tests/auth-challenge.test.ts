import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateOtp,
  generateTicket,
  hashOtp,
  hashTicket,
  isOtpShaped,
  otpLength,
  verifyOtp,
} from '../lib/otp.js';

/**
 * ─── OTP and ticket primitives ───────────────────────────────────────
 *
 * These are the parts of the challenge system that can be proven without a database: generation,
 * shape, hashing and comparison. Everything stateful — expiry, single-use, attempt counting,
 * superseding — lives in auth-challenge.service.ts and is exercised by the integration suite,
 * because asserting it against a fake store would only prove the fake behaves.
 *
 * The properties asserted here are the ones whose failure would be silent in production: an OTP
 * that is guessable, one that is stored recoverably, or a comparison that accepts the wrong value.
 */

describe('one-time codes', () => {
  it('is always exactly six digits', () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateOtp();
      assert.equal(code.length, otpLength());
      assert.match(code, /^\d{6}$/, `generated a non-numeric code: ${code}`);
    }
  });

  it('keeps leading zeros rather than producing a short code', () => {
    // A naive String(randomInt(...)) drops them, which would leak that the value is small and
    // shrink the effective space. 2000 draws makes at least one sub-100000 value overwhelmingly
    // likely, and every draw is length-checked above.
    const codes = Array.from({ length: 2000 }, generateOtp);
    assert.ok(codes.every((code) => code.length === 6));
    assert.ok(codes.some((code) => code.startsWith('0')), 'no zero-prefixed code in 2000 draws');
  });

  it('spreads across the range rather than clustering', () => {
    // Not a statistical proof of uniformity — that is randomInt's job. This catches the gross
    // failure where a generator returns a constant or a tiny cycle.
    const unique = new Set(Array.from({ length: 1000 }, generateOtp));
    assert.ok(unique.size > 900, `only ${unique.size} distinct codes in 1000 draws`);
  });

  it('recognises a well-formed code and rejects everything else', () => {
    assert.equal(isOtpShaped('000000'), true);
    assert.equal(isOtpShaped('123456'), true);
    assert.equal(isOtpShaped('12345'), false);
    assert.equal(isOtpShaped('1234567'), false);
    assert.equal(isOtpShaped('12345a'), false);
    assert.equal(isOtpShaped(''), false);
    assert.equal(isOtpShaped(' 123456 '), false);
  });
});

describe('one-time code hashing', () => {
  it('never stores the code in recoverable form', async () => {
    const code = generateOtp();
    const hash = await hashOtp(code);
    assert.notEqual(hash, code);
    assert.ok(!hash.includes(code), 'the raw code appears inside its own hash');
    // bcrypt, not a fast digest: only a million codes exist, so the hash itself must be slow.
    assert.match(hash, /^\$2[aby]\$\d{2}\$/, `expected a bcrypt hash, got: ${hash.slice(0, 8)}…`);
  });

  it('produces a different hash each time, so equal codes are not linkable', async () => {
    const code = generateOtp();
    assert.notEqual(await hashOtp(code), await hashOtp(code));
  });

  it('accepts the correct code', async () => {
    const code = generateOtp();
    assert.equal(await verifyOtp(code, await hashOtp(code)), true);
  });

  it('rejects a wrong code', async () => {
    const hash = await hashOtp('123456');
    assert.equal(await verifyOtp('123457', hash), false);
    assert.equal(await verifyOtp('654321', hash), false);
    assert.equal(await verifyOtp('', hash), false);
  });

  it('treats a corrupt stored hash as a mismatch rather than throwing', async () => {
    // A malformed row must read as "does not match". Throwing would turn into a 500 that tells
    // the caller something about the record.
    assert.equal(await verifyOtp('123456', 'not-a-bcrypt-hash'), false);
    assert.equal(await verifyOtp('123456', ''), false);
  });
});

describe('reset tickets', () => {
  it('carries far more entropy than a typed code', () => {
    const ticket = generateTicket();
    // 32 random bytes in base64url ⇒ 43 characters, no padding.
    assert.equal(ticket.length, 43);
    assert.match(ticket, /^[A-Za-z0-9_-]+$/, 'ticket is not URL-safe');
  });

  it('never repeats', () => {
    const unique = new Set(Array.from({ length: 1000 }, generateTicket));
    assert.equal(unique.size, 1000);
  });

  it('hashes with SHA-256 so it stays an indexed point-read', () => {
    const ticket = generateTicket();
    const hash = hashTicket(ticket);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, ticket);
    // Deterministic on purpose: unlike an OTP, a ticket is looked up BY hash, because whoever
    // presents it has not otherwise identified themselves.
    assert.equal(hashTicket(ticket), hash);
    assert.notEqual(hashTicket(generateTicket()), hash);
  });
});

describe('credential separation', () => {
  it('hashes the two credential shapes differently', async () => {
    // The whole point of lib/otp.ts. A six-digit code under SHA-256 would fall to enumeration in
    // milliseconds from a table dump; a 256-bit ticket under bcrypt could not be searched at all.
    const otpHash = await hashOtp(generateOtp());
    const ticketHash = hashTicket(generateTicket());
    assert.match(otpHash, /^\$2[aby]\$/, 'OTP must be bcrypt-hashed');
    assert.match(ticketHash, /^[0-9a-f]{64}$/, 'ticket must be SHA-256-hashed');
  });

  it('makes a code unusable as a ticket', () => {
    // A code can never be mistaken for the credential that authorises a password change: they are
    // stored under different purposes and looked up by different means. This asserts the shapes
    // cannot collide even before that.
    const code = generateOtp();
    assert.notEqual(code.length, generateTicket().length);
    assert.equal(isOtpShaped(generateTicket()), false);
  });
});
