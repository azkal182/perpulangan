import { DropPoint } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
// import { DropPoint } from "@/generated/prisma/models";

export type DropPointCreateData = {
  name: string;
  price: number;
  kordaId: string;
};

export type DropPointUpdateData = Partial<DropPointCreateData>;

const dropPointSelect = {
  id: true,
  name: true,
  price: true,
  kordaId: true,
  korda: {
    select: {
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

export const dropPointRepository = {
  async findMany(params?: { kordaId?: string }): Promise<DropPoint[]> {
    try {
      const where = params?.kordaId ? { kordaId: params.kordaId } : undefined;
      const items = await prisma.dropPoint.findMany({
        where,
        orderBy: { name: "asc" },
        select: dropPointSelect,
      });
      logger.debug({ count: items.length, params }, "dropPointRepository.findMany success");
      return items as unknown as DropPoint[];
    } catch (error) {
      logger.error({ err: error, params }, "dropPointRepository.findMany failed");
      throw error;
    }
  },

  async findById(id: string): Promise<DropPoint | null> {
    try {
      const item = await prisma.dropPoint.findUnique({
        where: { id },
        select: dropPointSelect,
      });
      logger.debug({ id, found: !!item }, "dropPointRepository.findById success");
      return item as unknown as DropPoint;
    } catch (error) {
      logger.error({ err: error, id }, "dropPointRepository.findById failed");
      throw error;
    }
  },

  async create(data: DropPointCreateData): Promise<DropPoint> {
    try {
      const result = await prisma.dropPoint.create({
        data: {
          name: data.name,
          price: data.price,
          kordaId: data.kordaId,
        },
        select: dropPointSelect,
      });
      logger.info({ id: result.id, name: result.name }, "dropPointRepository.create success");
      return result as unknown as DropPoint;
    } catch (error) {
      logger.error({ err: error, data }, "dropPointRepository.create failed");
      throw error;
    }
  },

  async update(id: string, data: DropPointUpdateData): Promise<DropPoint> {
    try {
      const result = await prisma.dropPoint.update({
        where: { id },
        data: {
            name: data.name,
            price: data.price,
            kordaId: data.kordaId,
        },
        select: dropPointSelect,
      });
      logger.info({ id: result.id }, "dropPointRepository.update success");
      return result as unknown as DropPoint;
    } catch (error) {
      logger.error({ err: error, id, data }, "dropPointRepository.update failed");
      throw error;
    }
  },

  async delete(id: string): Promise<DropPoint> {
    try {
      const result = await prisma.dropPoint.delete({
        where: { id },
        select: dropPointSelect,
      });
      logger.info({ id: result.id }, "dropPointRepository.delete success");
      return result as unknown as DropPoint;
    } catch (error) {
      logger.error({ err: error, id }, "dropPointRepository.delete failed");
      throw error;
    }
  },
};
