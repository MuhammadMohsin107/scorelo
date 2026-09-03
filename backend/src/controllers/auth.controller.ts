import type { Request, Response } from 'express';
import { completeTwoFactorLogin, login, logout, refresh, resendEmailVerification, signup, verifyEmail } from '../services/auth.service.js';
import { resendTwoFactorCode } from '../services/two-factor.service.js';
import { requestPasswordReset, resetPassword, verifyResetCode } from '../services/password-reset.service.js';
import { challengeRejected } from '../services/auth-challenge.service.js';
import { requireUserId } from '../lib/requestContext.js';
import { requestMetadata } from '../lib/requestMetadata.js';

/**
 * Creates the account and starts email verification.
 *
 * The response shape is IDENTICAL whether or not verification is enforced — only
 * `emailVerificationRequired` and the presence of tokens change. That is what lets the flag be
 * flipped on a running system without breaking a client that is already deployed.
 *
 * `verificationSent: false` is an honest signal, not a failure: the account genuinely exists, the
 * code genuinely could not be delivered, and the customer needs the resend flow. Signup can afford
 * this candour because it already discloses account existence through 409 EMAIL_TAKEN — unlike
 * forgot-password, which must stay uniform.
 *
 * The code itself is never in this response.
 */
export async function postSignup(req: Request, res: Response) {
  const result = await signup(req.body, requestMetadata(req));
  res.status(201).json({ data: result });
}

/** Confirms an address. Returns no session — see verifyEmail() in the service for why. */
export async function postVerifyEmail(req: Request, res: Response) {
  const verified = await verifyEmail(req.body.email, req.body.code, requestMetadata(req));
  if (!verified) throw challengeRejected();
  res.json({ data: { message: 'Email verified. You can now sign in.' } });
}

/**
 * Always 202 with the same body, whether or not the address has an account, and whether or not it
 * is already verified. Same reasoning as forgot-password: any difference would turn this into an
 * account-existence oracle for anyone willing to guess addresses.
 */
export async function postResendVerification(req: Request, res: Response) {
  await resendEmailVerification(req.body.email);
  res.status(202).json({
    data: { message: 'If that address needs verifying, we have sent a new code.' },
  });
}

/**
 * Signs in — or stops halfway when a second factor is required.
 *
 * Two response shapes, distinguished by `twoFactorRequired`, which the client branches on. The
 * 2FA shape carries NO user object and NO tokens: the sign-in is not finished, and shipping any
 * part of an authenticated session at this point would make the second factor decorative.
 *
 * `codeSent: false` is honest, not a failure — the sign-in is genuinely paused and the customer
 * needs the resend. The code itself is never in this response.
 */
export async function postLogin(req: Request, res: Response) {
  const result = await login(req.body, requestMetadata(req));

  if (result.twoFactorRequired) {
    res.json({ data: { twoFactorRequired: true, ticket: result.ticket, codeSent: result.codeSent } });
    return;
  }

  const { user, accessToken, refreshToken } = result;
  res.json({ data: { twoFactorRequired: false, user, accessToken, refreshToken } });
}

/** Completes a 2FA sign-in. One uniform 401 covers every rejection. */
export async function postTwoFactorLogin(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await completeTwoFactorLogin(
    req.body.ticket,
    req.body.code,
    requestMetadata(req),
  );
  res.json({ data: { user, accessToken, refreshToken } });
}

/**
 * Re-sends a sign-in code. Always 202 with the same body — whether the ticket was valid, whether
 * mail went out, or neither. A caller holding an invalid ticket learns nothing.
 */
export async function postTwoFactorResend(req: Request, res: Response) {
  await resendTwoFactorCode(req.body.ticket);
  res.status(202).json({ data: { message: 'If your sign-in is still in progress, a new code has been sent.' } });
}

export async function postRefresh(req: Request, res: Response) {
  const { accessToken, refreshToken } = await refresh(req.body.refreshToken, requestMetadata(req));
  res.json({ data: { accessToken, refreshToken } });
}

export async function postLogout(req: Request, res: Response) {
  await logout(requireUserId(req), requestMetadata(req), req.body?.refreshToken);
  res.status(204).send();
}

/**
 * Always 202 with the same body, whether or not the address has an account.
 *
 * 202 rather than 200 is the accurate code: the request has been accepted for processing, and
 * whether an email actually goes out is deliberately not disclosed. A different status or message
 * for a known address would turn this into an account-existence oracle.
 */
export async function postForgotPassword(req: Request, res: Response) {
  await requestPasswordReset(req.body);
  res.status(202).json({
    data: { message: 'If an account exists for this email, a password reset link has been sent.' },
  });
}

/**
 * Exchanges a correct reset code for the high-entropy ticket that actually authorises the change.
 *
 * One uniform rejection covers unknown address, wrong code, expired, spent and exhausted. The
 * ticket is returned exactly once, in this response, and is never logged.
 */
export async function postVerifyResetCode(req: Request, res: Response) {
  const ticket = await verifyResetCode(req.body.email, req.body.code);
  if (!ticket) throw challengeRejected();
  res.json({ data: { ticket } });
}

export async function postResetPassword(req: Request, res: Response) {
  await resetPassword(req.body, requestMetadata(req));
  // No session is issued here. The customer logs in normally with the new password, which keeps
  // this flow consistent with the existing login path and means a leaked reset link cannot be
  // redeemed straight into an authenticated session.
  res.json({ data: { message: 'Password updated successfully.' } });
}
