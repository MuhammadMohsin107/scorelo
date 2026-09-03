import { Router } from 'express';
import {
  postForgotPassword,
  postLogin,
  postLogout,
  postRefresh,
  postResendVerification,
  postResetPassword,
  postSignup,
  postTwoFactorLogin,
  postTwoFactorResend,
  postVerifyEmail,
  postVerifyResetCode,
} from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  forgotPasswordSchema,
  loginSchema,
  twoFactorLoginSchema,
  twoFactorResendSchema,
  refreshSchema,
  logoutSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
  verifyResetCodeSchema,
} from '../schemas/auth.schema.js';
import { ipAndEmailKey, rateLimit } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/signup', validateRequest({ body: signupSchema }), asyncHandler(postSignup));

// Login is rate limited for the same reason the reset endpoints are: it is unauthenticated, it
// takes a guessable secret, and nothing else stands between a password list and an account.
// Keyed on IP + email so neither one address nor one IP can be used to fan out attempts.
authRouter.post(
  '/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFor: ipAndEmailKey, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: loginSchema }),
  asyncHandler(postLogin),
);

// ─── Second factor ───────────────────────────────────────────────────
// Unauthenticated by necessity: a sign-in paused for 2FA has no session yet. The ticket is the
// only thing standing in for one, which is why both endpoints are rate limited.

// Same limit as the other code-entry endpoints: the six-digit code has a five-attempt budget of
// its own, and this bounds how many fresh tickets an attacker can burn through guessing across.
// Keyed on IP alone — the body carries a ticket, not an email.
authRouter.post(
  '/login/2fa',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: twoFactorLoginSchema }),
  asyncHandler(postTwoFactorLogin),
);

// Tighter, because each call sends real mail.
authRouter.post(
  '/login/2fa/resend',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: 'Too many requests. Please wait a few minutes before requesting another code.' }),
  validateRequest({ body: twoFactorResendSchema }),
  asyncHandler(postTwoFactorResend),
);

authRouter.post('/refresh', validateRequest({ body: refreshSchema }), asyncHandler(postRefresh));
authRouter.post('/logout', authenticate, validateRequest({ body: logoutSchema }), asyncHandler(postLogout));

// ─── Email verification ──────────────────────────────────────────────
// Both endpoints are unauthenticated by necessity — an unverified customer has no session — so
// they carry the same limits as the password-reset pair below.

// 10 per 15 minutes: a six-digit code has a five-attempt budget of its own, and this bounds how
// many fresh challenges an attacker can burn through by guessing across several of them.
authRouter.post(
  '/verify-email',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFor: ipAndEmailKey, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: verifyEmailSchema }),
  asyncHandler(postVerifyEmail),
);

// Tighter, because each call sends real mail: 3 per 15 minutes stops this being a mail cannon
// pointed at someone else's inbox.
authRouter.post(
  '/resend-verification',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, keyFor: ipAndEmailKey, message: 'Too many requests. Please wait a few minutes before requesting another code.' }),
  validateRequest({ body: resendVerificationSchema }),
  asyncHandler(postResendVerification),
);

// ─── Password reset ──────────────────────────────────────────────────
// Both endpoints are unauthenticated by necessity (the customer cannot log in), so they are the
// only routes an anonymous caller can hammer — hence the rate limits.

// Keyed on IP + email so neither one address nor one IP can be used to fan out requests.
// 5 per 15 minutes is generous for a human who mistyped their address once or twice.
authRouter.post(
  '/forgot-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyFor: ipAndEmailKey, message: 'Too many password reset requests. Please wait a few minutes and try again.' }),
  validateRequest({ body: forgotPasswordSchema }),
  asyncHandler(postForgotPassword),
);

// Step two of recovery: the emailed code is exchanged here for the ticket that can actually
// change a password. Same limit as verify-email, and for the same reason — this is where a
// six-digit code is guessed, so the per-challenge attempt budget needs a rate limit above it.
authRouter.post(
  '/verify-reset-code',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyFor: ipAndEmailKey, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: verifyResetCodeSchema }),
  asyncHandler(postVerifyResetCode),
);

// Tighter, and keyed on IP alone: the body carries a ticket (or a legacy token) rather than an
// email, and this is the endpoint an attacker would use to guess one. 256-bit credentials make
// guessing hopeless anyway; this bounds the attempt rate regardless.
authRouter.post(
  '/reset-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: resetPasswordSchema }),
  asyncHandler(postResetPassword),
);
