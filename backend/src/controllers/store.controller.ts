import type { Request, Response } from 'express';
import { findCurrentStore, listStores, updateCurrentStore } from '../services/store.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getStores(req: Request, res: Response) {
  res.json({ data: await listStores(requireUserId(req)) });
}

export async function getCurrentStore(req: Request, res: Response) {
  res.json({ data: await findCurrentStore(requireUserId(req), optionalStoreId(req)) });
}

export async function updateStore(req: Request, res: Response) {
  res.json({ data: await updateCurrentStore(requireUserId(req), req.body, optionalStoreId(req)) });
}
