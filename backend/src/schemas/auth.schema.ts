import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  jobTitle: z.string().trim().min(1).max(160).optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict();

/**
 * Logout body.
 *
 * `refreshToken` is OPTIONAL and is used for exactly one thing: identifying WHICH session is
 * ending. An access token carries no session identifier, so without this the server cannot tell
 * one device from another and falls back to revoking every session — never to revoking none.
 *
 * This is the same credential the client already posts to /auth/refresh, over the same origin and
 * the same TLS, so no new exposure is introduced. It is hashed for a lookup and never stored,
 * logged or echoed.
 */
export const logoutSchema = z.object({
  refreshToken: z.string().min(1).max(4096).optional(),
}).strict();

/** Same normalization as login/signup (trim + lowercase), so a reset request finds the account
 * a customer actually created regardless of how they typed it. */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
}).strict();

/**
 * A one-time code as it arrives from a form: exactly six digits.
 *
 * Kept strict at the edge so a malformed value never reaches bcrypt.compare — but note the shape
 * check is a validation convenience, NOT a security control. Rejecting "12345" here and rejecting
 * "123456" in the service both surface as the same failure to the caller.
 */
const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

/** Email normalization matches login/signup exactly, so a code is looked up against the account
 * the customer actually created regardless of how they typed the address. */
const emailSchema = z.string().trim().toLowerCase().email().max(200);

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
}).strict();

export const resendVerificationSchema = z.object({
  email: emailSchema,
}).strict();

export const verifyResetCodeSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
}).strict();

/**
 * Second step of a sign-in guarded by 2FA.
 *
 * NOTE WHAT IS ABSENT: no email, and no password. The ticket already identifies the account and
 * proves the password step succeeded, so re-sending either would be handing over more credential
 * than the step needs. The ticket is the only thing that says who this is.
 */
export const twoFactorLoginSchema = z.object({
  ticket: z.string().min(1).max(200),
  code: otpCodeSchema,
}).strict();

/** Re-sends a sign-in code. The ticket is read, not spent — see resendTwoFactorCode(). */
export const twoFactorResendSchema = z.object({
  ticket: z.string().min(1).max(200),
}).strict();

/**
 * The password rule is `signupSchema`'s, deliberately reused rather than restated — a reset that
 * accepted a weaker password than signup would be a way to downgrade an account's security.
 *
 * `confirmPassword` is validated server-side too: the frontend check is a convenience, and a
 * request that bypasses the UI must not be able to set a password the customer never confirmed.
 *
 * `ticket` is the current credential; `token` is the legacy emailed ?token= link, accepted for one
 * release so links already sitting in inboxes still work. Exactly one must be present — a request
 * carrying both is ambiguous about which credential it is actually claiming, and guessing would be
 * the kind of shortcut that turns into a bypass.
 */
export const resetPasswordSchema = z.object({
  ticket: z.string().min(1).max(200).optional(),
  token: z.string().min(1).max(200).optional(),
  password: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200),
}).strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((value) => Boolean(value.ticket) !== Boolean(value.token), {
    message: 'Provide exactly one of ticket or token',
    path: ['ticket'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type VerifyResetCodeInput = z.infer<typeof verifyResetCodeSchema>;
