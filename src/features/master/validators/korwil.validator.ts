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

export const korwilIdSchema = z.string().uuid();

export const korwilListSchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

export const korwilCreateSchema = z
  .object({
    name: nameSchema,
    picName: optionalPicNameSchema,
    picPhone: optionalPhoneSchema,
    picUserId: optionalUuidSchema,
  })
  .strict();

const korwilUpdateDataSchema = korwilCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal 1 field harus diisi.",
  });

export const korwilUpdateSchema = z
  .object({
    id: korwilIdSchema,
    data: korwilUpdateDataSchema,
  })
  .strict();

export const korwilDeleteSchema = z
  .object({
    id: korwilIdSchema,
  })
  .strict();

export const korwilGetSchema = z
  .object({
    id: korwilIdSchema,
  })
  .strict();

export type KorwilListInput = z.infer<typeof korwilListSchema>;
export type KorwilCreateInput = z.infer<typeof korwilCreateSchema>;
export type KorwilUpdateInput = z.infer<typeof korwilUpdateSchema>;
export type KorwilDeleteInput = z.infer<typeof korwilDeleteSchema>;
export type KorwilGetInput = z.infer<typeof korwilGetSchema>;
