import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(100, "Nama maksimal 100 karakter.");

const optionalPicNameSchema = z
  .string()
  .trim()
  .min(2, "Nama PIC minimal 2 karakter.")
  .max(100, "Nama PIC maksimal 100 karakter.")
  .optional()
  .nullable();

const optionalPhoneSchema = z
  .string()
  .trim()
  .min(6, "Nomor telepon terlalu pendek.")
  .max(20, "Nomor telepon terlalu panjang.")
  .optional()
  .nullable();

const optionalUuidSchema = z.string().uuid().optional().nullable();

export const kordaIdSchema = z.string().uuid();

export const kordaListSchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    korwilId: z.string().uuid().optional(),
  })
  .strict();

export const kordaCreateSchema = z
  .object({
    name: nameSchema,
    korwilId: optionalUuidSchema,
    picName: optionalPicNameSchema,
    picPhone: optionalPhoneSchema,
    picUserId: optionalUuidSchema,
  })
  .strict();

const kordaUpdateDataSchema = kordaCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal 1 field harus diisi.",
  });

export const kordaUpdateSchema = z
  .object({
    id: kordaIdSchema,
    data: kordaUpdateDataSchema,
  })
  .strict();

export const kordaDeleteSchema = z
  .object({
    id: kordaIdSchema,
  })
  .strict();

export const kordaGetSchema = z
  .object({
    id: kordaIdSchema,
  })
  .strict();

export type KordaListInput = z.infer<typeof kordaListSchema>;
export type KordaCreateInput = z.infer<typeof kordaCreateSchema>;
export type KordaUpdateInput = z.infer<typeof kordaUpdateSchema>;
export type KordaDeleteInput = z.infer<typeof kordaDeleteSchema>;
export type KordaGetInput = z.infer<typeof kordaGetSchema>;
