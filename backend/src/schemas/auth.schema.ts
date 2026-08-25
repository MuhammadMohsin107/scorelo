import { z } from 'zod';

export const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  jobTitle: z.string().trim().min(1).max(160).optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
