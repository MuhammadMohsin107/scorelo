import express from 'express';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

app.use(express.json());

// All Scorelo APIs mount under /api. Only health exists at this stage;
// future feature routers join here.
app.use('/api', healthRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[scorelo-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});
