import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(120, "Nama maksimal 120 karakter.");

const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Tanggal tidak valid.",
  });

export const eventStatusSchema = z.enum(["DRAFT", "ACTIVE", "COMPLETED"]);

export const eventCreateSchema = z
  .object({
    name: nameSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    status: eventStatusSchema,
  })
  .refine(
    (data) =>
      new Date(data.startDate).getTime() <= new Date(data.endDate).getTime(),
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai.",
      path: ["endDate"],
    },
  )
  .strict();

export const eventUpdateSchema = eventCreateSchema.extend({
  id: z.string().uuid(),
});

export const eventDeleteSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventDeleteInput = z.infer<typeof eventDeleteSchema>;
