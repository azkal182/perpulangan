/**
 * Debug helper - log students data to console
 * Only logs when debug mode is enabled via localStorage
 */
"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger-client";

type Props = {
  students: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectedKordaId?: string | null;
  filteredCount?: number;
};

export function StudentDebugger({ students, selectedKordaId, filteredCount }: Props) {
  useEffect(() => {
    if (!students || students.length === 0) return;

    // Only log if debug mode is enabled
    if (typeof window !== "undefined" && localStorage.getItem("debug") !== "true") {
      return;
    }

    logger.debug(
      {
        totalStudents: students.length,
        selectedKordaId: selectedKordaId || "none",
        filteredCount: filteredCount ?? "N/A",
        firstStudent: students[0],
        sampleRegencyData: students.slice(0, 5).map((s, idx) => ({
          index: idx + 1,
          id: s.id,
          name: s.name,
          hasRegency: !!s.regency,
          kordaId: s.regency?.kordaId || "no kordaId",
        })),
      },
      "registration.debug.studentData"
    );
  }, [students, selectedKordaId, filteredCount]);

  return null;
}
