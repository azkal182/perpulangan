"use server";

import { failure, type Result } from "@/lib/result";
import { regencyService } from "../services/regency.service";
import type { RegencyOption } from "../types";
import {
  regencySearchSchema,
  type RegencySearchInput,
} from "../validators/regency.validator";

export async function searchRegency(
  input?: RegencySearchInput,
): Promise<Result<RegencyOption[]>> {
  const parsed = regencySearchSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return regencyService.searchRegency(parsed.data);
}
