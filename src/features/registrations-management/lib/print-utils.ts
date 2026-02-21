// Paper size configurations (in mm)
export const PAPER_SIZES = {
  A4: { width: 210, height: 297, name: "A4" },
  F4: { width: 215, height: 330, name: "F4" },
  A3: { width: 297, height: 420, name: "A3" },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
export type PrintType = "luggage_card" | "ticket";

// Color palette for Korda hashing (using Tailwind classes)
export const KORDA_COLORS = [
  // Solid / Light variants
  {
    bg: "bg-red-50",
    headerBg: "bg-red-500",
    border: "border-red-500",
    text: "text-red-800",
  },
  {
    bg: "bg-blue-50",
    headerBg: "bg-blue-500",
    border: "border-blue-500",
    text: "text-blue-800",
  },
  {
    bg: "bg-emerald-50",
    headerBg: "bg-emerald-500",
    border: "border-emerald-500",
    text: "text-emerald-800",
  },
  {
    bg: "bg-purple-50",
    headerBg: "bg-purple-500",
    border: "border-purple-500",
    text: "text-purple-800",
  },
  {
    bg: "bg-amber-50",
    headerBg: "bg-amber-500",
    border: "border-amber-500",
    text: "text-amber-800",
  },
  {
    bg: "bg-teal-50",
    headerBg: "bg-teal-500",
    border: "border-teal-500",
    text: "text-teal-800",
  },
  {
    bg: "bg-pink-50",
    headerBg: "bg-pink-500",
    border: "border-pink-500",
    text: "text-pink-800",
  },
  {
    bg: "bg-indigo-50",
    headerBg: "bg-indigo-500",
    border: "border-indigo-500",
    text: "text-indigo-800",
  },
  {
    bg: "bg-orange-50",
    headerBg: "bg-orange-500",
    border: "border-orange-500",
    text: "text-orange-800",
  },
  {
    bg: "bg-cyan-50",
    headerBg: "bg-cyan-500",
    border: "border-cyan-500",
    text: "text-cyan-800",
  },
  {
    bg: "bg-fuchsia-50",
    headerBg: "bg-fuchsia-500",
    border: "border-fuchsia-500",
    text: "text-fuchsia-800",
  },
  {
    bg: "bg-lime-50",
    headerBg: "bg-lime-500",
    border: "border-lime-500",
    text: "text-lime-800",
  },
  // Gradients
  {
    bg: "bg-gradient-to-br from-red-50 to-orange-50",
    headerBg: "bg-gradient-to-r from-red-500 to-orange-500",
    border: "border-red-400",
    text: "text-red-900",
  },
  {
    bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
    headerBg: "bg-gradient-to-r from-blue-500 to-indigo-500",
    border: "border-blue-400",
    text: "text-blue-900",
  },
  {
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
    headerBg: "bg-gradient-to-r from-emerald-500 to-teal-500",
    border: "border-emerald-400",
    text: "text-emerald-900",
  },
  {
    bg: "bg-gradient-to-br from-purple-50 to-fuchsia-50",
    headerBg: "bg-gradient-to-r from-purple-500 to-fuchsia-500",
    border: "border-purple-400",
    text: "text-purple-900",
  },
  {
    bg: "bg-gradient-to-br from-amber-50 to-yellow-50",
    headerBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
    border: "border-amber-400",
    text: "text-amber-900",
  },
  {
    bg: "bg-gradient-to-br from-pink-50 to-rose-50",
    headerBg: "bg-gradient-to-r from-pink-500 to-rose-500",
    border: "border-pink-400",
    text: "text-pink-900",
  },
  {
    bg: "bg-gradient-to-br from-cyan-50 to-blue-50",
    headerBg: "bg-gradient-to-r from-cyan-500 to-blue-500",
    border: "border-cyan-400",
    text: "text-cyan-900",
  },
  {
    bg: "bg-gradient-to-br from-indigo-50 to-purple-50",
    headerBg: "bg-gradient-to-r from-indigo-500 to-purple-500",
    border: "border-indigo-400",
    text: "text-indigo-900",
  },
];

export function getKordaColor(kordaName: string = "") {
  let hash = 0;
  for (let i = 0; i < kordaName.length; i++) {
    hash = kordaName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % KORDA_COLORS.length;
  return KORDA_COLORS[index];
}

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
    // Landscape card: wider 98mm x 53mm to keep text compact and proportional
    const cardWidth = 98;
    const cardHeight = 53;

    switch (paperSize) {
      case "A4":
        return {
          columns: 2,
          rows: 5,
          cardWidth,
          cardHeight,
          marginX: 7, // (210 - (98*2)) / 2 = (210 - 196) / 2 = 14 / 2 = 7
          marginY: 16, // (297 - (53*5)) / 2 = 16
          gapX: 0,
          gapY: 0,
        };
      case "F4":
        return {
          columns: 2,
          rows: 6,
          cardWidth,
          cardHeight,
          marginX: 9.5, // (215 - (98*2)) / 2 = (215 - 196) / 2 = 19 / 2 = 9.5
          marginY: 6, // (330 - (53*6)) / 2 = 6
          gapX: 0,
          gapY: 0,
        };
      case "A3":
        return {
          columns: 3,
          rows: 7,
          cardWidth,
          cardHeight,
          marginX: 1.5, // (297 - (98*3)) / 2 = (297 - 294) / 2 = 3 / 2 = 1.5
          marginY: 24.5, // (420 - (53*7)) / 2 = 24.5
          gapX: 0,
          gapY: 0,
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
