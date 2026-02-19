"use server";

import prisma from "@/lib/prisma";

export interface ProvinceOption {
  id: number;
  name: string;
}

export interface RegencyOption {
  id: number;
  name: string;
  label: string | null; // label yang ditampilkan di UI
  provinceId: number;
}

export async function getProvinces(query?: string): Promise<ProvinceOption[]> {
  const provinces = await prisma.province.findMany({
    where: query?.trim()
      ? { name: { contains: query.trim(), mode: "insensitive" } }
      : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });
  return provinces;
}

export async function getRegenciesByProvince(
  provinceId: number,
  query?: string,
): Promise<RegencyOption[]> {
  const regencies = await prisma.regency.findMany({
    where: {
      provinceId,
      ...(query?.trim()
        ? {
            OR: [
              { name: { contains: query.trim(), mode: "insensitive" } },
              { label: { contains: query.trim(), mode: "insensitive" } },
            ],
          }
        : undefined),
    },
    select: { id: true, name: true, label: true, provinceId: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return regencies;
}
