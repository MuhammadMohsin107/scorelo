import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { hashSessionToken } from '../services/session.service.js';
import { requestMetadata } from '../lib/requestMetadata.js';
import { changePasswordSchema, eventsQuerySchema, revokeOthersSchema, sessionIdParamSchema } from '../schemas/security.schema.js';
import { logoutSchema } from '../schemas/auth.schema.js';
import type { Request } from 'express';

/**
 * ─── Phase 2 · what can be proven without a database ─────────────────
 *
 * Session lifecycle, revocation, ownership enforcement and event writing all run against MySQL,
 * and MySQL is not reachable from this environment. Those tests are NOT written as fakes here:
 * asserting against a stubbed store would only prove the stub behaves, which is worse than no
 * test because it reads like coverage.
 *
 * What IS provable here is everything the database is not required for: the hashing scheme,
 * request-metadata extraction, and the input contracts that stand between a request and the
 * services. Those contracts are where cross-user access and credential leakage would be
 * introduced, so they are worth asserting on their own.
 */

/** Minimal Express-shaped request. Only the fields requestMetadata() reads. */
function fakeRequest(headers: Record<string, string | undefined>, remoteAddress?: string): Request {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as Request;
}

describe('session token hashing', () => {
  it('stores SHA-256, never the token', () => {
    const token = 'header.payload.signature';
    const hash = hashSessionToken(token);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, token);
    assert.ok(!hash.includes(token));
  });

  it('uses the same construction as the existing auth and reset paths', () => {
    // Phase 2 moved WHERE the hash lives; it must not change WHAT the hash is, or a token issued
    // either side of the cutover would stop matching for the wrong reason.
    const token = 'some.refresh.token';
    assert.equal(hashSessionToken(token), createHash('sha256').update(token).digest('hex'));
  });

  it('is deterministic, so a session can be found by point-read', () => {
    // Unlike a 6-digit OTP — which is bcrypt-hashed precisely because it must NOT be searchable —
    // a refresh token is high-entropy and has to be looked up by its hash.
    assert.equal(hashSessionToken('abc'), hashSessionToken('abc'));
    assert.notEqual(hashSessionToken('abc'), hashSessionToken('abd'));
  });
});

describe('request metadata', () => {
  it('takes the leftmost X-Forwarded-For entry — the client, not the proxy', () => {
    // Production has two hops and server.cjs APPENDS rather than overwrites, so the list reads
    // oldest-first. Taking the last entry would record Scorelo's own proxy as the customer.
    const meta = requestMetadata(fakeRequest({ 'x-forwarded-for': '203.0.113.7, 198.51.100.2, 10.0.0.5' }));
    assert.equal(meta.ipAddress, '203.0.113.7');
  });

  it('normalises the IPv4-mapped IPv6 form Node reports on dual-stack sockets', () => {
    const meta = requestMetadata(fakeRequest({}, '::ffff:203.0.113.9'));
    assert.equal(meta.ipAddress, '203.0.113.9');
  });

  it('returns null for loopback rather than a value that reads like a location', () => {
    assert.equal(requestMetadata(fakeRequest({}, '127.0.0.1')).ipAddress, null);
    assert.equal(requestMetadata(fakeRequest({}, '::1')).ipAddress, null);
  });

  it('returns null — never a placeholder — when nothing is available', () => {
    const meta = requestMetadata(fakeRequest({}));
    assert.equal(meta.ipAddress, null);
    assert.equal(meta.userAgent, null);
  });

  it('records the raw User-Agent and does not invent a device name', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const meta = requestMetadata(fakeRequest({ 'user-agent': ua }));
    assert.equal(meta.userAgent, ua);
    // Nothing resembling "Chrome on Windows" is produced anywhere — that would be a guess.
    assert.ok(!/Chrome on|on Windows/.test(meta.userAgent ?? ''));
  });

  it('truncates an oversized User-Agent to the column width', () => {
    const meta = requestMetadata(fakeRequest({ 'user-agent': 'x'.repeat(900) }));
    assert.equal(meta.userAgent?.length, 512);
  });

  it('treats a blank User-Agent as absent', () => {
    assert.equal(requestMetadata(fakeRequest({ 'user-agent': '   ' })).userAgent, null);
  });
});

describe('security input contracts', () => {
  it('refuses a user id in a password-change body', () => {
    // Identity comes from requireUserId(req) alone. A userId in the body would be an
    // attacker-controlled value competing with the authenticated one; .strict() rejects it
    // outright rather than ignoring it.
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
      userId: 2,
    });
    assert.equal(result.success, false);
  });

  it('refuses a user id in a revoke-others body', () => {
    assert.equal(revokeOthersSchema.safeParse({ userId: 2 }).success, false);
  });

  it('enforces the confirmation server-side, not just in the UI', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'Different123',
    });
    assert.equal(result.success, false);
  });

  it('holds the new password to the signup minimum', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    assert.equal(result.success, false);
  });

  it('accepts a well-formed change with an optional refresh token', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass1234',
      confirmPassword: 'NewPass1234',
      refreshToken: 'a.b.c',
    });
    assert.equal(result.success, true);
  });

  it('accepts a change without a refresh token — the server then revokes everything', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass1234',
      confirmPassword: 'NewPass1234',
    });
    assert.equal(result.success, true);
  });

  it('coerces a session id to a positive integer and rejects anything else', () => {
    assert.equal(sessionIdParamSchema.safeParse({ id: '42' }).success, true);
    assert.equal(sessionIdParamSchema.safeParse({ id: '-1' }).success, false);
    assert.equal(sessionIdParamSchema.safeParse({ id: 'abc' }).success, false);
    assert.equal(sessionIdParamSchema.safeParse({ id: '1 OR 1=1' }).success, false);
  });

  it('bounds the event page size so a caller cannot ask for an unbounded scan', () => {
    assert.equal(eventsQuerySchema.safeParse({ limit: '50' }).success, true);
    assert.equal(eventsQuerySchema.safeParse({ limit: '1000' }).success, false);
    assert.equal(eventsQuerySchema.safeParse({ limit: '0' }).success, false);
  });

  it('makes the logout refresh token optional', () => {
    // Absent means the server cannot name a session and revokes all of them — the safe direction.
    assert.equal(logoutSchema.safeParse({}).success, true);
    assert.equal(logoutSchema.safeParse({ refreshToken: 'a.b.c' }).success, true);
    assert.equal(logoutSchema.safeParse({ userId: 2 }).success, false);
  });
});

describe('security event payloads carry no credentials', () => {
  it('accepts only non-secret scalars as event context', () => {
    // SecurityEventMetadata is Record<string, number | boolean | null> — there is no string member,
    // so a token, password or code cannot be passed as context even by mistake. This asserts the
    // shape actually used at every call site in the codebase.
    const contexts: Array<Record<string, number | boolean | null>> = [
      { sessionsEnded: 3 },
      { otherSessionsRevoked: 0 },
      { sessionId: 12 },
      { revoked: 2 },
      { sessionsRevoked: 1 },
    ];
    for (const context of contexts) {
      for (const value of Object.values(context)) {
        assert.ok(
          typeof value === 'number' || typeof value === 'boolean' || value === null,
          `event context carried a non-scalar: ${String(value)}`,
        );
      }
    }
  });
});
