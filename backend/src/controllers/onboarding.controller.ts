import type { Request, Response } from 'express';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';
import {
  completeOnboarding,
  deferOnboarding,
  getOnboarding,
  getOnboardingSuggestions,
  reopenOnboarding,
  saveOnboardingStep,
  skipOnboardingStep,
} from '../services/onboarding.service.js';

export async function getOnboardingState(req: Request, res: Response) {
  res.json({ data: await getOnboarding(requireUserId(req), optionalStoreId(req)) });
}

export async function getSuggestions(req: Request, res: Response) {
  res.json({ data: await getOnboardingSuggestions(requireUserId(req), optionalStoreId(req)) });
}

export async function putStep(req: Request, res: Response) {
  res.json({ data: await saveOnboardingStep(requireUserId(req), req.body, optionalStoreId(req)) });
}

export async function postSkip(req: Request, res: Response) {
  res.json({ data: await skipOnboardingStep(requireUserId(req), req.body.step, optionalStoreId(req)) });
}

export async function postDefer(req: Request, res: Response) {
  res.json({ data: await deferOnboarding(requireUserId(req), optionalStoreId(req)) });
}

export async function postReopen(req: Request, res: Response) {
  res.json({ data: await reopenOnboarding(requireUserId(req), optionalStoreId(req)) });
}

export async function postComplete(req: Request, res: Response) {
  res.json({ data: await completeOnboarding(requireUserId(req), optionalStoreId(req)) });
}
