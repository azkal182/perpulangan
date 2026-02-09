/**
 * Debug helper - log students data to console
 */
"use client";

import { useEffect } from "react";

type Props = {
  students: any[];
  selectedKordaId: string;
  filteredCount: number;
};

export function StudentDebugger({ students, selectedKordaId, filteredCount }: Props) {
  useEffect(() => {
    console.log("=== Student Debug Info ===");
    console.log("Total students:", students.length);
    console.log("Selected Korda ID:", selectedKordaId);
    console.log("Filtered count:", filteredCount);
    
    if (students.length > 0) {
      console.log("Sample student:", students[0]);
      const withKorda = students.filter(s => s.regency?.kordaId);
      console.log("Students with kordaId:", withKorda.length);
      
      if (selectedKordaId && withKorda.length > 0) {
        const matchingKorda = withKorda.filter(s => s.regency?.kordaId === selectedKordaId);
        console.log("Students matching selected Korda:", matchingKorda.length);
        if (matchingKorda.length > 0) {
          console.log("Sample matching student:", matchingKorda[0]);
        }
      }
    }
  }, [students, selectedKordaId, filteredCount]);

  return null;
}
