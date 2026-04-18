import { z } from 'zod';

export const tableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  striped: z.boolean().optional(),
});
