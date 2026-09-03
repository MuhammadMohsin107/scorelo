import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { shopifyRouter } from './routes/shopify.js';
import { usersRouter } from './routes/users.js';
import { storesRouter } from './routes/stores.js';
import { integrationsRouter } from './routes/integrations.js';
import { auditsRouter } from './routes/audits.js';
import { jobsRouter } from './routes/jobs.js';
import { findingsRouter } from './routes/findings.js';
import { aiFixesRouter } from './routes/ai-fixes.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';
import { pageSettingsRouter } from './routes/page-settings.js';
import { securityRouter } from './routes/security.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

// Explicit allow-list instead of reflecting every caller's origin. The app authenticates with
// bearer tokens (not cookies), which limited the practical damage, but an API that answers
// credentialed CORS to any origin is one cookie away from a real problem. FRONTEND_URL covers
// staging/production; the Vite dev origins cover local development.
const allowedOrigins = new Set(
  [env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean),
);
app.use(cors({
  origin(origin, callback) {
    // Same-origin/off-browser requests (curl, the Vite proxy, server-to-server) have no Origin
    // header — those are allowed; only a cross-origin browser caller must match the list.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
// Captures the exact raw bytes alongside the parsed body — Shopify webhook signatures are
// computed over the raw request body, and re-serializing the parsed JSON would not match.
app.use(express.json({ verify: (req, _res, buf) => { (req as express.Request).rawBody = Buffer.from(buf); } }));

// All Scorelo APIs mount under /api.
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/shopify', shopifyRouter);
app.use('/api/users', usersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/audits', auditsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/findings', findingsRouter);
app.use('/api/ai-fixes', aiFixesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/page-settings', pageSettingsRouter);
app.use('/api/security', securityRouter);
// Platform-operator surface. Authenticated AND admin-authorized inside the router itself — see
// routes/admin.ts, which applies both guards once for every route it will ever hold.
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[scorelo-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
