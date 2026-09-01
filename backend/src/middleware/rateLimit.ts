import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error.js';

/**
 * ─── Fixed-window rate limiter ───────────────────────────────────────
 * Small, dependency-free, in-process. Introduced for the password-reset endpoints, which are
 * unauthenticated and therefore the only routes an anonymous caller can hammer.
 *
 * WHAT THIS IS FOR: raising the cost of brute-forcing a reset token and of using
 * /forgot-password as a mail cannon. It is not a DDoS defence — that belongs at the edge.
 *
 * KNOWN LIMIT, STATED PLAINLY: counters live in this process's memory, so they reset on restart
 * and are not shared across instances. Behind a load balancer with N backends the effective limit
 * is N× the configured one. That is a real weakening, and the right fix when Scorelo runs
 * multi-instance is a shared store (Redis) behind this same interface — not a bigger number here.
 */

interface Bucket {
  count: number;
  /** Epoch ms at which this window ends and the count resets. */
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests permitted per key per window. */
  max: number;
  /**
   * Groups requests. Defaults to client IP; the reset endpoints add the target email so one
   * address cannot be spammed from many IPs, and one IP cannot enumerate many addresses.
   */
  keyFor?: (req: Request) => string;
  message?: string;
}

/** Sweeping on write keeps this O(1) amortised with no timer holding the process open. */
const SWEEP_EVERY = 500;

export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  let writes = 0;

  const keyFor = options.keyFor ?? ((req: Request) => req.ip ?? 'unknown');
  const message = options.message ?? 'Too many requests. Please wait a moment and try again.';

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = keyFor(req);

    if (++writes % SWEEP_EVERY === 0) {
      for (const [existing, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(existing);
    }

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      // 429 with a generic message. It deliberately does not say WHICH limit was hit, since on
      // the reset endpoints the key includes the email and that would leak request history.
      return next(new ApiError(429, message, 'RATE_LIMITED'));
    }
    return next();
  };
}

/** Lowercased email from the body, when present — so limits track the targeted account too. */
export function ipAndEmailKey(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${req.ip ?? 'unknown'}|${email}`;
}
