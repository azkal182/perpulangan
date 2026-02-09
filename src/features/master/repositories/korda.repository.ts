import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import type { Korda } from "../types";

export type KordaCreateData = {
  name: string;
  korwilId?: string | null;
  picName?: string | null;
  picPhone?: string | null;
  picUserId?: string | null;
};

export type KordaUpdateData = Partial<KordaCreateData>;

const kordaSelect = {
  id: true,
  name: true,
  korwilId: true,
  picName: true,
  picPhone: true,
  picUserId: true,
  createdAt: true,
  updatedAt: true,
};

export const kordaRepository = {
  // Method fleksibel: jika params ada, gunakan pagination. Jika tidak, ambil semua.
  async findMany(
    params?: { page?: number; limit?: number; korwilId?: string },
  ): Promise<{ items: Korda[]; totalCount: number }> {
    try {
      const where =
        params?.korwilId !== undefined ? { korwilId: params.korwilId } : undefined;

      if (!params?.page) {
        const items = await prisma.korda.findMany({
          orderBy: { createdAt: "desc" },
          where,
          select: kordaSelect,
        });
        logger.debug({ count: items.length }, "kordaRepository.findMany success");
        return { items, totalCount: items.length };
      }

      const page = params.page;
      const limit = params.limit ?? 10;
      const skip = (page - 1) * limit;

      const [items, totalCount] = await prisma.$transaction([
        prisma.korda.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          where,
          select: kordaSelect,
        }),
        prisma.korda.count({ where }),
      ]);

      logger.debug({ count: items.length, totalCount, page }, "kordaRepository.findMany paginated success");
      return { items, totalCount };
    } catch (error) {
      logger.error({ err: error, params }, "kordaRepository.findMany failed");
      throw error;
    }
  },

  async findById(id: string): Promise<Korda | null> {
    try {
      const item = await prisma.korda.findUnique({
        where: { id },
        select: kordaSelect,
      });
      logger.debug({ id, found: !!item }, "kordaRepository.findById success");
      return item;
    } catch (error) {
      logger.error({ err: error, id }, "kordaRepository.findById failed");
      throw error;
    }
  },

  async create(data: KordaCreateData): Promise<Korda> {
    try {
      const result = await prisma.korda.create({
        data: {
          name: data.name,
          korwilId: data.korwilId ?? null,
          picName: data.picName ?? null,
          picPhone: data.picPhone ?? null,
          picUserId: data.picUserId ?? null,
        },
        select: kordaSelect,
      });
      logger.info({ id: result.id, name: result.name }, "kordaRepository.create success");
      return result;
    } catch (error) {
      logger.error({ err: error, data }, "kordaRepository.create failed");
      throw error;
    }
  },

  async update(id: string, data: KordaUpdateData): Promise<Korda> {
    try {
      const result = await prisma.korda.update({
        where: { id },
        data: {
          name: data.name,
          korwilId: data.korwilId,
          picName: data.picName,
          picPhone: data.picPhone,
          picUserId: data.picUserId,
        },
        select: kordaSelect,
      });
      logger.info({ id: result.id }, "kordaRepository.update success");
      return result;
    } catch (error) {
      logger.error({ err: error, id, data }, "kordaRepository.update failed");
      throw error;
    }
  },

  async delete(id: string): Promise<Korda> {
    try {
      const result = await prisma.korda.delete({
        where: { id },
        select: kordaSelect,
      });
      logger.info({ id: result.id }, "kordaRepository.delete success");
      return result;
    } catch (error) {
      logger.error({ err: error, id }, "kordaRepository.delete failed");
      throw error;
    }
  },
};
