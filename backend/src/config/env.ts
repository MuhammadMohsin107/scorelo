import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail fast with the variable NAME only — never echo values.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: required('DATABASE_URL'),
  mockAuthEnabled: process.env.NODE_ENV !== 'production' && process.env.MOCK_AUTH === 'true',
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  // Shopify app credentials — optional at startup (unlike the vars above) so the rest of the
  // API keeps working before a real Shopify Partner app is provisioned. Routes that need them
  // check shopifyConfigured() and fail with a clear 500 instead of crashing the whole server.
  shopifyApiKey: process.env.SHOPIFY_API_KEY,
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET,
  // The BACKEND's own public base URL — Shopify calls back to `${backendUrl}/api/shopify/callback`
  // directly, so this must be where this API is actually reachable, not the frontend's URL.
  backendUrl: process.env.BACKEND_URL,
  // Where to send the browser after a successful connect — the frontend app.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
} as const;

export function shopifyConfigured(): boolean {
  return Boolean(env.shopifyApiKey && env.shopifyApiSecret && env.backendUrl && env.tokenEncryptionKey);
}

export const isDev = env.nodeEnv !== 'production';
