import { z } from 'zod';

export const embedIframeSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  height: z.number().int().positive().optional(),
});
