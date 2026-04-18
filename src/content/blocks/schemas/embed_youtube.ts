import { z } from 'zod';

export const embedYoutubeSchema = z.object({
  videoId: z.string(),
  title: z.string().optional(),
});
