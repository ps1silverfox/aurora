import { z } from 'zod';

export const columnsSchema = z.object({
  columns: z.number().int().min(1).max(12),
  gap: z.string().optional(),
});
