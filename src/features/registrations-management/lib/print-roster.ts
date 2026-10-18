export interface CanonicalPrintRosterEntry {
  id: string;
  participantName: string;
  destinationKordaId: string;
  destinationKordaName: string;
  destinationKorwilId: string | null;
  korwilName: string | null;
  busId: string;
  busLabel: string;
  dropPointId: string | null;
  dropPointName: string;
  studentNis: string | null;
}

export type NumberedPrintRosterEntry<T extends CanonicalPrintRosterEntry> = T & {
  rosterNumber: number;
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("id-ID") ?? "";
}

function compareText(left: string | null | undefined, right: string | null | undefined): number {
  return normalize(left).localeCompare(normalize(right), "id", {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * Canonical roster ordering shared by cards, tickets, and attendance.
 * Numbering restarts at 1 for each destination Korda after the complete eligible
 * roster has been sorted. Callers must apply secondary display filters afterward.
 */
export function buildNumberedPrintRoster<T extends CanonicalPrintRosterEntry>(
  entries: T[],
): NumberedPrintRosterEntry<T>[] {
  const ordered = [...entries].sort((left, right) =>
    compareText(left.korwilName, right.korwilName) ||
    compareText(left.destinationKordaName, right.destinationKordaName) ||
    compareText(left.busLabel, right.busLabel) ||
    compareText(left.dropPointName, right.dropPointName) ||
    compareText(left.participantName, right.participantName) ||
    left.id.localeCompare(right.id),
  );

  const numbersByKorda = new Map<string, number>();
  return ordered.map((entry) => {
    const number = (numbersByKorda.get(entry.destinationKordaId) ?? 0) + 1;
    numbersByKorda.set(entry.destinationKordaId, number);
    return { ...entry, rosterNumber: number };
  });
}
