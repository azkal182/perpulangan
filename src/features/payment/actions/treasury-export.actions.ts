"use server";

import prisma from "@/lib/prisma";
import { getRegionalAccessScope } from "@/server/access-scope";
import { CENTRAL_FEE_PER_JOURNEY } from "../services/korda-finance-detail";
import type { FinanceJourneyFilter } from "../services/treasury-position";

export type TreasuryExportDirection = FinanceJourneyFilter;

export type TreasuryExportGroup = {
  direction: "Pulang" | "Pergi";
  korwilName: string;
  kordaName: string;
  tariff: number;
  participants: number;
  total: number;
  feePondok: number;
  afterFee: number;
  paymentArmada: string;
  feeKorda: string;
};

export type TreasuryExportFeeRow = {
  direction: "Pulang" | "Pergi";
  kordaName: string;
  participantCount: number;
  debit: number;
  credit: number;
  balance: number;
  note: string;
};

export type TreasuryExportData = {
  direction: TreasuryExportDirection;
  feeRows: TreasuryExportFeeRow[];
  outbound: TreasuryExportGroup[];
  returning: TreasuryExportGroup[];
};

function selectedDirections(direction: TreasuryExportDirection): Array<"OUTBOUND" | "RETURN"> {
  return direction === "both"
    ? ["OUTBOUND", "RETURN"]
    : [direction === "outbound" ? "OUTBOUND" : "RETURN"];
}

function directionLabel(direction: "OUTBOUND" | "RETURN") {
  return direction === "OUTBOUND" ? "Pulang" : "Pergi";
}

export async function getTreasuryExportDataAction(
  direction: TreasuryExportDirection,
): Promise<{ success: boolean; data?: TreasuryExportData; error?: string }> {
  try {
    const scope = await getRegionalAccessScope();
    if (scope.role !== "admin") {
      return { success: false, error: "Export keuangan pusat hanya dapat dilakukan oleh admin." };
    }

    const directions = selectedDirections(direction);
    const journeys = await prisma.journey.findMany({
      where: {
        direction: { in: directions },
        status: "REGISTERED",
        tariffSnapshot: { gt: 0 },
      },
      select: {
        direction: true,
        tariffSnapshot: true,
        destinationKorda: { select: { name: true, korwil: { select: { name: true } } } },
      },
      orderBy: [
        { destinationKorda: { korwil: { name: "asc" } } },
        { destinationKorda: { name: "asc" } },
        { dropPoint: { name: "asc" } },
      ],
    });

    const groups = new Map<string, TreasuryExportGroup>();
    for (const journey of journeys) {
      const korwilName = journey.destinationKorda.korwil?.name ?? "Tanpa Korwil";
      const kordaName = journey.destinationKorda.name;
      const tariff = journey.tariffSnapshot ?? 0;
      const key = `${journey.direction}|${korwilName}|${kordaName}|${tariff}`;
      const current = groups.get(key);
      if (current) {
        current.participants += 1;
        current.total += tariff;
        current.feePondok += CENTRAL_FEE_PER_JOURNEY;
        current.afterFee += tariff - CENTRAL_FEE_PER_JOURNEY;
        continue;
      }
      groups.set(key, {
        direction: directionLabel(journey.direction),
        korwilName,
        kordaName,
        tariff,
        participants: 1,
        total: tariff,
        feePondok: CENTRAL_FEE_PER_JOURNEY,
        afterFee: tariff - CENTRAL_FEE_PER_JOURNEY,
        paymentArmada: "",
        feeKorda: "",
      });
    }

    const sortedGroups = [...groups.values()].sort((a, b) =>
      a.korwilName.localeCompare(b.korwilName, "id")
      || a.kordaName.localeCompare(b.kordaName, "id")
      || a.tariff - b.tariff,
    );
    const feeRows: TreasuryExportFeeRow[] = sortedGroups.map((group) => ({
      direction: group.direction,
      kordaName: group.kordaName,
      participantCount: group.participants,
      debit: group.total,
      credit: group.feePondok,
      balance: group.afterFee,
      note: "Pembayaran armada dan fee Korda belum dialokasikan per baris",
    }));

    return {
      success: true,
      data: {
        direction,
        feeRows,
        outbound: sortedGroups.filter((group) => group.direction === "Pulang"),
        returning: sortedGroups.filter((group) => group.direction === "Pergi"),
      },
    };
  } catch (error) {
    console.error("Failed to prepare treasury Excel export:", error);
    return { success: false, error: "Gagal menyiapkan export keuangan." };
  }
}
