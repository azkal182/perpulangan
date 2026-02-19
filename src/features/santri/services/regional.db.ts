"use server";

import prisma from "@/lib/prisma";

export async function getProvinces() {
  return await prisma.province.findMany({
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getRegencies() {
  return await prisma.regency.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      label: true,
      provinceId: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getDistricts(regencyId: number) {
  return await prisma.district.findMany({
    where: { regencyId },
    select: {
      id: true,
      code: true,
      name: true,
      regencyId: true,
    },
    orderBy: { name: "asc" },
  });
}
