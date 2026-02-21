import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/server/logger";
import type { Korwil } from "../types";

export type KorwilCreateData = {
  name: string;
  picName?: string | null;
  picPhone?: string | null;
  picUserId?: string | null;
};

export type KorwilUpdateData = Partial<KorwilCreateData>;

const korwilSelect = {
  id: true,
  name: true,
  picName: true,
  picPhone: true,
  picUserId: true,
  createdAt: true,
  updatedAt: true,
};

export const korwilRepository = {
  async findMany(
    params?: { page?: number; limit?: number; where?: Prisma.KorwilWhereInput },
  ): Promise<{ items: Korwil[]; totalCount: number }> {
    try {
      const where = params?.where;

      if (!params?.page) {
        const items = await prisma.korwil.findMany({
          where,
          orderBy: { createdAt: "desc" },
          select: korwilSelect,
        });
        logger.debug({ count: items.length }, "korwilRepository.findMany success");
        return { items, totalCount: items.length };
      }

      const page = params.page;
      const limit = params.limit ?? 10;
      const skip = (page - 1) * limit;

      const [items, totalCount] = await prisma.$transaction([
        prisma.korwil.findMany({
          skip,
          take: limit,
          where,
          orderBy: { createdAt: "desc" },
          select: korwilSelect,
        }),
        prisma.korwil.count({ where }),
      ]);

      logger.debug({ count: items.length, totalCount, page }, "korwilRepository.findMany paginated success");
      return { items, totalCount };
    } catch (error) {
      logger.error({ err: error, params }, "korwilRepository.findMany failed");
      throw error;
    }
  },

  async findById(
    id: string,
    where?: Prisma.KorwilWhereInput,
  ): Promise<Korwil | null> {
    try {
      const item = await prisma.korwil.findFirst({
        where: where ? { AND: [{ id }, where] } : { id },
        select: korwilSelect,
      });
      logger.debug({ id, found: !!item }, "korwilRepository.findById success");
      return item;
    } catch (error) {
      logger.error({ err: error, id }, "korwilRepository.findById failed");
      throw error;
    }
  },

  async create(data: KorwilCreateData): Promise<Korwil> {
    try {
      const result = await prisma.korwil.create({
        data: {
          name: data.name,
          picName: data.picName ?? null,
          picPhone: data.picPhone ?? null,
          picUserId: data.picUserId ?? null,
        },
        select: korwilSelect,
      });
      logger.info({ id: result.id, name: result.name }, "korwilRepository.create success");
      return result;
    } catch (error) {
      logger.error({ err: error, data }, "korwilRepository.create failed");
      throw error;
    }
  },

  async update(id: string, data: KorwilUpdateData): Promise<Korwil> {
    try {
      const result = await prisma.korwil.update({
        where: { id },
        data: {
          name: data.name,
          picName: data.picName,
          picPhone: data.picPhone,
          picUserId: data.picUserId,
        },
        select: korwilSelect,
      });
      logger.info({ id: result.id }, "korwilRepository.update success");
      return result;
    } catch (error) {
      logger.error({ err: error, id, data }, "korwilRepository.update failed");
      throw error;
    }
  },

  async delete(id: string): Promise<Korwil> {
    try {
      const result = await prisma.korwil.delete({
        where: { id },
        select: korwilSelect,
      });
      logger.info({ id: result.id }, "korwilRepository.delete success");
      return result;
    } catch (error) {
      logger.error({ err: error, id }, "korwilRepository.delete failed");
      throw error;
    }
  },
};
