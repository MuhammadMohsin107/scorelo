import type { Request, Response } from 'express';
import {
  getPageSettingsBySlug,
  upsertPageSettingsBySlug,
} from '../services/pageSettings.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getPageSettings(req: Request, res: Response) {
  const slug = String(req.params.slug);
  res.json({ data: await getPageSettingsBySlug(requireUserId(req), slug, optionalStoreId(req)) });
}

export async function upsertPageSettings(req: Request, res: Response) {
  const slug = String(req.params.slug);
  res.json({ data: await upsertPageSettingsBySlug(requireUserId(req), slug, req.body, optionalStoreId(req)) });
}
