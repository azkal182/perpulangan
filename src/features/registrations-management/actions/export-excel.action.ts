"use server";

import prisma from "@/lib/prisma";
import type { Prisma, RegistrationStatus } from "@/generated/prisma/client";
import {
  andWhere,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";
import type {
  RegistrationExportKorwilSheet,
  RegistrationExportRow,
} from "../lib/registration-excel";

interface ExportRegistrationsExcelParams {
  eventId: string;
  journeyType?: "both" | "return_only" | "outbound_only" | "all";
  status?: RegistrationStatus | "all";
  gender?: "Laki-laki" | "Perempuan";
  kordaId?: string;
  dropPointId?: string;
  search?: string;
}

function mapGenderToShortLabel(value: string | null | undefined): "L" | "P" | "-" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "laki-laki") {
    return "L";
  }
  if (normalized === "perempuan") {
    return "P";
  }
  return "-";
}

function sortLocale(a: string, b: string): number {
  return a.localeCompare(b, "id", { sensitivity: "base" });
}

export async function getRegistrationsForExcelExportAction(
  params: ExportRegistrationsExcelParams,
): Promise<{
  success: boolean;
  data?: RegistrationExportKorwilSheet[];
  totalRows?: number;
  error?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    const {
      eventId,
      journeyType = "all",
      status = "all",
      gender,
      kordaId,
      dropPointId,
      search,
    } = params;

    const where: Prisma.RegistrationWhereInput = {
      eventId,
      outboundKordaId: { not: null },
      outboundDropPointId: { not: null },
    };

    if (journeyType === "both") {
      where.AND = [
        { outboundDate: { not: null } },
        { returnDate: { not: null } },
      ];
    } else if (journeyType === "return_only") {
      where.outboundDate = null;
      where.returnDate = { not: null };
    } else if (journeyType === "outbound_only") {
      where.outboundDate = { not: null };
      where.returnDate = null;
    }

    if (status !== "all") {
      where.status = status;
    }

    if (kordaId) {
      where.outboundKordaId = kordaId;
    }

    if (dropPointId) {
      where.outboundDropPointId = dropPointId;
    }

    const studentConditions: Prisma.StudentWhereInput[] = [];

    if (gender) {
      studentConditions.push({ gender });
    }

    if (search?.trim()) {
      studentConditions.push({
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { nis: { contains: search.trim(), mode: "insensitive" } },
        ],
      });
    }

    if (studentConditions.length === 1) {
      where.student = studentConditions[0];
    } else if (studentConditions.length > 1) {
      where.student = { AND: studentConditions };
    }

    const finalWhere = andWhere(where, registrationScopeWhere(scope));

    const registrations = await prisma.registration.findMany({
      where: finalWhere,
      select: {
        student: {
          select: {
            name: true,
            gender: true,
          },
        },
        outboundKorda: {
          select: {
            name: true,
            korwil: {
              select: {
                name: true,
              },
            },
          },
        },
        outboundDropPoint: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { outboundKorda: { korwil: { name: "asc" } } },
        { outboundKorda: { name: "asc" } },
        { outboundDropPoint: { name: "asc" } },
        { student: { name: "asc" } },
      ],
    });

    const grouped = new Map<string, Map<string, RegistrationExportRow[]>>();

    registrations.forEach((registration) => {
      const korwilName = registration.outboundKorda?.korwil?.name || "Tanpa Korwil";
      const kordaName = registration.outboundKorda?.name || "Tanpa Korda Outbound";

      if (!grouped.has(korwilName)) {
        grouped.set(korwilName, new Map<string, RegistrationExportRow[]>());
      }

      const kordaMap = grouped.get(korwilName)!;
      if (!kordaMap.has(kordaName)) {
        kordaMap.set(kordaName, []);
      }

      kordaMap.get(kordaName)!.push({
        studentName: registration.student.name,
        gender: mapGenderToShortLabel(registration.student.gender),
        outboundKorda: registration.outboundKorda?.name || "-",
        outboundDropPoint: registration.outboundDropPoint?.name || "-",
        bus: "",
      });
    });

    const data: RegistrationExportKorwilSheet[] = Array.from(grouped.entries())
      .map(([korwilName, kordaMap]) => {
        const kordas = Array.from(kordaMap.entries())
          .map(([kordaName, rows]) => ({
            kordaName,
            rows: rows.sort((a, b) => {
              const byDropPoint = sortLocale(a.outboundDropPoint, b.outboundDropPoint);
              if (byDropPoint !== 0) {
                return byDropPoint;
              }
              return sortLocale(a.studentName, b.studentName);
            }),
          }))
          .sort((a, b) => sortLocale(a.kordaName, b.kordaName));

        return {
          korwilName,
          kordas,
        };
      })
      .sort((a, b) => sortLocale(a.korwilName, b.korwilName));

    const totalRows = data.reduce(
      (sum, sheet) =>
        sum + sheet.kordas.reduce((sheetSum, korda) => sheetSum + korda.rows.length, 0),
      0,
    );

    return {
      success: true,
      data,
      totalRows,
    };
  } catch (error) {
    console.error("Failed to export registrations to Excel:", error);
    return {
      success: false,
      error: "Gagal menyiapkan data export Excel",
    };
  }
}
