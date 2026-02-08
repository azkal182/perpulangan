import prisma from "@/lib/prisma";
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
    const where =
      params?.korwilId !== undefined ? { korwilId: params.korwilId } : undefined;

    if (!params?.page) {
      const items = await prisma.korda.findMany({
        orderBy: { createdAt: "desc" },
        where,
        select: kordaSelect,
      });
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

    return { items, totalCount };
  },

  async findById(id: string): Promise<Korda | null> {
    return prisma.korda.findUnique({
      where: { id },
      select: kordaSelect,
    });
  },

  async create(data: KordaCreateData): Promise<Korda> {
    return prisma.korda.create({
      data: {
        name: data.name,
        korwilId: data.korwilId ?? null,
        picName: data.picName ?? null,
        picPhone: data.picPhone ?? null,
        picUserId: data.picUserId ?? null,
      },
      select: kordaSelect,
    });
  },

  async update(id: string, data: KordaUpdateData): Promise<Korda> {
    return prisma.korda.update({
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
  },

  async delete(id: string): Promise<Korda> {
    return prisma.korda.delete({
      where: { id },
      select: kordaSelect,
    });
  },
};
