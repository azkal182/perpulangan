import { z } from "zod";

const kotaIdSchema = z.coerce.number().int().positive();
const kordaIdSchema = z.string().uuid();

export const kotaListSchema = z
  .object({
    kordaId: kordaIdSchema,
  })
  .strict();

export const kotaCreateSchema = z
  .object({
    kordaId: kordaIdSchema,
    regencyId: z.coerce.number().int().positive(),
  })
  .strict();

export const kotaDeleteSchema = z
  .object({
    id: kotaIdSchema,
    kordaId: kordaIdSchema,
  })
  .strict();

export type KotaListInput = z.infer<typeof kotaListSchema>;
export type KotaCreateInput = z.infer<typeof kotaCreateSchema>;
export type KotaDeleteInput = z.infer<typeof kotaDeleteSchema>;
