import { pingDatabase } from '../../db/client.js';

/**
 * ─── Integration tests need a real database ──────────────────────────
 *
 * Some suites here are genuinely integration tests: they insert a user, a store and a connection
 * and assert on what the services actually wrote. They cannot run without MySQL, and they are
 * worth keeping exactly as they are — a token-refresh path proven against the real schema is not
 * something a stub can replace.
 *
 * What they must NOT do is report FAILURE when the database is simply absent. A developer running
 * `npm test` on a machine with no local MySQL got eighteen red assertions that said nothing about
 * their code, and a real regression in those files would have been invisible inside the noise.
 * "Could not look" and "looked and it is broken" are different answers, and only one of them
 * should be red — the same distinction this codebase already draws between an audit check that
 * reports `unavailable` and one that reports a zero.
 *
 * So the suites SKIP, with the reason printed, and the run stays green for what it could verify.
 * On the server — and in any environment with DATABASE_URL pointing at a reachable MySQL — they
 * run in full and nothing is weakened.
 */

/** True when MySQL answered. Resolved once, at import, and shared by every suite that needs it. */
export const databaseAvailable = await pingDatabase();

/**
 * Pass as `describe(name, { skip: skipWithoutDatabase }, ...)`.
 *
 * `undefined` runs the suite; a string skips it and is shown as the reason.
 */
export const skipWithoutDatabase: string | undefined = databaseAvailable
  ? undefined
  : 'requires a reachable MySQL (DATABASE_URL) — skipped, not failed';
