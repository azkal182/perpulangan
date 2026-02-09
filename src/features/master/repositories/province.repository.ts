import prisma from "@/lib/prisma";
import type { ProvinceOption } from "../types";

export const provinceRepository = {
  async search(params?: {
    q?: string;
    limit?: number;
  }): Promise<ProvinceOption[]> {
    const q = params?.q?.trim();
    const take = params?.limit ?? 50;

    const items = await prisma.province.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      take,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });

    return items.map((item) => ({
      value: item.id,
      name: item.name,
      label: item.name,
      code: item.code,
    }));
  },
};
