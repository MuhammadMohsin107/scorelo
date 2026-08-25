import type { Request, Response } from 'express';
import { login, logout, refresh, signup } from '../services/auth.service.js';
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
