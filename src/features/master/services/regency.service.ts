import { failure, Result, success } from "@/lib/result";
import type { RegencyOption } from "../types";
import { regencyRepository } from "../repositories/regency.repository";
import type { RegencySearchInput } from "../validators/regency.validator";

export const regencyService = {
  async searchRegency(
    input?: RegencySearchInput,
  ): Promise<Result<RegencyOption[]>> {
    try {
      const items = await regencyRepository.search(input);

      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data kota");
    }
  },
};
