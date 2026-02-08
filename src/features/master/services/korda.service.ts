import { success, failure, Result, PaginatedData } from "@/lib/result";
import type { Korda } from "../types";
import { kordaRepository } from "../repositories/korda.repository";
import type {
  KordaCreateInput,
  KordaListInput,
  KordaUpdateInput,
} from "../validators/korda.validator";

export const kordaService = {
  async getKorda(
    input?: KordaListInput,
  ): Promise<Result<PaginatedData<Korda> | Korda[]>> {
    try {
      const page = input?.page;
      const limit = input?.limit ?? 10;

      if (page) {
        const { items, totalCount } = await kordaRepository.findMany({
          page,
          limit,
          korwilId: input?.korwilId,
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

      // Jika tidak ada page, kembalikan array murni
      const { items } = await kordaRepository.findMany({
        korwilId: input?.korwilId,
      });
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data korda");
    }
  },

  async getKordaById(id: string): Promise<Result<Korda>> {
    try {
      const item = await kordaRepository.findById(id);
      if (!item) return failure("Korda tidak ditemukan");
      return success(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal mengambil data korda");
    }
  },

  async createKorda(payload: KordaCreateInput): Promise<Result<Korda>> {
    try {
      const created = await kordaRepository.create(payload);
      return success(created);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal membuat korda");
    }
  },

  async updateKorda(payload: KordaUpdateInput): Promise<Result<Korda>> {
    try {
      const existing = await kordaRepository.findById(payload.id);
      if (!existing) return failure("Korda tidak ditemukan");

      const updated = await kordaRepository.update(payload.id, payload.data);
      return success(updated);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal memperbarui korda");
    }
  },

  async deleteKorda(id: string): Promise<Result<Korda>> {
    try {
      const existing = await kordaRepository.findById(id);
      if (!existing) return failure("Korda tidak ditemukan");

      const deleted = await kordaRepository.delete(id);
      return success(deleted);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return failure("Gagal menghapus korda");
    }
  },
};
