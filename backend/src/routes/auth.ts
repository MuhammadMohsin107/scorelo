import { Router } from 'express';
import { postLogin, postLogout, postRefresh, postSignup } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, refreshSchema, signupSchema } from '../schemas/auth.schema.js';

export const authRouter = Router();

authRouter.post('/signup', validateRequest({ body: signupSchema }), asyncHandler(postSignup));
authRouter.post('/login', validateRequest({ body: loginSchema }), asyncHandler(postLogin));
authRouter.post('/refresh', validateRequest({ body: refreshSchema }), asyncHandler(postRefresh));
authRouter.post('/logout', authenticate, asyncHandler(postLogout));
