import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { authorizeAdmin, requireAdminIdentity, type AdminIdentity } from '../middleware/requireAdmin.js';
import { toAdminChallengeRow } from '../services/admin-two-factor.service.js';
import { TWO_FACTOR_EVENT_TYPES } from '../services/security-event.service.js';
import {
  adminActionsQuerySchema,
  adminTwoFactorActionSchema,
  adminTwoFactorChallengesQuerySchema,
  adminTwoFactorEventsQuerySchema,
  adminTwoFactorUsersQuerySchema,
  adminUserIdParamSchema,
} from '../schemas/admin.schema.js';

/**
 * ─── Admin 2FA · what can be proven without a database ───────────────
 *
 * MySQL is unreachable here, so the aggregate queries and the two privileged writes are not
 * asserted against a stub — a stub would only prove the stub behaves, which is worth nothing.
 *
 * What IS provable, and is where this surface could actually go wrong:
 *
 *   · the AUTHORIZATION DECISION, which is a pure function of the row that was read
 *   · the INPUT CONTRACTS, which decide what a privileged request may carry
 *   · the LIFECYCLE MAPPER, which decides what an operator is told about a challenge
 *   · the REDACTION and VOCABULARY invariants, checked against the source itself, because their
 *     failure modes are silent: a hash added to a select leaks, and an event type missing from the
 *     CHECK constraint makes the audit write fail inside a never-throwing logger.
 */

const admin: AdminIdentity = {
  id: 4,
  email: 'operator@example.com',
  isPlatformAdmin: true,
  twoFactorEnabledAt: null,
};

describe('admin authorization', () => {
  it('admits a caller whose is_platform_admin flag is genuinely set', () => {
    assert.equal(authorizeAdmin(admin).id, 4);
  });

  it('refuses a non-admin and a missing row identically', () => {
    // Any difference between the two would confirm which authenticated ids exist. An authenticated
    // non-admin must learn nothing beyond "not for you".
    const errors = [null, { ...admin, isPlatformAdmin: false }].map((identity) => {
      try {
        authorizeAdmin(identity);
        return null;
      } catch (error) {
        return error as { statusCode: number; code: string; message: string };
      }
    });

    assert.ok(errors[0] && errors[1], 'both cases must be refused');
    assert.equal(errors[0].statusCode, 403);
    assert.equal(errors[0].code, 'ADMIN_REQUIRED');
    assert.equal(errors[0].statusCode, errors[1].statusCode);
    assert.equal(errors[0].code, errors[1].code);
    assert.equal(errors[0].message, errors[1].message);
  });

  it('answers 403 rather than 401 — the token was fine, the privilege was not', () => {
    // A 401 would send a client off to refresh a token that is working perfectly well.
    assert.throws(() => authorizeAdmin(null), (error: { statusCode: number }) => error.statusCode === 403);
  });

  it('refuses to attribute an action when requireAdmin never ran', () => {
    // The alternative — falling back to some default actor — would put a fabricated id in the
    // operator trail, which is worse than refusing the call.
    assert.throws(
      () => requireAdminIdentity({} as never),
      (error: { statusCode: number; code: string }) => error.statusCode === 403 && error.code === 'ADMIN_REQUIRED',
    );
    assert.equal(requireAdminIdentity({ admin } as never).id, 4);
  });
});

describe('privileged action contract', () => {
  it('requires a reason of real substance', () => {
    assert.equal(adminTwoFactorActionSchema.safeParse({ reason: 'Ticket 4412 — inbox lost' }).success, true);
    // A single keystroke is not a justification, and an unexplained privileged action is not
    // auditable.
    for (const reason of ['', ' ', 'x', 'too short']) {
      assert.equal(adminTwoFactorActionSchema.safeParse({ reason }).success, false, `accepted: "${reason}"`);
    }
  });

  it('refuses a reason longer than the column, rather than truncating it into the audit row', () => {
    assert.equal(adminTwoFactorActionSchema.safeParse({ reason: 'a'.repeat(500) }).success, true);
    assert.equal(adminTwoFactorActionSchema.safeParse({ reason: 'a'.repeat(501) }).success, false);
  });

  it('trims, so whitespace cannot pass the minimum', () => {
    const parsed = adminTwoFactorActionSchema.safeParse({ reason: '   Ticket 4412 padded   ' });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.reason, 'Ticket 4412 padded');
    assert.equal(adminTwoFactorActionSchema.safeParse({ reason: `${' '.repeat(40)}` }).success, false);
  });

  it('takes no identity and no credential in the body', () => {
    // The acting admin comes from the authenticated request and the target from the path. A
    // userId here would be a second, attacker-controlled identity competing with the real one.
    for (const extra of [
      { userId: 9 },
      { targetUserId: 9 },
      { actorUserId: 9 },
      { currentPassword: 'x' },
      { code: '123456' },
      { ticket: 'abc' },
    ]) {
      assert.equal(
        adminTwoFactorActionSchema.safeParse({ reason: 'Ticket 4412 — inbox lost', ...extra }).success,
        false,
        `accepted: ${Object.keys(extra)[0]}`,
      );
    }
  });
});

describe('target id contract', () => {
  it('coerces a positive integer from the path', () => {
    const parsed = adminUserIdParamSchema.safeParse({ id: '7' });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.id, 7);
  });

  it('rejects anything that is not one — malformed, not "not found"', () => {
    for (const id of ['0', '-1', 'abc', '1.5', '', 'me']) {
      assert.equal(adminUserIdParamSchema.safeParse({ id }).success, false, `accepted: "${id}"`);
    }
  });
});

describe('monitoring query contracts', () => {
  it('bounds every page, so no admin call can ask for a full table scan', () => {
    for (const schema of [
      adminTwoFactorUsersQuerySchema,
      adminTwoFactorEventsQuerySchema,
      adminTwoFactorChallengesQuerySchema,
      adminActionsQuerySchema,
    ]) {
      assert.equal(schema.safeParse({ limit: '100' }).success, true);
      assert.equal(schema.safeParse({ limit: '101' }).success, false);
      assert.equal(schema.safeParse({ limit: '0' }).success, false);
      assert.equal(schema.safeParse({ offset: '0' }).success, true);
      assert.equal(schema.safeParse({ offset: '-1' }).success, false);
      // An empty query is valid — the service applies its own default page.
      assert.equal(schema.safeParse({}).success, true);
      // Strict, so a misspelled filter is a 400 rather than a silently unfiltered result set.
      assert.equal(schema.safeParse({ enabledd: 'true' }).success, false);
    }
  });

  it('reads the roster booleans from query strings', () => {
    const on = adminTwoFactorUsersQuerySchema.safeParse({ enabled: 'true', emailVerified: 'false' });
    assert.equal(on.success, true);
    assert.equal(on.data?.enabled, true);
    assert.equal(on.data?.emailVerified, false);
    assert.equal(adminTwoFactorUsersQuerySchema.safeParse({ enabled: 'maybe' }).success, false);
  });

  it('bounds the search term and refuses an empty one', () => {
    assert.equal(adminTwoFactorUsersQuerySchema.safeParse({ search: 'ada' }).success, true);
    assert.equal(adminTwoFactorUsersQuerySchema.safeParse({ search: '   ' }).success, false);
    assert.equal(adminTwoFactorUsersQuerySchema.safeParse({ search: 'a'.repeat(201) }).success, false);
  });

  it('confines the event feed to the 2FA vocabulary', () => {
    for (const type of TWO_FACTOR_EVENT_TYPES) {
      assert.equal(adminTwoFactorEventsQuerySchema.safeParse({ type }).success, true, `rejected: ${type}`);
    }
    // This endpoint must not be widened into a general all-users read of every security event by
    // passing a type that belongs to someone's own private history.
    for (const type of ['password_changed', 'password_reset', 'login_success', 'logout', 'session_revoked']) {
      assert.equal(adminTwoFactorEventsQuerySchema.safeParse({ type }).success, false, `accepted: ${type}`);
    }
  });

  it('holds the challenge filter to the three real statuses', () => {
    for (const status of ['all', 'open', 'undelivered']) {
      assert.equal(adminTwoFactorChallengesQuerySchema.safeParse({ status }).success, true);
    }
    assert.equal(adminTwoFactorChallengesQuerySchema.safeParse({ status: 'consumed' }).success, false);
  });
});

describe('challenge lifecycle reporting', () => {
  const base = {
    id: 12,
    userId: 3,
    purpose: 'login_2fa',
    createdAt: new Date('2026-09-03T09:00:00.000Z'),
    expiresAt: new Date('2026-09-03T09:10:00.000Z'),
    consumedAt: null,
    attempts: 1,
    maxAttempts: 5,
    sentAt: new Date('2026-09-03T09:00:01.000Z'),
    deliveryAttempts: 1,
    lastDeliveryError: null,
  };

  it('calls a live challenge open', () => {
    const row = toAdminChallengeRow(base, new Date('2026-09-03T09:05:00.000Z'));
    assert.equal(row.status, 'open');
  });

  it('calls a lapsed challenge expired', () => {
    const row = toAdminChallengeRow(base, new Date('2026-09-03T09:10:00.001Z'));
    assert.equal(row.status, 'expired');
    // Exactly at the expiry instant it is already dead — the same boundary redeemOtpChallenge uses.
    assert.equal(toAdminChallengeRow(base, base.expiresAt).status, 'expired');
  });

  it('reports consumed ahead of expired, because spent is the reason it is unusable', () => {
    const consumed = { ...base, consumedAt: new Date('2026-09-03T09:02:00.000Z') };
    assert.equal(toAdminChallengeRow(consumed, new Date('2026-09-03T09:30:00.000Z')).status, 'consumed');
  });

  it('carries a failed delivery honestly instead of implying the code was sent', () => {
    const failed = { ...base, sentAt: null, deliveryAttempts: 2, lastDeliveryError: 'connection refused' };
    const row = toAdminChallengeRow(failed, new Date('2026-09-03T09:05:00.000Z'));
    assert.equal(row.sentAt, null);
    assert.equal(row.deliveryAttempts, 2);
    assert.equal(row.lastDeliveryError, 'connection refused');
  });

  it('exposes no credential field at all', () => {
    const row = toAdminChallengeRow(base) as Record<string, unknown>;
    for (const key of ['codeHash', 'code_hash', 'code', 'ticket']) {
      assert.equal(key in row, false, `challenge row exposed ${key}`);
    }
  });
});

// ─── Source-level invariants ─────────────────────────────────────────
// Both of these fail SILENTLY in production, which is why they are asserted here rather than left
// to review: a hash added to a select would simply appear in a response, and an event type missing
// from the CHECK constraint would be swallowed by recordSecurityEvent's deliberate never-throw.

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('redaction invariant', () => {
  it('the admin service never names a credential column', () => {
    const service = source('../services/admin-two-factor.service.ts');
    for (const column of ['codeHash', 'passwordHash', 'refreshTokenHash', 'tokenHash', 'code_hash']) {
      // Every read in that service selects columns explicitly. This asserts the sensitive ones are
      // not merely absent from a response mapper but absent from the query in the first place.
      assert.equal(
        service.includes(column),
        false,
        `admin-two-factor.service.ts references ${column} — an admin response must never carry one`,
      );
    }
  });

  it('the admin controller spreads no raw row', () => {
    const controller = source('../controllers/admin-two-factor.controller.ts');
    for (const column of ['passwordHash', 'refreshTokenHash', 'tokenHash', 'codeHash']) {
      assert.equal(controller.includes(column), false, `admin controller references ${column}`);
    }
  });
});

describe('event vocabulary invariant', () => {
  it('every 2FA event type is permitted by the security_events CHECK constraint', () => {
    // recordSecurityEvent never throws, so a type the constraint rejects becomes a missing audit
    // row and nothing else. The union and the constraint must agree or the trail quietly gaps.
    const schema = source('../db/schema.ts');
    const constraint = schema.slice(schema.indexOf('security_events_type_valid'));
    const clause = constraint.slice(0, constraint.indexOf('),'));

    for (const type of TWO_FACTOR_EVENT_TYPES) {
      assert.ok(
        clause.includes(`'${type}'`),
        `security_events_type_valid does not permit '${type}' — the audit write would be dropped`,
      );
    }
  });

  it('the admin action names are permitted by their own CHECK constraint', () => {
    const schema = source('../db/schema.ts');
    const constraint = schema.slice(schema.indexOf('admin_security_actions_action_valid'));
    const clause = constraint.slice(0, constraint.indexOf('),'));

    // Unlike the events table, this insert is inside a transaction that carries the privileged
    // change — a rejected action name would roll the whole action back rather than gap the trail.
    for (const action of ['two_factor_disabled', 'two_factor_challenges_revoked']) {
      assert.ok(clause.includes(`'${action}'`), `admin_security_actions does not permit '${action}'`);
    }
  });
});
