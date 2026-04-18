import { z } from 'zod';

export const dataTableSchema = z.object({
  queryId: z.string(),
  columns: z.array(z.string()).optional(),
  pageSize: z.number().int().positive().optional(),
});
