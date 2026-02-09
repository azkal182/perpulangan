import prisma from "@/lib/prisma";
import type { RegencyOption } from "../types";

export const regencyRepository = {
  async search(params?: {
    q?: string;
    provinceId?: number;
    limit?: number;
  }): Promise<RegencyOption[]> {
    const q = params?.q?.trim();
    const provinceId = params?.provinceId;
    const take = params?.limit ?? 50;

    console.log("regencyRepository.search called", { q, provinceId, take });

    const where = {
      ...(provinceId ? { provinceId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
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

    console.log("regencyRepository.search", {
      q,
      provinceId,
      take,
      found: items.length,
    });
    return items.map((item) => ({
      value: item.id,
      name: item.name,
      label: item.label ?? item.name,
      type: item.type ?? null,
      provinceName: item.province?.name ?? null,
      kordaId: item.kordaId ?? null,
      //   kordaName: item.korda?.name ?? null,
    }));
  },
};
