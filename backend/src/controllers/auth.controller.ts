import type { Request, Response } from 'express';
import { login, logout, refresh, signup } from '../services/auth.service.js';
import { requestPasswordReset, resetPassword } from '../services/password-reset.service.js';
import { requireUserId } from '../lib/requestContext.js';

export async function postSignup(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await signup(req.body);
  res.status(201).json({ data: { user, accessToken, refreshToken } });
}

export async function postLogin(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await login(req.body);
  res.json({ data: { user, accessToken, refreshToken } });
}

export async function postRefresh(req: Request, res: Response) {
  const { accessToken, refreshToken } = await refresh(req.body.refreshToken);
  res.json({ data: { accessToken, refreshToken } });
}

export async function postLogout(req: Request, res: Response) {
  await logout(requireUserId(req));
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

export async function postResetPassword(req: Request, res: Response) {
  await resetPassword(req.body);
  // No session is issued here. The customer logs in normally with the new password, which keeps
  // this flow consistent with the existing login path and means a leaked reset link cannot be
  // redeemed straight into an authenticated session.
  res.json({ data: { message: 'Password updated successfully.' } });
}
