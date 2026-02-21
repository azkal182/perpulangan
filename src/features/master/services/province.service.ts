import { failure, Result, success } from "@/lib/result";
import {
  AccessDeniedError,
  getRegionalAccessScope,
  isAdmin,
  regencyScopeWhere,
} from "@/server/access-scope";
import type { ProvinceOption } from "../types";
import { provinceRepository } from "../repositories/province.repository";
import type { ProvinceSearchInput } from "../validators/province.validator";

export const provinceService = {
  async searchProvince(
    input?: ProvinceSearchInput,
  ): Promise<Result<ProvinceOption[]>> {
    try {
      const scope = await getRegionalAccessScope();
      const items = await provinceRepository.search({
        ...input,
        where:
          isAdmin(scope) || !regencyScopeWhere(scope)
            ? undefined
            : {
                regencies: {
                  some: regencyScopeWhere(scope),
                },
              },
      });
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data provinsi");
    }
  },
};
