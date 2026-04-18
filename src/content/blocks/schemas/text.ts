import { z } from 'zod';

export const textSchema = z.object({
  html: z.string(),
});
