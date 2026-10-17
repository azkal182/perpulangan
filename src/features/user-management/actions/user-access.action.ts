"use server";

import { auth } from "@/server/auth";
import prisma from "@/server/db/prisma";
import { roleOptions, type AppRole } from "@/lib/auth-access";
import {
  AccessDeniedError,
  ensureKordaInScope,
  ensureKorwilInScope,
  getRegionalAccessScope,
  kordaScopeWhere,
  korwilScopeWhere,
  requireKorwilOrAdmin,
} from "@/server/access-scope";

export type KorwilAccessOption = {
  id: string;
  name: string;
};

export type KordaAccessOption = {
  id: string;
  name: string;
  korwilId: string | null;
  korwilName: string | null;
};

export type UserRegionalAccess = {
  userId: string;
  role: AppRole;
  korwilId: string | null;
  korwilName: string | null;
  kordaId: string | null;
  kordaName: string | null;
  kordaKorwilId: string | null;
};

function normalizeRole(value: string | null | undefined): AppRole {
  if (!value) return "korda";
  if ((roleOptions as readonly string[]).includes(value)) {
    return value as AppRole;
  }
  return "korda";
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail<T>(error: string): ActionResult<T> {
  return { success: false, error };
}

function mapUserAccess(item: {
  id: string;
  role: string;
  korwilpic: { id: string; name: string } | null;
  kordapic: {
    id: string;
    name: string;
    korwilId: string | null;
    korwil: { id: string; name: string } | null;
  } | null;
}): UserRegionalAccess {
  return {
    userId: item.id,
    role: normalizeRole(item.role),
    korwilId: item.korwilpic?.id ?? item.kordapic?.korwilId ?? null,
    korwilName: item.korwilpic?.name ?? item.kordapic?.korwil?.name ?? null,
    kordaId: item.kordapic?.id ?? null,
    kordaName: item.kordapic?.name ?? null,
    kordaKorwilId: item.kordapic?.korwilId ?? null,
  };
}

function buildKorwilUserFilter(korwilId: string | null) {
  if (!korwilId) {
    return { id: "__NO_ACCESS__" };
  }

  return {
    OR: [
      { korwilpic: { is: { id: korwilId } } },
      { kordapic: { is: { korwilId } } },
    ],
  };
}

export async function getUserAccessOptions(): Promise<
  ActionResult<{
    korwils: KorwilAccessOption[];
    kordas: KordaAccessOption[];
  }>
> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);

    const [korwils, kordas] = await Promise.all([
      prisma.korwil.findMany({
        where: korwilScopeWhere(scope),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.korda.findMany({
        where: kordaScopeWhere(scope),
        select: {
          id: true,
          name: true,
          korwilId: true,
          korwil: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      success: true,
      data: {
        korwils,
        kordas: kordas.map((k) => ({
          id: k.id,
          name: k.name,
          korwilId: k.korwilId ?? null,
          korwilName: k.korwil?.name ?? null,
        })),
      },
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return fail(error.message);
    }
    return fail("Gagal memuat opsi akses wilayah");
  }
}

export async function getUsersRegionalAccess(
  userIds: string[],
): Promise<ActionResult<Record<string, UserRegionalAccess>>> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);

    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { success: true, data: {} };
    }

    const where =
      scope.role === "admin"
        ? { id: { in: uniqueIds } }
        : {
            AND: [
              { id: { in: uniqueIds } },
              buildKorwilUserFilter(scope.korwilId),
            ],
          };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        role: true,
        korwilpic: {
          select: {
            id: true,
            name: true,
          },
        },
        kordapic: {
          select: {
            id: true,
            name: true,
            korwilId: true,
            korwil: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const map: Record<string, UserRegionalAccess> = {};
    for (const user of users) {
      map[user.id] = mapUserAccess(user);
    }

    return { success: true, data: map };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return fail(error.message);
    }
    return fail("Gagal memuat akses regional user");
  }
}

export async function updateUserRegionalAccess(input: {
  userId: string;
  role: AppRole;
  korwilId?: string | null;
  kordaId?: string | null;
}): Promise<ActionResult<UserRegionalAccess>> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);

    if (scope.role === "korwil" && input.role !== "korda") {
      return fail("Korwil hanya dapat mengatur user role korda");
    }

    if (input.role === "admin" && scope.role !== "admin") {
      return fail("Hanya admin yang dapat menetapkan role admin");
    }

    if (input.role === "korwil" && scope.role !== "admin") {
      return fail("Hanya admin yang dapat menetapkan role korwil");
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
        korwilpic: {
          select: { id: true, name: true },
        },
        kordapic: {
          select: {
            id: true,
            name: true,
            korwilId: true,
            korwil: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return fail("User tidak ditemukan");
    }

    if (scope.role === "korwil") {
      const outOfScopeKorwil =
        user.korwilpic && user.korwilpic.id !== scope.korwilId;
      const outOfScopeKorda =
        user.kordapic && user.kordapic.korwilId !== scope.korwilId;
      if (outOfScopeKorwil || outOfScopeKorda) {
        return fail("User berada di luar cakupan korwil Anda");
      }
    }

    const korwilId = input.korwilId?.trim() || null;
    const kordaId = input.kordaId?.trim() || null;

    if (input.role === "korwil") {
      if (!korwilId) {
        return fail("Korwil wajib dipilih untuk role korwil");
      }
      await ensureKorwilInScope(scope, korwilId);
    }

    if (input.role === "korda") {
      if (!kordaId) {
        return fail("Korda wajib dipilih untuk role korda");
      }
      await ensureKordaInScope(scope, kordaId);
    }

    await prisma.$transaction(async (tx) => {
      // clear existing regional assignment for this user
      await tx.korwil.updateMany({
        where: { picUserId: input.userId },
        data: { picUserId: null },
      });

      await tx.korda.updateMany({
        where: { picUserId: input.userId },
        data: { picUserId: null },
      });

      if (input.role === "korwil" && korwilId) {
        const target = await tx.korwil.findUnique({
          where: { id: korwilId },
          select: { id: true, picUserId: true },
        });

        if (!target) {
          throw new AccessDeniedError("Korwil tidak ditemukan");
        }

        if (target.picUserId && target.picUserId !== input.userId) {
          throw new AccessDeniedError(
            "Korwil ini sudah terhubung ke user lain",
          );
        }

        await tx.korwil.update({
          where: { id: korwilId },
          data: { picUserId: input.userId },
        });
      }

      if (input.role === "korda" && kordaId) {
        const target = await tx.korda.findUnique({
          where: { id: kordaId },
          select: { id: true, picUserId: true },
        });

        if (!target) {
          throw new AccessDeniedError("Korda tidak ditemukan");
        }

        if (target.picUserId && target.picUserId !== input.userId) {
          throw new AccessDeniedError("Korda ini sudah terhubung ke user lain");
        }

        await tx.korda.update({
          where: { id: kordaId },
          data: { picUserId: input.userId },
        });
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
        korwilpic: {
          select: { id: true, name: true },
        },
        kordapic: {
          select: {
            id: true,
            name: true,
            korwilId: true,
            korwil: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!updated) {
      return fail("User tidak ditemukan");
    }

    return {
      success: true,
      data: mapUserAccess(updated),
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return fail(error.message);
    }
    return fail("Gagal memperbarui akses wilayah user");
  }
}

/**
 * Set a password for a managed user, creating the Better Auth credential
 * account when the user was initially created without a password.
 * Better Auth's admin setUserPassword endpoint only updates an existing
 * credential account and silently succeeds when one does not exist.
 */
export async function setManagedUserPassword(input: {
  userId: string;
  newPassword: string;
}): Promise<ActionResult<null>> {
  try {
    const scope = await getRegionalAccessScope();
    requireKorwilOrAdmin(scope);

    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        korwilpic: { select: { id: true } },
        kordapic: { select: { korwilId: true } },
      },
    });

    if (!target) return fail("User tidak ditemukan");
    if (
      scope.role === "korwil" &&
      target.korwilpic?.id !== scope.korwilId &&
      target.kordapic?.korwilId !== scope.korwilId
    ) {
      return fail("User berada di luar cakupan korwil Anda");
    }

    const authContext = await auth.$context;
    const password = input.newPassword;
    if (password.length < authContext.password.config.minPasswordLength) {
      return fail(
        `Password minimal ${authContext.password.config.minPasswordLength} karakter`,
      );
    }
    if (password.length > authContext.password.config.maxPasswordLength) {
      return fail(
        `Password maksimal ${authContext.password.config.maxPasswordLength} karakter`,
      );
    }

    const hashedPassword = await authContext.password.hash(password);
    await prisma.$transaction(async (tx) => {
      const credential = await tx.account.findFirst({
        where: { userId: target.id, providerId: "credential" },
        select: { id: true },
      });

      if (credential) {
        await tx.account.update({
          where: { id: credential.id },
          data: { password: hashedPassword },
        });
        return;
      }

      await tx.account.create({
        data: {
          id: authContext.generateId({ model: "account" }) || crypto.randomUUID(),
          accountId: target.id,
          providerId: "credential",
          userId: target.id,
          password: hashedPassword,
        },
      });
    });

    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return fail(error.message);
    }
    return fail("Gagal menyimpan password user");
  }
}
