import { failure, Result, success } from "@/lib/result";
import type { ProvinceOption } from "../types";
import { provinceRepository } from "../repositories/province.repository";
import type { ProvinceSearchInput } from "../validators/province.validator";

export const provinceService = {
  async searchProvince(
    input?: ProvinceSearchInput,
  ): Promise<Result<ProvinceOption[]>> {
    try {
      const items = await provinceRepository.search(input);
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data provinsi");
    }
  },
};
