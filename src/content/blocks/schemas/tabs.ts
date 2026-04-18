import { z } from 'zod';

export const tabsSchema = z.object({
  tabs: z.array(
    z.object({
      label: z.string(),
      blockIds: z.array(z.string()),
    }),
  ),
});
