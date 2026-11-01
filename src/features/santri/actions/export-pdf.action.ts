"use server";

import prisma from "@/lib/prisma";
import { logger } from "@/server/logger";
import { andWhere, getRegionalAccessScope, studentScopeWhere } from "@/server/access-scope";
import { getEventContext } from "@/server/event-context";

export type StudentPdfExportFilter = "ALL" | "REGISTERED" | "UNREGISTERED";

export type StudentForPDF = {
  name: string;
  nis: string | null;
  gender: string;
  regencyName: string;
};

export type KordaGroupPDF = {
  kordaName: string;
  putra: StudentForPDF[];
  putri: StudentForPDF[];
};

export type KorwilGroupPDF = {
  korwilName: string;
  totalStudents: number;
  putraCount: number;
  putriCount: number;
  kordas: KordaGroupPDF[];
};

/**
 * Fetch all students grouped by Korwil > Korda > Gender
 * For PDF export
 */
export async function getStudentsForPDFExport(filter: StudentPdfExportFilter): Promise<{
  success: boolean;
  data?: KorwilGroupPDF[];
  eventName?: string;
  error?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    const eventContext = await getEventContext(scope);
    const selectedEvent = eventContext.selectedEvent;
    if (filter !== "ALL" && !selectedEvent) {
      return { success: false, error: "Pilih event dari header sebelum mengekspor PDF santri." };
    }
    logger.debug("Fetching students for PDF export");

    const registeredInEvent = selectedEvent
      ? { eventId: selectedEvent.id, journeys: { some: { status: "REGISTERED" as const } } }
      : undefined;

    // Fetch all students with their korwil/korda relations
    const students = await prisma.student.findMany({
      where: andWhere(
        {
          status: true, // Only active students
        },
        studentScopeWhere(scope),
        filter === "REGISTERED" && registeredInEvent
          ? { registrations: { some: registeredInEvent } }
          : filter === "UNREGISTERED" && registeredInEvent
            ? { registrations: { none: registeredInEvent } }
            : undefined,
      ),
      select: {
        id: true,
        name: true,
        nis: true,
        gender: true,
        regency: {
          select: {
            name: true,
            korda: {
              select: {
                id: true,
                name: true,
                korwil: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { regency: { korda: { korwil: { name: "asc" } } } },
        { regency: { korda: { name: "asc" } } },
        { name: "asc" },
      ],
    });

    // Group by Korwil > Korda > Gender
    const korwilMap = new Map<string, KorwilGroupPDF>();

    // Debug: Log a sample of gender values
    if (students.length > 0) {
      // Count gender distribution
      const genderCounts = students.reduce(
        (acc, s) => {
          const gender = s.gender || "null";
          acc[gender] = (acc[gender] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      logger.debug(
        {
          totalStudents: students.length,
          genderDistribution: genderCounts,
          sampleGenders: students.slice(0, 10).map((s) => ({
            name: s.name,
            gender: s.gender,
            genderLower: s.gender?.toLowerCase(),
          })),
        },
        "Gender distribution in database",
      );
    }

    let processedCount = 0;
    let skippedCount = 0;
    const skippedByGender: Record<string, number> = {};

    for (const student of students) {
      if (!student.regency?.korda?.korwil) {
        skippedCount++;
        const gender = student.gender || "null";
        skippedByGender[gender] = (skippedByGender[gender] || 0) + 1;
        continue;
      }

      processedCount++;

      const korwilName = student.regency.korda.korwil.name;
      const kordaName = student.regency.korda.name;

      // Get or create Korwil group
      if (!korwilMap.has(korwilName)) {
        korwilMap.set(korwilName, {
          korwilName,
          totalStudents: 0,
          putraCount: 0,
          putriCount: 0,
          kordas: [],
        });
      }

      const korwil = korwilMap.get(korwilName)!;

      // Get or create Korda group
      let korda = korwil.kordas.find((k) => k.kordaName === kordaName);
      if (!korda) {
        korda = {
          kordaName,
          putra: [],
          putri: [],
        };
        korwil.kordas.push(korda);
      }

      // Add student to appropriate gender array
      const studentData: StudentForPDF = {
        name: student.name,
        nis: student.nis,
        gender: student.gender,
        regencyName: student.regency.name,
      };

      const genderLower = student.gender?.toLowerCase() || "";

      if (genderLower === "laki-laki") {
        korda.putra.push(studentData);
        korwil.putraCount++;
      } else if (genderLower === "perempuan") {
        korda.putri.push(studentData);
        korwil.putriCount++;
      } else {
        // Log unexpected gender values
        logger.warn(
          { gender: student.gender, studentName: student.name },
          "Unexpected gender value",
        );
      }

      korwil.totalStudents++;
    }

    const result = Array.from(korwilMap.values());

    logger.debug(
      {
        totalFetched: students.length,
        processed: processedCount,
        skipped: skippedCount,
        skippedByGender,
        korwilCount: result.length,
      },
      "Student processing summary",
    );

    logger.debug(
      { korwilCount: result.length, totalStudents: students.length },
      "Successfully fetched students for PDF export",
    );

    return {
      success: true,
      data: result,
      eventName: selectedEvent?.name ?? "Semua data santri",
    };
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch students for PDF export");
    return {
      success: false,
      error: "Gagal mengambil data siswa",
    };
  }
}
