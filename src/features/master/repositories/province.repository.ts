import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/server/logger";
import type { ProvinceOption } from "../types";

export const provinceRepository = {
  async search(params?: {
    q?: string;
    limit?: number;
    where?: Prisma.ProvinceWhereInput;
  }): Promise<ProvinceOption[]> {
    try {
      const q = params?.q?.trim();
      const take = params?.limit ?? 50;

      const items = await prisma.province.findMany({
        where: {
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          ...(params?.where ?? {}),
        },
        take,
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      });

      logger.debug({ q, count: items.length }, "provinceRepository.search success");

      return items.map((item) => ({
        value: item.id,
        name: item.name,
        label: item.name,
        code: item.code,
      }));
    } catch (error) {
      logger.error({ err: error, params }, "provinceRepository.search failed");
      throw error;
    }
  },
};
