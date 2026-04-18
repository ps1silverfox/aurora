import { z } from 'zod';

export const listSchema = z.object({
  items: z.array(z.string()),
  ordered: z.boolean(),
});
