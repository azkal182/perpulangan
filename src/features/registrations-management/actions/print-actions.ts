"use server";

import prisma from "@/lib/prisma";
import type { PrintDataItem } from "../lib/print-utils";
import type { Prisma } from "@/generated/prisma/client";

export interface GetPrintDataParams {
  eventId: string;
  gender?: "L" | "P";
  kordaId?: string;
  dropPointId?: string;
  journeyType?: "outbound" | "return" | "both";
}

export async function getPrintDataAction(
  params: GetPrintDataParams,
): Promise<{ success: boolean; data?: PrintDataItem[]; error?: string }> {
  try {
    const { eventId, gender, kordaId, dropPointId } = params;

    console.log("🔍 Print action called with:", {
      eventId,
      gender,
      kordaId,
      dropPointId,
    });

    // Build where clause - simplified, just need drop points
    const where: Prisma.RegistrationWhereInput = {
      eventId,
      // Don't filter by status - print all registrations
      OR: [
        { outboundDropPointId: { not: null } },
        { returnDropPointId: { not: null } },
      ],
    };

    // Gender filter on student
    if (gender) {
      where.student = { gender };
    }

    // Korda filter (either outbound or return)
    if (kordaId) {
      const orConditions = where.OR || [];
      where.AND = [
        { OR: orConditions },
        {
          OR: [{ outboundKordaId: kordaId }, { returnKordaId: kordaId }],
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

    const registrations = await prisma.registration.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            nis: true,
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

    console.log(`📊 Found ${registrations.length} registrations`);

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
    console.error("Error fetching print data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch data",
    };
  }
}
