import { z } from "zod";

export const provinceSearchSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

export type ProvinceSearchInput = z.infer<typeof provinceSearchSchema>;
