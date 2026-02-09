/**
 * Debug helper - log students data to console
 */
"use client";

import { useEffect } from "react";

type Props = {
  students: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  selectedKordaId?: string | null;
  filteredCount?: number;
};

export function StudentDebugger({ students, selectedKordaId, filteredCount }: Props) {
  useEffect(() => {
    if (!students || students.length === 0) return;

    console.log("=== Student Debug Info ===");
    console.log("Total students:", students.length);
    console.log("Selected Korda ID:", selectedKordaId || "none");
    console.log("Filtered count:", filteredCount ?? "N/A");
    console.log("\n--- First student sample ---");
    console.log(JSON.stringify(students[0], null, 2));
    console.log("\n--- Check regency data ---");
    students.slice(0, 5).forEach((s, idx) => {
      console.log(`Student ${idx + 1}:`, {
        id: s.id,
        name: s.name,
        hasRegency: !!s.regency,
        kordaId: s.regency?.kordaId || "no kordaId",
      });
    });
  }, [students, selectedKordaId, filteredCount]);

  return null;
}
