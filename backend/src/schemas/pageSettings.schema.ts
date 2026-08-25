import { z } from 'zod';

export const pageSettingsSlugSchema = z.object({
  slug: z.string().trim().min(1).max(200),
});

export const upsertPageSettingsSchema = z.object({
  values: z.record(z.string(), z.any()).default({}),
}).strict();

export type UpsertPageSettingsInput = z.infer<typeof upsertPageSettingsSchema>;
