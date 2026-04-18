import { z } from 'zod';

export const reusableSchema = z.object({
  templateId: z.string(),
  detached: z.boolean().optional(),
});
