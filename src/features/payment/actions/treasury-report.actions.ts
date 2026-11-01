"use server";

import { getRegionalAccessScope } from "@/server/access-scope";
import { getTreasuryPosition } from "../services/treasury-position";

export type TreasuryOfficialReportData = {
  generatedAt: string;
  summary: {
    grossBilled: number;
    billedFee: number;
    bankReceipts: number;
    receivedFee: number;
    netEntitlement: number;
    excessPayment: number;
    centralCash: number;
    totalExpenses: number;
    refunds: number;
    disbursements: number;
    currentlyDisbursableTotal: number;
  };
  kordas: Array<{
    name: string;
    grossBilled: number;
    billedFee: number;
    netEntitlement: number;
    registrationReceipts: number;
    receivedFee: number;
    excessPayment: number;
    disbursed: number;
    currentlyDisbursable: number;
  }>;
};

export async function getTreasuryOfficialReportAction(): Promise<{
  success: boolean;
  data?: TreasuryOfficialReportData;
  error?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    if (scope.role !== "admin") {
      return { success: false, error: "Export PDF keuangan pusat hanya dapat dilakukan oleh admin." };
    }

    const position = await getTreasuryPosition(scope, "both");
    const generatedAt = new Date();

    return {
      success: true,
      data: {
        generatedAt: generatedAt.toISOString(),
        summary: {
          grossBilled: position.totalGrossBilled,
          billedFee: position.totalFee,
          bankReceipts: position.totalPaymentReceipts ?? 0,
          receivedFee: position.totalFeeReceived,
          netEntitlement: position.totalRegistrationEntitlement,
          excessPayment: position.totalBalanceCash,
          centralCash: position.centralBalance ?? 0,
          totalExpenses: position.totalExpenses,
          refunds: position.totalRefunds,
          disbursements: position.totalDisbursed,
          currentlyDisbursableTotal: Math.max(0, Math.min(position.centralBalance ?? 0, position.totalHeldAtCenter)),
        },
        kordas: position.positions.map((row) => ({
          name: row.name,
          grossBilled: row.grossBilled,
          billedFee: row.fee,
          netEntitlement: row.registrationEntitlement,
          registrationReceipts: row.registrationReceived,
          receivedFee: row.feeReceived,
          excessPayment: row.balanceCash,
          disbursed: row.disbursed,
          currentlyDisbursable: Math.max(0, Math.min(position.centralBalance ?? 0, row.heldAtCenter)),
        })),
      },
    };
  } catch (error) {
    console.error("Failed to prepare official treasury report:", error);
    return { success: false, error: "Gagal menyiapkan laporan PDF keuangan pusat." };
  }
}
