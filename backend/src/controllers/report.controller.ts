import type { Request, Response } from 'express';
import { getReportComparison, getReportCsv, getReportTrend } from '../services/report.service.js';
import { optionalStoreId, requireUserId } from '../lib/requestContext.js';

export async function getTrend(req: Request, res: Response) {
  res.json({ data: await getReportTrend(requireUserId(req), req.query as never, optionalStoreId(req)) });
}

export async function getComparison(req: Request, res: Response) {
  res.json({ data: await getReportComparison(requireUserId(req), optionalStoreId(req)) });
}

export async function exportReport(req: Request, res: Response) {
  const csv = await getReportCsv(requireUserId(req), optionalStoreId(req));
  res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="scorelo-report.csv"').send(csv);
}
