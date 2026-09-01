import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { after, describe, it } from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { insertReturning } from '../db/returning.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { RESET_TOKEN_TTL_MS, resetPassword } from '../services/password-reset.service.js';
import { buildPasswordResetEmail } from '../lib/emails/passwordReset.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import { ApiError } from '../middleware/error.js';
import bcrypt from 'bcryptjs';

// Integration test against the real database, mirroring runner.integration.test.ts. Nothing is
// stubbed except the passage of time (expiry is set directly), because the properties under test
// — one-time use, expiry, transactional consistency — only mean anything against real SQL.

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Creates a throwaway user and returns it with the plaintext password used. */
async function makeUser(password: string) {
  const email = `pwreset-${randomBytes(6).toString('hex')}@example.test`;
  const user = await insertReturning(users, {
    fullName: 'Reset Fixture',
    email,
    passwordHash: await bcrypt.hash(password, 12),
  });
  assert.ok(user, 'fixture user must be created');
  return user;
}

/** Issues a token row directly, returning the RAW token (as the email would carry it). */
async function issueToken(userId: number, options: { expiresInMs?: number; usedAt?: Date | null } = {}) {
  const raw = randomBytes(32).toString('base64url');
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + (options.expiresInMs ?? RESET_TOKEN_TTL_MS)),
    usedAt: options.usedAt ?? null,
  });
  return raw;
}

async function currentHash(userId: number): Promise<string> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row!.passwordHash;
}

const createdUserIds: number[] = [];
async function trackedUser(password: string) {
  const user = await makeUser(password);
  createdUserIds.push(user.id);
  return user;
}

describe('password reset · schema validation', () => {
  it('normalizes the email exactly as login does', () => {
    const parsed = forgotPasswordSchema.parse({ email: '  MiXeD@Example.COM ' });
    assert.equal(parsed.email, 'mixed@example.com');
  });

  it('rejects a password shorter than the signup policy', () => {
    const result = resetPasswordSchema.safeParse({ token: 't', password: 'short', confirmPassword: 'short' });
    assert.equal(result.success, false);
  });

  it('rejects mismatched confirmation server-side, not just in the UI', () => {
    const result = resetPasswordSchema.safeParse({ token: 't', password: 'LongEnough1', confirmPassword: 'Different11' });
    assert.equal(result.success, false);
  });

  it('rejects unknown keys, consistent with the other auth schemas', () => {
    const result = resetPasswordSchema.safeParse({ token: 't', password: 'LongEnough1', confirmPassword: 'LongEnough1', admin: true });
    assert.equal(result.success, false);
  });
});

describe('password reset · token redemption', () => {
  it('sets the new password and consumes the token', async () => {
    const user = await trackedUser('OriginalPass1');
    const before = await currentHash(user.id);
    const raw = await issueToken(user.id);

    await resetPassword({ token: raw, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });

    const after = await currentHash(user.id);
    assert.notEqual(after, before, 'password hash must change');
    assert.ok(await bcrypt.compare('BrandNewPass1', after), 'new password must verify');
    assert.equal(await bcrypt.compare('OriginalPass1', after), false, 'old password must stop working');

    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, sha256(raw))).limit(1);
    assert.ok(row?.usedAt, 'token must be marked used');
  });

  it('refuses to reuse a token, even with the correct value', async () => {
    const user = await trackedUser('OriginalPass1');
    const raw = await issueToken(user.id);
    await resetPassword({ token: raw, password: 'FirstNewPass1', confirmPassword: 'FirstNewPass1' });

    await assert.rejects(
      () => resetPassword({ token: raw, password: 'SecondNewPass1', confirmPassword: 'SecondNewPass1' }),
      (error: unknown) => error instanceof ApiError && error.code === 'RESET_TOKEN_INVALID',
    );
    // And the second attempt must not have changed anything.
    assert.ok(await bcrypt.compare('FirstNewPass1', await currentHash(user.id)));
  });

  it('refuses an expired token', async () => {
    const user = await trackedUser('OriginalPass1');
    const raw = await issueToken(user.id, { expiresInMs: -1_000 });
    await assert.rejects(
      () => resetPassword({ token: raw, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' }),
      (error: unknown) => error instanceof ApiError && error.code === 'RESET_TOKEN_INVALID',
    );
    assert.ok(await bcrypt.compare('OriginalPass1', await currentHash(user.id)), 'password must be untouched');
  });

  it('refuses a token that was never issued', async () => {
    await assert.rejects(
      () => resetPassword({ token: randomBytes(32).toString('base64url'), password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' }),
      (error: unknown) => error instanceof ApiError && error.code === 'RESET_TOKEN_INVALID',
    );
  });

  it('gives the same error for missing, expired and used tokens — no oracle', async () => {
    const user = await trackedUser('OriginalPass1');
    const expired = await issueToken(user.id, { expiresInMs: -1_000 });
    const used = await issueToken(user.id, { usedAt: new Date() });
    const missing = randomBytes(32).toString('base64url');

    const messages: string[] = [];
    for (const token of [expired, used, missing]) {
      try {
        await resetPassword({ token, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });
        assert.fail('should have rejected');
      } catch (error) {
        messages.push(error instanceof ApiError ? error.message : String(error));
      }
    }
    assert.equal(new Set(messages).size, 1, 'every rejection must be indistinguishable');
  });

  it('revokes existing sessions so old refresh tokens stop working', async () => {
    const user = await trackedUser('OriginalPass1');
    await db.update(users).set({ refreshTokenHash: 'x'.repeat(64), refreshTokenExpiresAt: new Date(Date.now() + 86_400_000) }).where(eq(users.id, user.id));
    const raw = await issueToken(user.id);

    await resetPassword({ token: raw, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });

    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    assert.equal(row!.refreshTokenHash, null);
    assert.equal(row!.refreshTokenExpiresAt, null);
  });

  it('invalidates every other outstanding token for that user', async () => {
    const user = await trackedUser('OriginalPass1');
    const first = await issueToken(user.id);
    await issueToken(user.id);
    await issueToken(user.id);

    await resetPassword({ token: first, password: 'BrandNewPass1', confirmPassword: 'BrandNewPass1' });

    const stillLive = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    assert.equal(stillLive.length, 0, 'no sibling token may remain usable');
  });

  it('never stores the raw token', async () => {
    const user = await trackedUser('OriginalPass1');
    const raw = await issueToken(user.id);
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    for (const row of rows) {
      assert.notEqual(row.tokenHash, raw, 'raw token must never appear in the table');
      assert.equal(row.tokenHash.length, 64, 'stored value must be a sha256 hex digest');
    }
  });
});

describe('password reset · email', () => {
  const built = buildPasswordResetEmail({
    to: 'someone@example.test',
    fullName: 'Ada Lovelace',
    resetUrl: 'https://scorelo-staging.tlxapps.com/reset-password?token=abc123',
    expiresInMinutes: 30,
  });

  it('carries the reset URL in both the HTML and plain-text parts', () => {
    assert.match(built.html, /reset-password\?token=abc123/);
    assert.match(built.text, /reset-password\?token=abc123/);
  });

  it('states the expiry so the limited lifetime is not a surprise', () => {
    assert.match(built.text, /30 minutes/);
  });

  it('escapes the display name so a crafted name cannot inject markup', () => {
    const hostile = buildPasswordResetEmail({
      to: 'x@example.test',
      fullName: '<img src=x onerror=alert(1)>',
      resetUrl: 'https://example.test/reset-password?token=t',
      expiresInMinutes: 30,
    });
    assert.equal(/<img/.test(hostile.html), false);
    assert.match(hostile.html, /&lt;img/);
  });
});

after(async () => {
  // Targeted cleanup of only the fixtures this file created. Tokens cascade with the user.
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await pool.end();
});
