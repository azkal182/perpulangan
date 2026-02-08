"use server";

import { failure, type PaginatedData, type Result } from "@/lib/result";
import { korwilService } from "../services/korwil.service";
import type { Korwil } from "../types";
import {
  korwilCreateSchema,
  korwilDeleteSchema,
  korwilGetSchema,
  korwilListSchema,
  korwilUpdateSchema,
  type KorwilCreateInput,
  type KorwilListInput,
  type KorwilUpdateInput,
} from "../validators/korwil.validator";

export async function getKorwil(
  input?: KorwilListInput,
): Promise<Result<PaginatedData<Korwil> | Korwil[]>> {
  const parsed = korwilListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return korwilService.getKorwil(parsed.data);
}

export async function getKorwilById(id: string): Promise<Result<Korwil>> {
  const parsed = korwilGetSchema.safeParse({ id });
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return korwilService.getKorwilById(parsed.data.id);
}

export async function createKorwil(
  input: KorwilCreateInput,
): Promise<Result<Korwil>> {
  const parsed = korwilCreateSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return korwilService.createKorwil(parsed.data);
}

export async function updateKorwil(
  input: KorwilUpdateInput,
): Promise<Result<Korwil>> {
  const parsed = korwilUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return korwilService.updateKorwil(parsed.data);
}

export async function deleteKorwil(id: string): Promise<Result<Korwil>> {
  const parsed = korwilDeleteSchema.safeParse({ id });
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return korwilService.deleteKorwil(parsed.data.id);
}
