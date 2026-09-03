import { z } from 'zod';

/**
 * ─── Security endpoint inputs ────────────────────────────────────────
 *
 * NOTE WHAT IS ABSENT: there is no `userId` field anywhere in this file. Every security endpoint
 * resolves identity with requireUserId(req) from the authenticated request, so an id in a body or
 * query string would be an attacker-controlled value competing with the real one. Schemas are
 * `.strict()`, so sending one is rejected outright rather than ignored.
 */

/** Session ids are internal auto-increment integers; anything else is malformed, not "not found". */
export const sessionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * The refresh token the caller currently holds, used ONLY to identify which session is "this one"
 * so it can be kept while the others are revoked. Optional throughout: when it is absent the
 * server falls back to the safe direction (revoke everything), never to leaving a session alive.
 *
 * Bounded in length so an oversized body cannot be pushed through the hash path.
 */
const currentRefreshToken = z.string().min(1).max(4096).optional();

export const revokeOthersSchema = z.object({
  refreshToken: currentRefreshToken,
}).strict();

export const revokeSessionSchema = z.object({
  refreshToken: currentRefreshToken,
}).strict();

/**
 * The password policy is signupSchema's, restated at the same minimum rather than relaxed — a
 * change flow that accepted a weaker password than signup would be a way to downgrade an account.
 *
 * `confirmPassword` is checked server-side too: the UI comparison is a convenience, and a request
 * that bypasses the page must not be able to set a password the customer never confirmed.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200),
  refreshToken: currentRefreshToken,
}).strict().refine((value) => value.newPassword === value.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/**
 * Turning the second factor on or off.
 *
 * The current password is required BOTH ways. An access token lives fifteen minutes and needs no
 * password to use, so without this a stolen token could switch 2FA off — which is the first thing
 * an attacker holding a session would do — or switch it on against an inbox they control.
 */
export const twoFactorToggleSchema = z.object({
  currentPassword: z.string().min(1).max(200),
}).strict();

/** Bounded so a caller cannot ask for an unbounded scan of their own history. */
export const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RevokeOthersInput = z.infer<typeof revokeOthersSchema>;
export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
