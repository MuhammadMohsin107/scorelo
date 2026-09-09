import { createHash, randomBytes } from 'node:crypto';

/**
 * ─── Recovery codes ──────────────────────────────────────────────────
 *
 * The third credential shape in this codebase, and it belongs to the same rule the other two follow
 * (see lib/otp.ts, which states it): the HASH IS CHOSEN BY THE ENTROPY OF THE INPUT.
 *
 *   6-DIGIT OTP     →  bcrypt.    A million values. The hash itself must be slow.
 *   256-BIT TICKET  →  SHA-256.   High-entropy CSPRNG output; nothing to slow down.
 *   RECOVERY CODE   →  SHA-256.   80 bits of CSPRNG output — the same reasoning as the ticket.
 *
 * The bcrypt temptation is worth naming, because "hash it with the strong one" sounds safer and is
 * not: verification has to test a submitted code against every unused code on the account, so
 * bcrypt would mean up to ten deliberately-slow hashes per login attempt. That is a
 * denial-of-service lever pointed at our own sign-in endpoint, bought for no security — 2^80 is
 * already far outside what anyone brute-forces to reach one account.
 *
 * NOTHING HERE IS EVER LOGGED. A raw code exists in the response that hands the set to the customer
 * exactly once, and nowhere else.
 */

/**
 * How many codes are issued at once.
 *
 * Ten is the common choice across the industry. Enough that a few lost to a bad printout do not
 * matter; few enough that a person can actually store them.
 */
export const RECOVERY_CODE_COUNT = 10;

/** 10 bytes = 80 bits of CSPRNG output per code. */
const RECOVERY_CODE_BYTES = 10;

/**
 * Crockford's base32 alphabet: no I, L, O or U.
 *
 * I/1 and O/0 are the pairs people transcribe wrongly off a printed page, and U is dropped so a
 * random draw cannot spell something unfortunate. This costs nothing — the entropy comes from the
 * byte count, not the alphabet — and it means a customer copying a code by hand under pressure gets
 * it right.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Groups of four, dash-separated, purely for legibility. Dashes are not part of the secret. */
const GROUP_SIZE = 4;

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  // 80 bits divides evenly into sixteen 5-bit symbols, so this tail never runs at the current size.
  // Kept so the helper stays correct if RECOVERY_CODE_BYTES ever changes.
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/**
 * A fresh set of recovery codes, formatted for a human to copy.
 *
 * `randomBytes` is the OS CSPRNG — the same source the reset tickets use. Nothing here derives a
 * code from the user id, the time, or anything else predictable.
 *
 * The plaintext returned is shown to the customer ONCE. After this call only the hashes exist, so
 * a set that is not saved cannot be recovered by us — which is exactly the property that makes the
 * codes worth having, and exactly why the UI has to say so before the customer navigates away.
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = encodeBase32(randomBytes(RECOVERY_CODE_BYTES));
    const groups: string[] = [];
    for (let index = 0; index < raw.length; index += GROUP_SIZE) {
      groups.push(raw.slice(index, index + GROUP_SIZE));
    }
    return groups.join('-');
  });
}

/**
 * Canonicalises a code as typed.
 *
 * Customers paste codes with the dashes, without them, in lower case, and with a stray space picked
 * up from a PDF. Those are all the same code and all must verify — a recovery code is used on the
 * worst day of someone's account, and losing to a formatting difference would be a self-inflicted
 * lockout.
 *
 * The ambiguous-character mapping is the read direction of the alphabet choice above: someone who
 * writes `O` for `0`, or `l` for `1`, still gets in, because the generator can never have emitted
 * the letters they typed.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

/** SHA-256 hex of the canonical form. Only this ever reaches the database. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

/**
 * The shape a code has once normalized: exactly sixteen symbols from the alphabet.
 *
 * A validation convenience at the edge, NOT a security control — rejecting a malformed value here
 * and failing to match it in the service surface as the same single failure to the caller.
 */
export function isRecoveryCodeShaped(input: string): boolean {
  return /^[0-9A-Z]{16}$/.test(normalizeRecoveryCode(input));
}
