import type { Request, Response } from 'express';
import { bulkUpdateFindingStatus, getFinding, listFindings, listPriorityFindings, updateFindingStatus } from '../services/finding.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getFindings(req: Request, res: Response) {
  res.json({ data: await listFindings(requireUserId(req), req.query as never, optionalStoreId(req)) });
}

export async function getPriorityFindings(req: Request, res: Response) {
  res.json({ data: await listPriorityFindings(requireUserId(req), optionalStoreId(req)) });
}

export async function getFindingById(req: Request, res: Response) {
  res.json({ data: await getFinding(requireUserId(req), Number(req.params.id), optionalStoreId(req)) });
}

export async function patchFindingStatus(req: Request, res: Response) {
  res.json({ data: await updateFindingStatus(requireUserId(req), Number(req.params.id), req.body, optionalStoreId(req)) });
}

export async function patchBulkFindingStatus(req: Request, res: Response) {
  res.json({ data: await bulkUpdateFindingStatus(requireUserId(req), req.body, optionalStoreId(req)) });
}
