import prisma from "@/lib/prisma";
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
    params?: { page?: number; limit?: number },
  ): Promise<{ items: Korwil[]; totalCount: number }> {
    if (!params?.page) {
      const items = await prisma.korwil.findMany({
        orderBy: { createdAt: "desc" },
        select: korwilSelect,
      });
      return { items, totalCount: items.length };
    }

    const page = params.page;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalCount] = await prisma.$transaction([
      prisma.korwil.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: korwilSelect,
      }),
      prisma.korwil.count(),
    ]);

    return { items, totalCount };
  },

  async findById(id: string): Promise<Korwil | null> {
    return prisma.korwil.findUnique({
      where: { id },
      select: korwilSelect,
    });
  },

  async create(data: KorwilCreateData): Promise<Korwil> {
    return prisma.korwil.create({
      data: {
        name: data.name,
        picName: data.picName ?? null,
        picPhone: data.picPhone ?? null,
        picUserId: data.picUserId ?? null,
      },
      select: korwilSelect,
    });
  },

  async update(id: string, data: KorwilUpdateData): Promise<Korwil> {
    return prisma.korwil.update({
      where: { id },
      data: {
        name: data.name,
        picName: data.picName,
        picPhone: data.picPhone,
        picUserId: data.picUserId,
      },
      select: korwilSelect,
    });
  },

  async delete(id: string): Promise<Korwil> {
    return prisma.korwil.delete({
      where: { id },
      select: korwilSelect,
    });
  },
};
