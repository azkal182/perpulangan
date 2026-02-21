import { failure, PaginatedData, Result, success } from "@/lib/result";
import {
  AccessDeniedError,
  getRegionalAccessScope,
  korwilScopeWhere,
  requireAdmin,
} from "@/server/access-scope";
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
      const scope = await getRegionalAccessScope();
      const where = korwilScopeWhere(scope);
      const page = input?.page;
      const limit = input?.limit ?? 10;

      if (page) {
        const { items, totalCount } = await korwilRepository.findMany({
          page,
          limit,
          where,
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

      const { items } = await korwilRepository.findMany({ where });
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data korwil");
    }
  },

  async getKorwilById(id: string): Promise<Result<Korwil>> {
    try {
      const scope = await getRegionalAccessScope();
      const item = await korwilRepository.findById(id, korwilScopeWhere(scope));
      if (!item) return failure("Korwil tidak ditemukan");
      return success(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data korwil");
    }
  },

  async createKorwil(payload: KorwilCreateInput): Promise<Result<Korwil>> {
    try {
      const scope = await getRegionalAccessScope();
      requireAdmin(scope);
      const created = await korwilRepository.create(payload);
      return success(created);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal membuat korwil");
    }
  },

  async updateKorwil(payload: KorwilUpdateInput): Promise<Result<Korwil>> {
    try {
      const scope = await getRegionalAccessScope();
      requireAdmin(scope);

      const existing = await korwilRepository.findById(payload.id);
      if (!existing) return failure("Korwil tidak ditemukan");

      const updated = await korwilRepository.update(payload.id, payload.data);
      return success(updated);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal memperbarui korwil");
    }
  },

  async deleteKorwil(id: string): Promise<Result<Korwil>> {
    try {
      const scope = await getRegionalAccessScope();
      requireAdmin(scope);

      const existing = await korwilRepository.findById(id);
      if (!existing) return failure("Korwil tidak ditemukan");

      const deleted = await korwilRepository.delete(id);
      return success(deleted);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal menghapus korwil");
    }
  },
};
