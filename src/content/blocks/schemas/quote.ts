import { z } from 'zod';

export const quoteSchema = z.object({
  text: z.string(),
  attribution: z.string().optional(),
});
