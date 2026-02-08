import { failure, PaginatedData, Result, success } from "@/lib/result";
import type { Korwil } from "../types";
import { korwilRepository } from "../repositories/korwil.repository";
import type {
  KorwilCreateInput,
  KorwilListInput,
  KorwilUpdateInput,
} from "../validators/korwil.validator";

export const korwilService = {
  async getKorwil(
    input?: KorwilListInput,
  ): Promise<Result<PaginatedData<Korwil> | Korwil[]>> {
    try {
      const page = input?.page;
      const limit = input?.limit ?? 10;

      if (page) {
        const { items, totalCount } = await korwilRepository.findMany({
          page,
          limit,
        });
        return success({
          items,
          meta: {
            totalItems: totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            pageSize: limit,
          },
        });
      }

      const { items } = await korwilRepository.findMany();
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data korwil");
    }
  },

  async getKorwilById(id: string): Promise<Result<Korwil>> {
    try {
      const item = await korwilRepository.findById(id);
      if (!item) return failure("Korwil tidak ditemukan");
      return success(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data korwil");
    }
  },

  async createKorwil(payload: KorwilCreateInput): Promise<Result<Korwil>> {
    try {
      const created = await korwilRepository.create(payload);
      return success(created);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal membuat korwil");
    }
  },

  async updateKorwil(payload: KorwilUpdateInput): Promise<Result<Korwil>> {
    try {
      const existing = await korwilRepository.findById(payload.id);
      if (!existing) return failure("Korwil tidak ditemukan");

      const updated = await korwilRepository.update(payload.id, payload.data);
      return success(updated);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal memperbarui korwil");
    }
  },

  async deleteKorwil(id: string): Promise<Result<Korwil>> {
    try {
      const existing = await korwilRepository.findById(id);
      if (!existing) return failure("Korwil tidak ditemukan");

      const deleted = await korwilRepository.delete(id);
      return success(deleted);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal menghapus korwil");
    }
  },
};
