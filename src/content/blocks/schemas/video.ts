import { z } from 'zod';

export const videoSchema = z.object({
  mediaId: z.string(),
  caption: z.string().optional(),
});
