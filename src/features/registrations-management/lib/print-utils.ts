// Paper size configurations (in mm)
export const PAPER_SIZES = {
  A4: { width: 210, height: 297, name: "A4" },
  F4: { width: 215, height: 330, name: "F4" },
  A3: { width: 297, height: 420, name: "A3" },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
export type PrintType = "luggage_card" | "ticket";

// Layout configurations for each print type and paper size
export interface LayoutConfig {
  columns: number;
  rows: number;
  cardWidth: number; // in mm
  cardHeight: number; // in mm
  marginX: number; // horizontal margin
  marginY: number; // vertical margin
  gapX: number; // horizontal gap between cards
  gapY: number; // vertical gap between cards
}

export function calculateLayout(
  paperSize: PaperSize,
  printType: PrintType,
): LayoutConfig {
  void PAPER_SIZES[paperSize]; // retained for potential future use

  if (printType === "luggage_card") {
    // Landscape card: ~90mm x 55mm
    const cardWidth = 90;
    const cardHeight = 55;

    switch (paperSize) {
      case "A4":
        return {
          columns: 2,
          rows: 5,
          cardWidth,
          cardHeight,
          marginX: 10,
          marginY: 10,
          gapX: 10,
          gapY: 8,
        };
      case "F4":
        return {
          columns: 2,
          rows: 6,
          cardWidth,
          cardHeight,
          marginX: 12,
          marginY: 8,
          gapX: 10,
          gapY: 6,
        };
      case "A3":
        return {
          columns: 3,
          rows: 7,
          cardWidth,
          cardHeight,
          marginX: 10,
          marginY: 10,
          gapX: 10,
          gapY: 8,
        };
    }
  } else {
    // Ticket: landscape ~120mm x 80mm
    const cardWidth = 120;
    const cardHeight = 80;

    switch (paperSize) {
      case "A4":
        return {
          columns: 1,
          rows: 3,
          cardWidth,
          cardHeight,
          marginX: 45,
          marginY: 20,
          gapX: 0,
          gapY: 15,
        };
      case "F4":
        return {
          columns: 1,
          rows: 4,
          cardWidth,
          cardHeight,
          marginX: 47,
          marginY: 15,
          gapX: 0,
          gapY: 10,
        };
      case "A3":
        return {
          columns: 2,
          rows: 5,
          cardWidth,
          cardHeight,
          marginX: 28,
          marginY: 10,
          gapX: 10,
          gapY: 8,
        };
    }
  }
}

export interface PrintDataItem {
  id: string;
  studentName: string;
  studentNis: string | null;
  studentGender: string;
  kordaName: string;
  dropPointName: string;
  busLabel: string | null;
}

export interface PrintFilters {
  gender?: "L" | "P";
  kordaId?: string;
  dropPointId?: string;
}

export function filterPrintData(
  data: PrintDataItem[],
  filters: PrintFilters,
): PrintDataItem[] {
  let filtered = data;

  if (filters.gender) {
    filtered = filtered.filter((item) => item.studentGender === filters.gender);
  }

  if (filters.kordaId) {
    filtered = filtered.filter(
      (item) => item.kordaName === filters.kordaId, // Note: We need to match by name or need to pass full korda object
    );
  }

  if (filters.dropPointId) {
    filtered = filtered.filter(
      (item) => item.dropPointName === filters.dropPointId,
    );
  }

  return filtered;
}
