import { z } from 'zod';

export const kpiCardSchema = z.object({
  queryId: z.string(),
  metric: z.string(),
  label: z.string(),
  format: z.string().optional(),
});
