import prisma from "@/lib/prisma";
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
    const items = await prisma.regency.findMany({
      where: { kordaId },
      orderBy: { name: "asc" },
      select: regencySelect,
    });
    return items.map(mapKota);
  },

  async findById(regencyId: number): Promise<Kota | null> {
    const item = await prisma.regency.findUnique({
      where: { id: regencyId },
      select: regencySelect,
    });
    return item ? mapKota(item) : null;
  },

  async assignToKorda(regencyId: number, kordaId: string): Promise<Kota> {
    const item = await prisma.regency.update({
      where: { id: regencyId },
      data: { kordaId },
      select: regencySelect,
    });
    return mapKota(item);
  },

  async unassign(regencyId: number): Promise<Kota> {
    const item = await prisma.regency.update({
      where: { id: regencyId },
      data: { kordaId: null },
      select: regencySelect,
    });
    return mapKota(item);
  },
};
