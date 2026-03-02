"use server";

import prisma from "@/lib/prisma";
import type { PrintDataItem } from "../lib/print-utils";
import type { Prisma } from "@/generated/prisma/client";
import {
  AccessDeniedError,
  andWhere,
  ensureKordaInScope,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";

export interface GetPrintDataParams {
  eventId: string;
  gender?: "Laki-laki" | "Perempuan";
  kordaId?: string;
  kordaIds?: string[];
  dropPointId?: string;
  studentName?: string;
  journeyType?: "outbound" | "return" | "both";
}

export async function getPrintDataAction(
  params: GetPrintDataParams,
): Promise<{ success: boolean; data?: PrintDataItem[]; error?: string }> {
  try {
    const scope = await getRegionalAccessScope();
    const {
      eventId,
      gender,
      journeyType,
      kordaId,
      kordaIds,
      dropPointId,
      studentName,
    } = params;
    const selectedKordaIds = Array.from(
      new Set([...(kordaIds ?? []), ...(kordaId ? [kordaId] : [])]),
    ).filter((value): value is string => value.length > 0);

    // Build where clause - simplified, just need drop points
    const where: Prisma.RegistrationWhereInput = {
      eventId,
      // Don't filter by status - print all registrations
      OR: [
        { outboundDropPointId: { not: null } },
        { returnDropPointId: { not: null } },
      ],
    };

    const studentFilter: Prisma.StudentWhereInput = {};
    if (gender) {
      studentFilter.gender = gender;
    }
    if (studentName) {
      studentFilter.name = {
        contains: studentName,
        mode: "insensitive",
      };
    }
    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    // Korda filter (either outbound or return)
    if (selectedKordaIds.length > 0) {
      await Promise.all(
        selectedKordaIds.map((selectedKordaId) =>
          ensureKordaInScope(scope, selectedKordaId),
        ),
      );
      const orConditions = where.OR || [];
      where.AND = [
        { OR: orConditions },
        {
          OR: [
            { outboundKordaId: { in: selectedKordaIds } },
            { returnKordaId: { in: selectedKordaIds } },
          ],
        },
      ];
      delete where.OR;
    }

    // Drop point filter (either outbound or return)
    if (dropPointId) {
      const existingConditions: Prisma.RegistrationWhereInput[] = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : where.OR
          ? [{ OR: where.OR }]
          : [];
      where.AND = [
        ...existingConditions,
        {
          OR: [
            { outboundDropPointId: dropPointId },
            { returnDropPointId: dropPointId },
          ],
        },
      ];
      delete where.OR;
    }

    const outboundJourneyExists: Prisma.RegistrationWhereInput = {
      OR: [
        { outboundDropPointId: { not: null } },
        { outboundKordaId: { not: null } },
        { outboundBusId: { not: null } },
        { outboundDate: { not: null } },
      ],
    };
    const returnJourneyExists: Prisma.RegistrationWhereInput = {
      OR: [
        { returnDropPointId: { not: null } },
        { returnKordaId: { not: null } },
        { returnBusId: { not: null } },
        { returnDate: { not: null } },
      ],
    };

    if (journeyType === "outbound") {
      const existingConditions: Prisma.RegistrationWhereInput[] = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...existingConditions, outboundJourneyExists];
    } else if (journeyType === "return") {
      const existingConditions: Prisma.RegistrationWhereInput[] = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...existingConditions, returnJourneyExists];
    } else if (journeyType === "both") {
      const existingConditions: Prisma.RegistrationWhereInput[] = where.AND
        ? Array.isArray(where.AND)
          ? where.AND
          : [where.AND]
        : [];
      where.AND = [...existingConditions, outboundJourneyExists, returnJourneyExists];
    }

    const finalWhere = andWhere(where, registrationScopeWhere(scope));

    const registrations = await prisma.registration.findMany({
      where: finalWhere,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
            fullAddress: true,
            parrentPhone: true,
            gender: true,
          },
        },
        outboundKorda: {
          select: {
            id: true,
            name: true,
          },
        },
        outboundDropPoint: {
          select: {
            id: true,
            name: true,
          },
        },
        returnKorda: {
          select: {
            id: true,
            name: true,
          },
        },
        returnDropPoint: {
          select: {
            id: true,
            name: true,
          },
        },
        outboundBus: {
          select: {
            id: true,
            label: true,
          },
        },
        returnBus: {
          select: {
            id: true,
            label: true,
          },
        },
      },
      orderBy: [{ student: { name: "asc" } }],
    });

    const printData: PrintDataItem[] = registrations.map((reg) => {
      const chooseJourneySide = (): "outbound" | "return" => {
        if (journeyType === "outbound") {
          return "outbound";
        }
        if (journeyType === "return") {
          return "return";
        }

        if (dropPointId) {
          const outboundMatch = reg.outboundDropPoint?.id === dropPointId;
          const returnMatch = reg.returnDropPoint?.id === dropPointId;
          if (outboundMatch !== returnMatch) {
            return outboundMatch ? "outbound" : "return";
          }
        }

        if (selectedKordaIds.length > 0) {
          const outboundMatch =
            !!reg.outboundKorda?.id &&
            selectedKordaIds.includes(reg.outboundKorda.id);
          const returnMatch =
            !!reg.returnKorda?.id && selectedKordaIds.includes(reg.returnKorda.id);
          if (outboundMatch !== returnMatch) {
            return outboundMatch ? "outbound" : "return";
          }
        }

        const outboundHasBus = Boolean(reg.outboundBus?.id || reg.outboundBus?.label);
        const returnHasBus = Boolean(reg.returnBus?.id || reg.returnBus?.label);
        if (outboundHasBus !== returnHasBus) {
          return outboundHasBus ? "outbound" : "return";
        }

        if (reg.returnDate || reg.returnKorda || reg.returnDropPoint) {
          return "return";
        }
        return "outbound";
      };

      const preferredSide = chooseJourneySide();
      const preferredData =
        preferredSide === "return"
          ? {
              korda: reg.returnKorda,
              dropPoint: reg.returnDropPoint,
              busLabel: reg.returnBus?.label ?? null,
            }
          : {
              korda: reg.outboundKorda,
              dropPoint: reg.outboundDropPoint,
              busLabel: reg.outboundBus?.label ?? null,
            };
      const fallbackData =
        preferredSide === "return"
          ? {
              korda: reg.outboundKorda,
              dropPoint: reg.outboundDropPoint,
              busLabel: reg.outboundBus?.label ?? null,
            }
          : {
              korda: reg.returnKorda,
              dropPoint: reg.returnDropPoint,
              busLabel: reg.returnBus?.label ?? null,
            };

      const hasPreferredData =
        !!preferredData.korda || !!preferredData.dropPoint || !!preferredData.busLabel;
      const isFixedJourney =
        journeyType === "outbound" || journeyType === "return";
      const resolvedData =
        hasPreferredData || isFixedJourney ? preferredData : fallbackData;

      return {
        id: reg.id,
        studentName: reg.student.name,
        studentNis: reg.student.nis,
        fullAddress: reg.student.fullAddress,
        parrentPhone: reg.student.parrentPhone,
        studentGender: reg.student.gender,
        kordaName: resolvedData.korda?.name || "-",
        dropPointName: resolvedData.dropPoint?.name || "-",
        busLabel: resolvedData.busLabel,
      };
    });

    // console.log(`✅ Returning ${printData.length} print items`);

    return { success: true, data: printData };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return {
        success: false,
        error: error.message,
      };
    }
    console.error("Error fetching print data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch data",
    };
  }
}
