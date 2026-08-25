import type { Request, Response } from 'express';
import { getAuditScores, getLatestAudit, getSubPillarAnalysis, listAudits } from '../services/audit.service.js';
import { createAuditJob } from '../services/job.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function listAuditRuns(req: Request, res: Response) {
  res.json({ data: await listAudits(requireUserId(req), req.query as never, optionalStoreId(req)) });
}

export async function getLatestAuditRun(req: Request, res: Response) {
  res.json({ data: await getLatestAudit(requireUserId(req), req.query as never, optionalStoreId(req)) });
}

export async function getScores(req: Request, res: Response) {
  res.json({ data: await getAuditScores(requireUserId(req), Number(req.params.id), optionalStoreId(req)) });
}

export async function getLatestSubPillarAnalysis(req: Request, res: Response) {
  res.json({ data: await getSubPillarAnalysis(requireUserId(req), String(req.params.pillar), String(req.params.subPillar), optionalStoreId(req)) });
}

export async function postRunAudit(req: Request, res: Response) {
  const job = await createAuditJob(requireUserId(req), optionalStoreId(req));
  res.status(202).json({ data: job });
}
