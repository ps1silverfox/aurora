import { z } from 'zod';

export const accordionSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      blockIds: z.array(z.string()),
    }),
  ),
});
