import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * ─── One-time codes and reset tickets ────────────────────────────────
 *
 * Two credential shapes live here because they need two different hashes, and picking the wrong
 * one is the classic way an OTP system fails silently:
 *
 *   6-DIGIT OTP  →  bcrypt.   Only 1,000,000 possible values. Against a fast digest an attacker
 *                             who dumps the table enumerates the whole space in milliseconds, so
 *                             the hash itself has to be slow.
 *   256-BIT TICKET → SHA-256. There is nothing to slow down: the input is already high-entropy
 *                             CSPRNG output, and lookup must stay an indexed point-read.
 *
 * The same reasoning is why auth.service.ts and password-reset.service.ts hash refresh and reset
 * tokens with SHA-256 — those are high-entropy too. This file does not change that; it adds the
 * low-entropy case those helpers were never meant to cover.
 *
 * NOTHING HERE IS EVER LOGGED. A raw code exists only in the value returned to the caller and in
 * the outgoing email; a raw ticket only in the value returned to the caller and the API response
 * that hands it back once.
 */

/** Digits in a one-time code. Six is what customers can read out of an email without transcribing
 * errors; the attempt limit and expiry — not length — are what make it safe. */
const OTP_LENGTH = 6;

/** Matches SALT_ROUNDS in auth.service.ts and password-reset.service.ts. All three must move
 * together, or one path would silently write a weaker hash than the others. */
const OTP_SALT_ROUNDS = 12;

/** 32 bytes = 256 bits from the OS CSPRNG, same size as the existing password-reset token. */
const TICKET_BYTES = 32;

/**
 * A cryptographically random one-time code, zero-padded to a fixed width.
 *
 * `randomInt` is used rather than `randomBytes % 1e6`: the modulo form is biased, because 2^n is
 * never a multiple of 1,000,000, so some codes would be measurably likelier than others.
 * `randomInt` rejects-and-retries internally and is uniform over the range.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** True for a string of exactly OTP_LENGTH ASCII digits — the only shape a code is ever given. */
export function isOtpShaped(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

export function otpLength(): number {
  return OTP_LENGTH;
}

/** Hashes a code for storage. Only the result is ever persisted. */
export function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, OTP_SALT_ROUNDS);
}

/**
 * Compares a submitted code against a stored hash.
 *
 * bcrypt.compare is constant-time for a given hash, so a wrong code leaks nothing through timing.
 * Never throws on a malformed stored value — a corrupt row must read as "does not match" rather
 * than as a 500 that tells the caller something about the record.
 */
export async function verifyOtp(code: string, storedHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(code, storedHash);
  } catch {
    return false;
  }
}

/** URL-safe, no padding — survives being placed in a JSON body or a query string unescaped. */
export function generateTicket(): string {
  return randomBytes(TICKET_BYTES).toString('base64url');
}

/** SHA-256 hex of a high-entropy ticket. Same construction the refresh and reset tokens use. */
export function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
