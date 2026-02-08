"use server";

import { failure, type Result } from "@/lib/result";
import { kotaService } from "../services/kota.service";
import type { Kota } from "../types";
import {
  kotaCreateSchema,
  kotaDeleteSchema,
  kotaListSchema,
  type KotaCreateInput,
  type KotaDeleteInput,
  type KotaListInput,
} from "../validators/kota.validator";

export async function getKota(
  input: KotaListInput,
): Promise<Result<Kota[]>> {
  const parsed = kotaListSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kotaService.getKota(parsed.data);
}

export async function createKota(
  input: KotaCreateInput,
): Promise<Result<Kota>> {
  const parsed = kotaCreateSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kotaService.createKota(parsed.data);
}

export async function deleteKota(
  input: KotaDeleteInput,
): Promise<Result<Kota>> {
  const parsed = kotaDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return kotaService.deleteKota(parsed.data);
}
