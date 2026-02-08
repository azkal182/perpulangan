"use server";

import { failure, type PaginatedData, type Result } from "@/lib/result";
import { kordaService } from "../services/korda.service";
import type { Korda } from "../types";
import {
  kordaCreateSchema,
  kordaDeleteSchema,
  kordaGetSchema,
  kordaListSchema,
  kordaUpdateSchema,
  type KordaCreateInput,
  type KordaListInput,
  type KordaUpdateInput,
} from "../validators/korda.validator";

export async function getKorda(
  input?: KordaListInput,
): Promise<Result<PaginatedData<Korda> | Korda[]>> {
  const parsed = kordaListSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kordaService.getKorda(parsed.data);
}

export async function getKordaById(id: string): Promise<Result<Korda>> {
  const parsed = kordaGetSchema.safeParse({ id });
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kordaService.getKordaById(parsed.data.id);
}

export async function createKorda(
  input: KordaCreateInput,
): Promise<Result<Korda>> {
  const parsed = kordaCreateSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kordaService.createKorda(parsed.data);
}

export async function updateKorda(
  input: KordaUpdateInput,
): Promise<Result<Korda>> {
  const parsed = kordaUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kordaService.updateKorda(parsed.data);
}

export async function deleteKorda(id: string): Promise<Result<Korda>> {
  const parsed = kordaDeleteSchema.safeParse({ id });
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kordaService.deleteKorda(parsed.data.id);
}
