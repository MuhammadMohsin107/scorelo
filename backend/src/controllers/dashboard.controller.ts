import type { Request, Response } from 'express';
import { getDashboardSummary } from '../services/dashboard.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getSummary(req: Request, res: Response) {
  res.json({ data: await getDashboardSummary(requireUserId(req), optionalStoreId(req)) });
}
