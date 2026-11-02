"use server";

import prisma from "@/lib/prisma";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import type { JourneyStatus, Prisma } from "@/generated/prisma/client";
import {
  andWhere,
  getRegionalAccessScope,
  registrationScopeWhere,
} from "@/server/access-scope";
import { canSelectEvent } from "@/server/event-context";
import type {
  RegistrationExportKorwilSheet,
  RegistrationExportRow,
} from "../lib/registration-excel";
import type { JourneyPaymentStatus } from "../repositories/registrations.repository";

interface ExportRegistrationsExcelParams {
  eventId: string;
  journeyType?: "both" | "return_only" | "outbound_only" | "all";
  exportDirection: "OUTBOUND" | "RETURN";
  status?: JourneyStatus | "all";
  paymentStatus?: JourneyPaymentStatus | "all";
  gender?: "Laki-laki" | "Perempuan";
  kordaId?: string;
  dropPointId?: string;
  search?: string;
}

function mapGenderToShortLabel(value: string | null | undefined): "L" | "P" | "-" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "laki-laki") {
    return "L";
  }
  if (normalized === "perempuan") {
    return "P";
  }
  return "-";
}

function sortLocale(a: string, b: string): number {
  return a.localeCompare(b, "id", { sensitivity: "base" });
}

export async function getRegistrationsForExcelExportAction(
  params: ExportRegistrationsExcelParams,
): Promise<{
  success: boolean;
  data?: RegistrationExportKorwilSheet[];
  totalRows?: number;
  error?: string;
}> {
  try {
    const scope = await getRegionalAccessScope();
    const {
      eventId,
      journeyType = "all",
      exportDirection = "OUTBOUND",
      status = "all",
      paymentStatus = "all",
      gender,
      kordaId,
      dropPointId,
      search,
    } = params;

    if (!eventId || !(await canSelectEvent(scope, eventId))) {
      throw new Error("Event tidak ditemukan atau di luar cakupan akses.");
    }

    const where: Prisma.RegistrationWhereInput = { eventId };

    const exportJourneyScope: Prisma.JourneyWhereInput | undefined = scope.role === "admin"
      ? undefined
      : scope.role === "korwil"
        ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } }
        : { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" };
    const selectedOutbound: Prisma.JourneyWhereInput = { ...(exportJourneyScope ?? {}), direction: "OUTBOUND", ...(status === "all" ? {} : { status }) };
    const selectedReturn: Prisma.JourneyWhereInput = { ...(exportJourneyScope ?? {}), direction: "RETURN", ...(status === "all" ? {} : { status }) };
    const selectedDirection: Prisma.JourneyWhereInput = { ...(exportJourneyScope ?? {}), direction: exportDirection, ...(status === "all" ? {} : { status }) };
    const conditions: Prisma.RegistrationWhereInput[] = [];
    conditions.push({ journeys: { some: { ...(exportJourneyScope ?? {}), ...selectedDirection } } });
    if (journeyType === "both") conditions.push({ journeys: { some: selectedOutbound } }, { journeys: { some: selectedReturn } });
    else if (journeyType === "return_only") conditions.push({ journeys: { some: selectedReturn } });
    else if (journeyType === "outbound_only") conditions.push({ journeys: { some: selectedOutbound } });
    if (kordaId) conditions.push({ journeys: { some: { ...selectedDirection, destinationKordaId: kordaId } } });
    if (dropPointId) conditions.push({ journeys: { some: { ...selectedDirection, dropPointId } } });

    const studentConditions: Prisma.StudentWhereInput[] = [];
    const externalConditions: Prisma.ExternalParticipantWhereInput[] = [];

    if (gender) {
      studentConditions.push({ gender });
      externalConditions.push({ gender });
    }

    if (search?.trim()) {
      studentConditions.push({
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { nis: { contains: search.trim(), mode: "insensitive" } },
        ],
      });
      externalConditions.push({ OR: [{ name: { contains: search.trim(), mode: "insensitive" } }, { address: { contains: search.trim(), mode: "insensitive" } }] });
    }

    if (studentConditions.length === 1) {
      conditions.push({ OR: [{ student: studentConditions[0] }, { externalParticipant: externalConditions[0] }] });
    } else if (studentConditions.length > 1) {
      conditions.push({ OR: [{ student: { AND: studentConditions } }, { externalParticipant: { AND: externalConditions } }] });
    }
    where.AND = conditions;

    const finalWhere = andWhere(where, registrationScopeWhere(scope));

    const registrations = await prisma.registration.findMany({
      where: finalWhere,
      select: {
        student: {
          select: {
            name: true,
            gender: true,
          },
        },
        externalParticipant: { select: { name: true, gender: true } },
        journeys: { where: { ...(exportJourneyScope ?? {}), direction: exportDirection, ...(status === "all" ? {} : { status }) }, select: { direction: true, status: true, destinationKordaId: true, dropPointId: true, destinationKordaNameSnapshot: true, locationNameSnapshot: true, tariffSnapshot: true, paymentAllocations: { where: { type: "JOURNEY" }, select: { amount: true, refunds: { select: { amount: true } }, corrections: { select: { amount: true } } } }, destinationKorda: { select: { name: true, korwil: { select: { name: true } } } }, busAssignment: { select: { bus: { select: { label: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const grouped = new Map<string, Map<string, RegistrationExportRow[]>>();

    registrations.forEach((registration) => {
      const participantName = registration.student?.name ?? registration.externalParticipant?.name ?? "Peserta eksternal";
      const participantGender = registration.student?.gender ?? normalizeExternalParticipantGender(registration.externalParticipant?.gender) ?? "";
      for (const journey of registration.journeys) {
        const netPaid = journey.paymentAllocations.reduce((sum, row) => sum + row.amount - row.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0) - row.corrections.reduce((correctionSum, correction) => correctionSum + correction.amount, 0), 0);
        const calculatedPaymentStatus: JourneyPaymentStatus = journey.status === "CANCELLED" ? "CANCELLED"
          : journey.tariffSnapshot == null ? "UNKNOWN"
            : netPaid >= journey.tariffSnapshot ? "PAID"
              : netPaid > 0 ? "PARTIAL" : "UNPAID";
        if (paymentStatus !== "all" && calculatedPaymentStatus !== paymentStatus) continue;
        const korwilName = journey.destinationKorda.korwil?.name || "Tanpa Korwil";
        const kordaName = journey.destinationKordaNameSnapshot || journey.destinationKorda.name || "Tanpa Korda";
        if (!grouped.has(korwilName)) grouped.set(korwilName, new Map<string, RegistrationExportRow[]>());
        const kordaMap = grouped.get(korwilName)!;
        if (!kordaMap.has(kordaName)) kordaMap.set(kordaName, []);
        kordaMap.get(kordaName)!.push({
          studentName: participantName,
          gender: mapGenderToShortLabel(participantGender),
          paymentStatus: calculatedPaymentStatus === "PAID" ? "PAID" : "UNPAID",
          direction: journey.direction === "OUTBOUND" ? "Pulang" : "Kembali",
          journeyStatus: journey.status === "REGISTERED" ? "Terdaftar" : "Dibatalkan",
          destinationKorda: kordaName,
          travelPoint: journey.locationNameSnapshot,
          bus: journey.busAssignment?.bus?.label ?? "",
        });
      }
    });

    const data: RegistrationExportKorwilSheet[] = Array.from(grouped.entries())
      .map(([korwilName, kordaMap]) => {
        const kordas = Array.from(kordaMap.entries())
          .map(([kordaName, rows]) => ({
            kordaName,
            rows: rows.sort((a, b) => {
              const byDropPoint = sortLocale(a.travelPoint, b.travelPoint);
              if (byDropPoint !== 0) {
                return byDropPoint;
              }
              return sortLocale(a.studentName, b.studentName);
            }),
          }))
          .sort((a, b) => sortLocale(a.kordaName, b.kordaName));

        return {
          korwilName,
          kordas,
        };
      })
      .sort((a, b) => sortLocale(a.korwilName, b.korwilName));

    const totalRows = data.reduce(
      (sum, sheet) =>
        sum + sheet.kordas.reduce((sheetSum, korda) => sheetSum + korda.rows.length, 0),
      0,
    );

    return {
      success: true,
      data,
      totalRows,
    };
  } catch (error) {
    console.error("Failed to export registrations to Excel:", error);
    return {
      success: false,
      error: "Gagal menyiapkan data export Excel",
    };
  }
}
