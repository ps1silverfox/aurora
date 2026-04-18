import { z } from 'zod';

export const codeSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
});
