"use server";

import prisma from "@/lib/prisma";
import {
  andWhere,
  getRegionalAccessScope,
  isAdmin,
  regencyScopeWhere,
} from "@/server/access-scope";

export async function getProvinces() {
  const scope = await getRegionalAccessScope();
  const scopeWhere = regencyScopeWhere(scope);

  return await prisma.province.findMany({
    where:
      !isAdmin(scope) && scopeWhere
        ? {
            regencies: {
              some: scopeWhere,
            },
          }
        : undefined,
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getRegencies() {
  const scope = await getRegionalAccessScope();
  return await prisma.regency.findMany({
    where: regencyScopeWhere(scope),
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
  const scope = await getRegionalAccessScope();
  const allowedRegency = await prisma.regency.count({
    where: andWhere({ id: regencyId }, regencyScopeWhere(scope)),
  });

  if (!allowedRegency) return [];

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
