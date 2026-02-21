import { failure, Result, success } from "@/lib/result";
import {
  AccessDeniedError,
  ensureKordaInScope,
  getRegionalAccessScope,
  requireKorwilOrAdmin,
} from "@/server/access-scope";
import type { Kota } from "../types";
import { kotaRepository } from "../repositories/kota.repository";
import type {
  KotaCreateInput,
  KotaDeleteInput,
  KotaListInput,
} from "../validators/kota.validator";

export const kotaService = {
  async getKota(input: KotaListInput): Promise<Result<Kota[]>> {
    try {
      const scope = await getRegionalAccessScope();
      await ensureKordaInScope(scope, input.kordaId);

      const items = await kotaRepository.findManyByKorda(input.kordaId);
      return success(items);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal mengambil data kota");
    }
  },

  async createKota(payload: KotaCreateInput): Promise<Result<Kota>> {
    try {
      const scope = await getRegionalAccessScope();
      requireKorwilOrAdmin(scope);
      await ensureKordaInScope(scope, payload.kordaId);

      const existing = await kotaRepository.findById(payload.regencyId);
      if (!existing) return failure("Kota tidak ditemukan");
      if (existing.kordaId && existing.kordaId !== payload.kordaId) {
        return failure("Kota sudah terdaftar di korda lain");
      }
      if (existing.kordaId === payload.kordaId) {
        return success(existing);
      }

      const created = await kotaRepository.assignToKorda(
        payload.regencyId,
        payload.kordaId,
      );
      return success(created);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal menambahkan kota");
    }
  },

  async deleteKota(input: KotaDeleteInput): Promise<Result<Kota>> {
    try {
      const scope = await getRegionalAccessScope();
      requireKorwilOrAdmin(scope);
      await ensureKordaInScope(scope, input.kordaId);

      const existing = await kotaRepository.findById(input.id);
      if (!existing) return failure("Kota tidak ditemukan");
      if (!existing.kordaId || existing.kordaId !== input.kordaId) {
        return failure("Kota tidak terdaftar di korda ini");
      }
      const deleted = await kotaRepository.unassign(input.id);
      return success(deleted);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        return failure(e.message);
      }
      return failure("Gagal menghapus kota");
    }
  },
};
