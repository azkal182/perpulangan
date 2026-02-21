import { success, failure, Result, PaginatedData } from "@/lib/result";
import {
  AccessDeniedError,
  ensureKorwilInScope,
  getRegionalAccessScope,
  kordaScopeWhere,
  requireKorwilOrAdmin,
} from "@/server/access-scope";
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
      const scope = await getRegionalAccessScope();
      const where = kordaScopeWhere(scope);
      const page = input?.page;
      const limit = input?.limit ?? 10;

      if (page) {
        const { items, totalCount } = await kordaRepository.findMany({
          page,
          limit,
          korwilId: input?.korwilId,
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

      // Jika tidak ada page, kembalikan array murni
      const { items } = await kordaRepository.findMany({
        korwilId: input?.korwilId,
        where,
      });
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data korda");
    }
  },

  async getKordaById(id: string): Promise<Result<Korda>> {
    try {
      const scope = await getRegionalAccessScope();
      const item = await kordaRepository.findById(id, kordaScopeWhere(scope));
      if (!item) return failure("Korda tidak ditemukan");
      return success(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data korda");
    }
  },

  async createKorda(payload: KordaCreateInput): Promise<Result<Korda>> {
    try {
      const scope = await getRegionalAccessScope();
      requireKorwilOrAdmin(scope);

      const targetKorwilId =
        scope.role === "korwil"
          ? scope.korwilId
          : payload.korwilId ?? null;

      if (scope.role === "korwil" && !targetKorwilId) {
        return failure("Akun korwil belum memiliki cakupan korwil");
      }

      if (targetKorwilId) {
        await ensureKorwilInScope(scope, targetKorwilId);
      }

      const created = await kordaRepository.create({
        ...payload,
        korwilId: targetKorwilId,
      });
      return success(created);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal membuat korda");
    }
  },

  async updateKorda(payload: KordaUpdateInput): Promise<Result<Korda>> {
    try {
      const scope = await getRegionalAccessScope();
      requireKorwilOrAdmin(scope);

      const existing = await kordaRepository.findById(
        payload.id,
        kordaScopeWhere(scope),
      );
      if (!existing) return failure("Korda tidak ditemukan");

      if (payload.data.korwilId) {
        await ensureKorwilInScope(scope, payload.data.korwilId);
      }

      const updated = await kordaRepository.update(payload.id, payload.data);
      return success(updated);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal memperbarui korda");
    }
  },

  async deleteKorda(id: string): Promise<Result<Korda>> {
    try {
      const scope = await getRegionalAccessScope();
      requireKorwilOrAdmin(scope);

      const existing = await kordaRepository.findById(id, kordaScopeWhere(scope));
      if (!existing) return failure("Korda tidak ditemukan");

      const deleted = await kordaRepository.delete(id);
      return success(deleted);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal menghapus korda");
    }
  },
};
