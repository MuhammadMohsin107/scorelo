import { Router } from 'express';
import { postForgotPassword, postLogin, postLogout, postRefresh, postResetPassword, postSignup } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { forgotPasswordSchema, loginSchema, refreshSchema, resetPasswordSchema, signupSchema } from '../schemas/auth.schema.js';
import { ipAndEmailKey, rateLimit } from '../middleware/rateLimit.js';

export const authRouter = Router();

authRouter.post('/signup', validateRequest({ body: signupSchema }), asyncHandler(postSignup));
authRouter.post('/login', validateRequest({ body: loginSchema }), asyncHandler(postLogin));
authRouter.post('/refresh', validateRequest({ body: refreshSchema }), asyncHandler(postRefresh));
authRouter.post('/logout', authenticate, asyncHandler(postLogout));

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

// Tighter, and keyed on IP alone: the body carries a token rather than an email, and this is the
// endpoint an attacker would use to guess one. 256-bit tokens make guessing hopeless anyway;
// this bounds the attempt rate regardless.
authRouter.post(
  '/reset-password',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' }),
  validateRequest({ body: resetPasswordSchema }),
  asyncHandler(postResetPassword),
);
