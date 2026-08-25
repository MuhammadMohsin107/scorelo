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

/**
 * Central error handler. Logs the full error server-side; the response
 * never carries SQL internals, connection strings or credentials.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[scorelo-api]', err instanceof Error ? err.stack ?? err.message : err);

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
