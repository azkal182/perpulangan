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
  dropPointId?: string;
  studentName?: string;
  journeyType?: "outbound" | "return" | "both";
}

export async function getPrintDataAction(
  params: GetPrintDataParams,
): Promise<{ success: boolean; data?: PrintDataItem[]; error?: string }> {
  try {
    const scope = await getRegionalAccessScope();
    const { eventId, gender, kordaId, dropPointId, studentName } = params;

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
    if (kordaId) {
      await ensureKordaInScope(scope, kordaId);
      const orConditions = where.OR || [];
      where.AND = [
        { OR: orConditions },
        {
          OR: [{ outboundKordaId: kordaId }, { returnKordaId: kordaId }],
        },
      ];
      delete where.OR;
    }

    const finalWhere = andWhere(where, registrationScopeWhere(scope));

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
      },
      orderBy: [{ student: { name: "asc" } }],
    });

    // Transform data and get bus labels
    const printData: PrintDataItem[] = await Promise.all(
      registrations.map(async (reg) => {
        // Prioritize return journey if exists, otherwise outbound
        const korda = reg.returnKorda || reg.outboundKorda;
        const dropPoint = reg.returnDropPoint || reg.outboundDropPoint;

        // Get bus for this korda
        let busLabel: string | null = null;
        if (korda) {
          const busKorda = await prisma.busKorda.findFirst({
            where: { kordaId: korda.id },
            include: {
              bus: {
                select: {
                  label: true,
                },
              },
            },
          });
          busLabel = busKorda?.bus?.label || null;
        }

        return {
          id: reg.id,
          studentName: reg.student.name,
          studentNis: reg.student.nis,
          fullAddress: reg.student.fullAddress,
          parrentPhone: reg.student.parrentPhone,
          studentGender: reg.student.gender,
          kordaName: korda?.name || "-",
          dropPointName: dropPoint?.name || "-",
          busLabel,
        };
      }),
    );

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
