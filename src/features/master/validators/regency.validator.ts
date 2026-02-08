import { z } from "zod";

export const regencySearchSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

export type RegencySearchInput = z.infer<typeof regencySearchSchema>;
