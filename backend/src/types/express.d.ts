import type { AuthenticatedUser } from '../middleware/authenticate.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      /** Raw request body bytes, captured by server.ts's express.json({verify}) — needed to
       * check Shopify webhook HMAC signatures, which are computed over the exact raw bytes. */
      rawBody?: Buffer;
    }
  }
}

export {};
