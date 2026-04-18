import { z } from 'zod';

export const sectionSchema = z.object({
  background: z.string().optional(),
  padding: z.string().optional(),
});
