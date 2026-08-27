import type { NextFunction, Request, Response } from 'express';
import { isDev } from '../config/env.js';
import { RequestValidationError } from './validateRequest.js';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code = 'API_ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 404 for unmatched routes. */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

/** 4xx means the caller asked for something we legitimately refused; 5xx means we broke. */
function statusCodeOf(err: unknown): number {
  if (err instanceof RequestValidationError || err instanceof ApiError) return err.statusCode;
  return 500;
}

/**
 * Central error handler. Logs the full error server-side; the response
 * never carries SQL internals, connection strings or credentials.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Expected 4xx (a store with no audits yet, an unconnected Shopify store) is normal
  // application flow, not a fault — a stack trace per occurrence buries the 5xx that matter.
  if (statusCodeOf(err) >= 500) {
    console.error('[scorelo-api]', err instanceof Error ? err.stack ?? err.message : err);
  } else if (err instanceof Error) {
    console.warn(`[scorelo-api] ${statusCodeOf(err)} ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  if (err instanceof RequestValidationError) {
    res.status(err.statusCode).json({
      error: 'Request validation failed',
      issues: err.issues,
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && err instanceof Error ? { message: err.message } : {}),
  });
}
