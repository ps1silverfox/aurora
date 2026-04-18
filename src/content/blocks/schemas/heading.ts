import { z } from 'zod';

export const headingSchema = z.object({
  text: z.string(),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
});
