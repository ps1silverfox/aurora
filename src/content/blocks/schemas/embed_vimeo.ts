import { z } from 'zod';

export const embedVimeoSchema = z.object({
  videoId: z.string(),
  title: z.string().optional(),
});
