import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import type { Kota } from "../types";

const regencySelect = {
  id: true,
  name: true,
  label: true,
  type: true,
  kordaId: true,
  province: { select: { name: true } },
};

type RegencyRecord = {
  id: number;
  name: string;
  label: string | null;
  type: string | null;
  kordaId: string | null;
  province: { name: string } | null;
};

function mapKota(item: RegencyRecord): Kota {
  return {
    id: item.id,
    name: item.label ?? item.name,
    regencyName: item.name,
    regencyLabel: item.label ?? null,
    regencyType: item.type ?? null,
    provinceName: item.province?.name ?? null,
    kordaId: item.kordaId ?? null,
  };
}

export const kotaRepository = {
  async findManyByKorda(kordaId: string): Promise<Kota[]> {
    try {
      const items = await prisma.regency.findMany({
        where: { kordaId },
        orderBy: { name: "asc" },
        select: regencySelect,
      });
      logger.debug({ count: items.length, kordaId }, "kotaRepository.findManyByKorda success");
      return items.map(mapKota);
    } catch (error) {
      logger.error({ err: error, kordaId }, "kotaRepository.findManyByKorda failed");
      throw error;
    }
  },

  async findById(regencyId: number): Promise<Kota | null> {
    try {
      const item = await prisma.regency.findUnique({
        where: { id: regencyId },
        select: regencySelect,
      });
      logger.debug({ regencyId, found: !!item }, "kotaRepository.findById success");
      return item ? mapKota(item) : null;
    } catch (error) {
      logger.error({ err: error, regencyId }, "kotaRepository.findById failed");
      throw error;
    }
  },

  async assignToKorda(regencyId: number, kordaId: string): Promise<Kota> {
    try {
      const item = await prisma.regency.update({
        where: { id: regencyId },
        data: { kordaId },
        select: regencySelect,
      });
      logger.info({ regencyId, kordaId }, "kotaRepository.assignToKorda success");
      return mapKota(item);
    } catch (error) {
      logger.error({ err: error, regencyId, kordaId }, "kotaRepository.assignToKorda failed");
      throw error;
    }
  },

  async unassign(regencyId: number): Promise<Kota> {
    try {
      const item = await prisma.regency.update({
        where: { id: regencyId },
        data: { kordaId: null },
        select: regencySelect,
      });
      logger.info({ regencyId }, "kotaRepository.unassign success");
      return mapKota(item);
    } catch (error) {
      logger.error({ err: error, regencyId }, "kotaRepository.unassign failed");
      throw error;
    }
  },
};
