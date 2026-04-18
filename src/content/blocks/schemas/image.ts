import { z } from 'zod';

export const imageSchema = z.object({
  mediaId: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
});
