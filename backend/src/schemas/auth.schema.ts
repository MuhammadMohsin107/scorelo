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

/** Same normalization as login/signup (trim + lowercase), so a reset request finds the account
 * a customer actually created regardless of how they typed it. */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
}).strict();

/**
 * The password rule is `signupSchema`'s, deliberately reused rather than restated — a reset that
 * accepted a weaker password than signup would be a way to downgrade an account's security.
 *
 * `confirmPassword` is validated server-side too: the frontend check is a convenience, and a
 * request that bypasses the UI must not be able to set a password the customer never confirmed.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
  confirmPassword: z.string().min(8).max(200),
}).strict().refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
