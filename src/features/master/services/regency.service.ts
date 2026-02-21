import { failure, Result, success } from "@/lib/result";
import {
  AccessDeniedError,
  getRegionalAccessScope,
  regencyScopeWhere,
} from "@/server/access-scope";
import type { RegencyOption } from "../types";
import { regencyRepository } from "../repositories/regency.repository";
import type { RegencySearchInput } from "../validators/regency.validator";

export const regencyService = {
  async searchRegency(
    input?: RegencySearchInput,
  ): Promise<Result<RegencyOption[]>> {
    try {
      const scope = await getRegionalAccessScope();
      const items = await regencyRepository.search({
        ...input,
        where: regencyScopeWhere(scope),
      });

      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data kota");
    }
  },
};
