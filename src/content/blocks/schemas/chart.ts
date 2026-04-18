import { z } from 'zod';

export const chartSchema = z.object({
  queryId: z.string(),
  chartType: z.enum(['bar', 'line', 'pie', 'area']),
  title: z.string().optional(),
});
