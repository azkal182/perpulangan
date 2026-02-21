import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/server/logger";
import type { RegencyOption } from "../types";

export const regencyRepository = {
  async search(params?: {
    q?: string;
    provinceId?: number;
    limit?: number;
    where?: Prisma.RegencyWhereInput;
  }): Promise<RegencyOption[]> {
    try {
      const q = params?.q?.trim();
      const provinceId = params?.provinceId;
      const take = params?.limit ?? 50;

      // logger.debug({ q, provinceId, take }, "regencyRepository.search called");

      const where: Prisma.RegencyWhereInput = {
        ...(provinceId ? { provinceId } : {}),
        ...(q
          ? {
              OR: [
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { name: { contains: q, mode: "insensitive" as any } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { label: { contains: q, mode: "insensitive" as any } },
              ],
            }
          : {}),
        ...(params?.where ? { AND: [params.where] } : {}),
      };

      const items = await prisma.regency.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        take,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          label: true,
          type: true,
          kordaId: true,
          province: { select: { name: true } },
          // korda: { select: { name: true } },
        },
      });

      logger.debug({ q, provinceId, count: items.length }, "regencyRepository.search success");

      return items.map((item) => ({
        value: item.id,
        name: item.name,
        label: item.label ?? item.name,
        type: item.type ?? null,
        provinceName: item.province?.name ?? null,
        kordaId: item.kordaId ?? null,
        //   kordaName: item.korda?.name ?? null,
      }));
    } catch (error) {
      logger.error({ err: error, params }, "regencyRepository.search failed");
      throw error;
    }
  },
};
