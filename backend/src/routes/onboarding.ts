import { Router } from 'express';
import {
  getOnboardingState,
  getSuggestions,
  postComplete,
  postDefer,
  postReopen,
  postSkip,
  putStep,
} from '../controllers/onboarding.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { storeIdQuerySchema } from '../schemas/common.schema.js';
import { saveOnboardingStepSchema, skipOnboardingStepSchema } from '../schemas/onboarding.schema.js';

export const onboardingRouter = Router();

onboardingRouter.use(authenticate);

/** State + the live shop context step 1 pre-fills from. Cheap enough for the app shell to poll. */
onboardingRouter.get('/', validateRequest({ query: storeIdQuerySchema }), asyncHandler(getOnboardingState));

/** Catalogue-derived suggestions for steps 2–4. Heavier — fetched only when those steps open. */
onboardingRouter.get('/suggestions', validateRequest({ query: storeIdQuerySchema }), asyncHandler(getSuggestions));

onboardingRouter.put(
  '/step',
  validateRequest({ query: storeIdQuerySchema, body: saveOnboardingStepSchema }),
  asyncHandler(putStep),
);

onboardingRouter.post(
  '/skip',
  validateRequest({ query: storeIdQuerySchema, body: skipOnboardingStepSchema }),
  asyncHandler(postSkip),
);

/** "Finish later" — stops the redirect into setup without discarding anything. */
onboardingRouter.post('/defer', validateRequest({ query: storeIdQuerySchema }), asyncHandler(postDefer));

/** Re-entering setup from the resume card or Settings. */
onboardingRouter.post('/reopen', validateRequest({ query: storeIdQuerySchema }), asyncHandler(postReopen));

onboardingRouter.post('/complete', validateRequest({ query: storeIdQuerySchema }), asyncHandler(postComplete));
