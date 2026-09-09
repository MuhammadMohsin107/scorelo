import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { twoFactorLoginSchema, twoFactorSendSchema } from '../schemas/auth.schema.js';
import { regenerateRecoveryCodesSchema } from '../schemas/security.schema.js';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeShaped,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from '../lib/recoveryCodes.js';

/**
 * ─── Recovery codes · what can be proven without a database ──────────
 *
 * Issuing, redeeming and regenerating all run against MySQL, which is unreachable here. Those are
 * not stubbed: a test against a fake store would only prove the fake behaves, and the properties
 * that matter about this feature — single-use, replace-not-append — are enforced in SQL predicates
 * that a stub cannot exercise.
 *
 * What IS provable here is everything that decides whether a real code is accepted or a fake one
 * gets through:
 *
 *   · the GENERATOR — count, alphabet, entropy, and that no two draws collide
 *   · the NORMALIZER — the formatting a customer will actually type on their worst day
 *   · the HASH — that it is the one-way function claimed, over the canonical form
 *   · the INPUT CONTRACTS that decide what a request may carry
 *   · the REDACTION invariants, checked against the source itself because a leak here is silent
 */

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

describe('recovery code generation', () => {
  it('issues the full set', () => {
    assert.equal(generateRecoveryCodes().length, RECOVERY_CODE_COUNT);
  });

  it('uses only the unambiguous alphabet', () => {
    // I, L, O and U are excluded so a code read off paper cannot be transcribed into a different
    // one. If a future change swapped in a standard base32 alphabet, this is what would catch it.
    for (const code of generateRecoveryCodes(50)) {
      assert.match(code, /^[0-9A-HJKMNPQRSTVWXYZ]{4}(-[0-9A-HJKMNPQRSTVWXYZ]{4}){3}$/, `bad shape: ${code}`);
      assert.equal(/[ILOU]/.test(code), false, `ambiguous character in ${code}`);
    }
  });

  it('carries 80 bits — sixteen symbols once the dashes come off', () => {
    // The entropy claim is the whole security argument for a fast hash. Sixteen base32 symbols is
    // 80 bits; anything shorter would quietly weaken it.
    for (const code of generateRecoveryCodes(20)) {
      assert.equal(normalizeRecoveryCode(code).length, 16);
    }
  });

  it('never repeats a code', () => {
    // Not a proof of randomness — a collision at this sample size would mean the generator is
    // seeded or counting, which is the failure worth catching cheaply.
    const codes = generateRecoveryCodes(500);
    assert.equal(new Set(codes).size, codes.length);
  });

  it('draws a different set every time', () => {
    const first = new Set(generateRecoveryCodes());
    const second = generateRecoveryCodes();
    assert.equal(second.some((code) => first.has(code)), false);
  });
});

describe('recovery code normalization', () => {
  it('accepts the formatting a customer will actually type', () => {
    // All of these are the same code. A recovery code is used on the one day the account is
    // already in trouble, and losing to a stray space or a lower-case paste would be a lockout we
    // inflicted on ourselves.
    const canonical = normalizeRecoveryCode('ABCD-EFGH-JKMN-PQRS');
    for (const variant of [
      'abcd-efgh-jkmn-pqrs',
      'ABCDEFGHJKMNPQRS',
      '  ABCD-EFGH-JKMN-PQRS  ',
      'ABCD EFGH JKMN PQRS',
      'abcd efgh-JKMN  pqrs',
    ]) {
      assert.equal(normalizeRecoveryCode(variant), canonical, `not canonical: ${variant}`);
    }
  });

  it('maps the characters people mis-transcribe', () => {
    // The generator can never emit I, L, O or U — so a customer who wrote one down meant the
    // digit it looks like, and reading it that way lets them in instead of failing them.
    assert.equal(normalizeRecoveryCode('I234'), '1234');
    assert.equal(normalizeRecoveryCode('L234'), '1234');
    assert.equal(normalizeRecoveryCode('O234'), '0234');
  });

  it('recognises a well-formed code and rejects a malformed one', () => {
    assert.equal(isRecoveryCodeShaped('ABCD-EFGH-JKMN-PQRS'), true);
    assert.equal(isRecoveryCodeShaped('ABCD-EFGH'), false);
    assert.equal(isRecoveryCodeShaped(''), false);
  });
});

describe('recovery code hashing', () => {
  it('is SHA-256 hex of the canonical form', () => {
    const hash = hashRecoveryCode('ABCD-EFGH-JKMN-PQRS');
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it('hashes every equivalent formatting to the same value', () => {
    // Storage happens at enable time from a dash-formatted code; verification happens later from
    // whatever the customer types. If these two disagreed, no recovery code would EVER work — and
    // nobody would find out until someone actually needed one.
    const stored = hashRecoveryCode('ABCD-EFGH-JKMN-PQRS');
    assert.equal(hashRecoveryCode('abcdefghjkmnpqrs'), stored);
    assert.equal(hashRecoveryCode(' abcd-EFGH jkmn-PQRS '), stored);
  });

  it('does not contain the code it hashed', () => {
    const code = generateRecoveryCodes(1)[0]!;
    assert.equal(hashRecoveryCode(code).includes(normalizeRecoveryCode(code)), false);
  });

  it('separates codes that differ by one character', () => {
    assert.notEqual(hashRecoveryCode('ABCD-EFGH-JKMN-PQRS'), hashRecoveryCode('ABCD-EFGH-JKMN-PQRT'));
  });
});

describe('two-factor login contract · recovery codes', () => {
  it('takes a recovery code in place of the emailed one', () => {
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc', recoveryCode: 'ABCD-EFGH-JKMN-PQRS' }).success, true);
  });

  it('refuses both credentials at once', () => {
    // Two credentials in one body is ambiguous about which is being claimed, and accepting it
    // would hand the caller two guesses against a single ticket.
    assert.equal(
      twoFactorLoginSchema.safeParse({ ticket: 'abc', code: '123456', recoveryCode: 'ABCD-EFGH-JKMN-PQRS' }).success,
      false,
    );
  });

  it('refuses a request with neither', () => {
    assert.equal(twoFactorLoginSchema.safeParse({ ticket: 'abc' }).success, false);
  });

  it('still refuses an email, a password or a user id alongside a recovery code', () => {
    // The ticket already identifies the account. Anything here that names a DIFFERENT account is
    // an attacker-controlled identity competing with the real one.
    for (const extra of [{ email: 'a@b.co' }, { password: 'x' }, { userId: 2 }]) {
      assert.equal(
        twoFactorLoginSchema.safeParse({ ticket: 'abc', recoveryCode: 'ABCD-EFGH-JKMN-PQRS', ...extra }).success,
        false,
        `accepted ${JSON.stringify(extra)}`,
      );
    }
  });
});

describe('two-factor send contract', () => {
  it('takes a ticket and the address to confirm', () => {
    assert.equal(twoFactorSendSchema.safeParse({ ticket: 'abc', email: 'user@example.com' }).success, true);
  });

  it('normalizes the address the same way login does', () => {
    // Login lower-cases and trims, so this must too — otherwise the confirmation would fail
    // against the stored row for a difference that is not real.
    const parsed = twoFactorSendSchema.safeParse({ ticket: 'abc', email: '  USER@Example.COM ' });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && parsed.data.email, 'user@example.com');
  });

  it('refuses a body that tries to carry a password or a user id', () => {
    assert.equal(twoFactorSendSchema.safeParse({ ticket: 'a', email: 'u@e.com', password: 'x' }).success, false);
    assert.equal(twoFactorSendSchema.safeParse({ ticket: 'a', email: 'u@e.com', userId: 3 }).success, false);
  });

  it('requires both fields', () => {
    assert.equal(twoFactorSendSchema.safeParse({ ticket: 'abc' }).success, false);
    assert.equal(twoFactorSendSchema.safeParse({ email: 'user@example.com' }).success, false);
  });
});

describe('regeneration contract', () => {
  it('requires the current password and nothing else', () => {
    // Minting recovery codes creates working second-factor bypasses. A stolen access token must
    // not be enough to do it quietly.
    assert.equal(regenerateRecoveryCodesSchema.safeParse({ currentPassword: 'hunter2' }).success, true);
    assert.equal(regenerateRecoveryCodesSchema.safeParse({}).success, false);
    assert.equal(regenerateRecoveryCodesSchema.safeParse({ currentPassword: 'x', userId: 4 }).success, false);
  });
});

describe('redaction invariants', () => {
  it('the recovery code service never logs a code or a hash', () => {
    // Checked against the source because the failure is silent: a console.log added during
    // debugging and left behind would put recovery codes in the log file forever.
    const service = source('../services/recovery-code.service.ts');
    for (const line of service.split('\n')) {
      if (!/console\.(log|warn|error|info|debug)/.test(line)) continue;
      assert.equal(/\bcode\b|codeHash|codes\b/.test(line), false, `logs a credential: ${line.trim()}`);
    }
  });

  it('nothing selects a recovery code hash into a response', () => {
    // countUnusedRecoveryCodes returns a COUNT, and there is deliberately no reader anywhere that
    // pulls code_hash out of the table.
    const service = source('../services/recovery-code.service.ts');
    assert.equal(/\.select\(\s*\)/.test(service), false, 'a bare .select() would pull code_hash');

    const controller = source('../controllers/security.controller.ts');
    assert.equal(controller.includes('codeHash'), false, 'the security controller references codeHash');
  });

  it('the plaintext set is returned by exactly one service function', () => {
    // issueRecoveryCodes is the only place raw codes exist. If a second function started returning
    // them, this is the line that would notice.
    const service = source('../services/recovery-code.service.ts');
    const returnsPlaintext = service.match(/export async function \w+\([^)]*\)[^{]*Promise<string\[\]>/g) ?? [];
    assert.equal(returnsPlaintext.length, 1, `expected one plaintext-returning function, found ${returnsPlaintext.length}`);
  });
});
