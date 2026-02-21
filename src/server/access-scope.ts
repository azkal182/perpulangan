import "server-only";

import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { roleOptions, type AppRole } from "@/lib/auth-access";
import prisma from "@/server/db/prisma";
import { auth } from "@/server/auth";

export type RegionalAccessScope = {
  userId: string;
  role: AppRole;
  korwilId: string | null;
  kordaId: string | null;
};

export class AccessDeniedError extends Error {
  constructor(message = "Akses ditolak") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

function normalizeRole(value: string | null | undefined): AppRole {
  if (!value) return "korda";
  if ((roleOptions as readonly string[]).includes(value)) {
    return value as AppRole;
  }
  return "korda";
}

export async function getRegionalAccessScope(): Promise<RegionalAccessScope> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id;
  if (!userId) {
    throw new AccessDeniedError("Sesi tidak ditemukan");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      kordapic: {
        select: {
          id: true,
          korwilId: true,
        },
      },
      korwilpic: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!user) {
    throw new AccessDeniedError("User tidak ditemukan");
  }

  const role = normalizeRole(user.role);

  if (role === "admin") {
    return {
      userId,
      role,
      korwilId: null,
      kordaId: null,
    };
  }

  if (role === "korwil") {
    return {
      userId,
      role,
      korwilId: user.korwilpic?.id ?? user.kordapic?.korwilId ?? null,
      kordaId: null,
    };
  }

  return {
    userId,
    role,
    korwilId: user.kordapic?.korwilId ?? user.korwilpic?.id ?? null,
    kordaId: user.kordapic?.id ?? null,
  };
}

export function isAdmin(scope: RegionalAccessScope) {
  return scope.role === "admin";
}

export function requireAdmin(scope: RegionalAccessScope) {
  if (!isAdmin(scope)) {
    throw new AccessDeniedError("Hanya admin yang dapat melakukan aksi ini");
  }
}

export function requireKorwilOrAdmin(scope: RegionalAccessScope) {
  if (scope.role === "admin" || scope.role === "korwil") return;
  throw new AccessDeniedError("Akses hanya untuk admin atau korwil");
}

export function andWhere<T extends Record<string, unknown>>(
  ...clauses: Array<T | undefined>
): T | undefined {
  const valid = clauses.filter(Boolean) as T[];
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  return { AND: valid } as unknown as T;
}

export function korwilScopeWhere(
  scope: RegionalAccessScope,
): Prisma.KorwilWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (!scope.korwilId) return { id: "__NO_ACCESS__" };
  return { id: scope.korwilId };
}

export function kordaScopeWhere(
  scope: RegionalAccessScope,
): Prisma.KordaWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: "__NO_ACCESS__" };
    return { korwilId: scope.korwilId };
  }
  if (!scope.kordaId) return { id: "__NO_ACCESS__" };
  return { id: scope.kordaId };
}

export function regencyScopeWhere(
  scope: RegionalAccessScope,
): Prisma.RegencyWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: -1 };
    return { korda: { korwilId: scope.korwilId } };
  }
  if (!scope.kordaId) return { id: -1 };
  return { kordaId: scope.kordaId };
}

export function dropPointScopeWhere(
  scope: RegionalAccessScope,
): Prisma.DropPointWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: "__NO_ACCESS__" };
    return { korda: { korwilId: scope.korwilId } };
  }
  if (!scope.kordaId) return { id: "__NO_ACCESS__" };
  return { kordaId: scope.kordaId };
}

export function studentScopeWhere(
  scope: RegionalAccessScope,
): Prisma.StudentWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: "__NO_ACCESS__" };
    return {
      regency: {
        korda: {
          korwilId: scope.korwilId,
        },
      },
    };
  }
  if (!scope.kordaId) return { id: "__NO_ACCESS__" };
  return {
    regency: {
      kordaId: scope.kordaId,
    },
  };
}

export function registrationScopeWhere(
  scope: RegionalAccessScope,
): Prisma.RegistrationWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: "__NO_ACCESS__" };
    return {
      OR: [
        { outboundKorda: { korwilId: scope.korwilId } },
        { returnKorda: { korwilId: scope.korwilId } },
      ],
    };
  }
  if (!scope.kordaId) return { id: "__NO_ACCESS__" };
  return {
    OR: [{ outboundKordaId: scope.kordaId }, { returnKordaId: scope.kordaId }],
  };
}

export function busScopeWhere(
  scope: RegionalAccessScope,
): Prisma.BusWhereInput | undefined {
  if (scope.role === "admin") return undefined;
  if (scope.role === "korwil") {
    if (!scope.korwilId) return { id: "__NO_ACCESS__" };
    return {
      OR: [
        { korwilId: scope.korwilId },
        { kordas: { some: { korda: { korwilId: scope.korwilId } } } },
      ],
    };
  }
  if (!scope.kordaId) return { id: "__NO_ACCESS__" };
  return {
    kordas: {
      some: {
        kordaId: scope.kordaId,
      },
    },
  };
}

export function ensureKorwilInScope(
  scope: RegionalAccessScope,
  korwilId: string,
  message = "Korwil di luar cakupan akses",
) {
  if (scope.role === "admin") return;
  if (scope.korwilId === korwilId) return;
  throw new AccessDeniedError(message);
}

export async function ensureKordaInScope(
  scope: RegionalAccessScope,
  kordaId: string,
  message = "Korda di luar cakupan akses",
) {
  if (scope.role === "admin") return;

  if (scope.role === "korda") {
    if (scope.kordaId === kordaId) return;
    throw new AccessDeniedError(message);
  }

  const hasAccess = await prisma.korda.count({
    where: {
      id: kordaId,
      korwilId: scope.korwilId ?? "__NO_ACCESS__",
    },
  });

  if (!hasAccess) {
    throw new AccessDeniedError(message);
  }
}
