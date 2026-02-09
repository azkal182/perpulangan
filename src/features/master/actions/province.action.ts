"use server";

import { failure, type Result } from "@/lib/result";
import { provinceService } from "../services/province.service";
import type { ProvinceOption } from "../types";
import {
  provinceSearchSchema,
  type ProvinceSearchInput,
} from "../validators/province.validator";

export async function searchProvince(
  input?: ProvinceSearchInput,
): Promise<Result<ProvinceOption[]>> {
  const parsed = provinceSearchSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return failure("Validasi gagal", parsed.error.flatten());
  }
  return provinceService.searchProvince(parsed.data);
}
