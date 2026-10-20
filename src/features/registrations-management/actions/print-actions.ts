"use server";

import prisma from "@/lib/prisma";
import { normalizeExternalParticipantGender } from "@/features/santri/domain/external-participant";
import type { PrintDataItem } from "../lib/print-utils";
import { buildNumberedPrintRoster } from "../lib/print-roster";
import {
  AccessDeniedError,
  ensureKordaInScope,
  getRegionalAccessScope,
} from "@/server/access-scope";
import { canSelectEvent } from "@/server/event-context";

export interface GetPrintDataParams {
  eventId: string;
  journeyType: "outbound" | "return";
  gender?: "Laki-laki" | "Perempuan";
  kordaIds?: string[];
  dropPointId?: string;
  studentName?: string;
}

export async function getPrintDataAction(
  params: GetPrintDataParams,
): Promise<{ success: boolean; data?: PrintDataItem[]; error?: string }> {
  try {
    const scope = await getRegionalAccessScope();
    if (!params.eventId) throw new Error("Event wajib dipilih.");
    if (!(await canSelectEvent(scope, params.eventId))) throw new AccessDeniedError("Event di luar cakupan akses.");
    if (params.journeyType !== "outbound" && params.journeyType !== "return") {
      throw new Error("Pilih arah perjalanan sebelum menyiapkan dokumen.");
    }

    const selectedKordaIds = Array.from(new Set(params.kordaIds ?? [])).filter(Boolean);
    await Promise.all(selectedKordaIds.map((id) => ensureKordaInScope(scope, id)));

    const journeys = await prisma.journey.findMany({
      where: {
        direction: params.journeyType === "outbound" ? "OUTBOUND" : "RETURN",
        status: "REGISTERED",
        registration: {
          eventId: params.eventId,
          status: { not: "CANCELLED" },
        },
        busAssignment: {
          is: {
            busId: { not: null },
            bus: {
              is: {
                ...(scope.role === "korda" ? { kordas: { some: { kordaId: scope.kordaId ?? "__NO_ACCESS__" } } } : {}),
                ...(scope.role === "korwil" ? { OR: [
                  { korwilId: scope.korwilId ?? "__NO_ACCESS__" },
                  { kordas: { some: { korda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } } } },
                ] } : {}),
              },
            },
          },
        },
        ...(scope.role === "korda"
          ? { destinationKordaId: scope.kordaId ?? "__NO_ACCESS__" }
          : scope.role === "korwil"
            ? { destinationKorda: { korwilId: scope.korwilId ?? "__NO_ACCESS__" } }
            : {}),
      },
      select: {
        id: true,
        destinationKordaId: true,
        destinationKorda: {
          select: {
            name: true,
            korwilId: true,
            korwil: { select: { name: true } },
          },
        },
        dropPointId: true,
        locationNameSnapshot: true,
        busAssignment: {
          select: {
            bus: {
              select: {
                id: true,
                label: true,
              },
            },
          },
        },
        registration: {
          select: {
            student: {
              select: {
                id: true,
                name: true,
                nis: true,
                fullAddress: true,
                parrentPhone: true,
                gender: true,
                regency: { select: { kordaId: true } },
              },
            },
            externalParticipant: {
              select: { name: true, gender: true, address: true },
            },
          },
        },
      },
    });

    const completeRoster = buildNumberedPrintRoster(journeys.flatMap((journey) => {
      const bus = journey.busAssignment?.bus;
      if (!bus) return [];
      const registration = journey.registration;
      const student = registration.student;
      const external = registration.externalParticipant;
      const name = student?.name ?? external?.name ?? "Peserta eksternal";
      const crossKordaStudent = scope.role === "korda" && !!student && student.regency?.kordaId !== scope.kordaId;
      return [{
        id: journey.id,
        participantName: name,
        destinationKordaId: journey.destinationKordaId,
        destinationKordaName: journey.destinationKorda.name,
        destinationKorwilId: journey.destinationKorda.korwilId,
        korwilName: journey.destinationKorda.korwil?.name ?? null,
        busId: bus.id,
        busLabel: bus.label,
        dropPointId: journey.dropPointId,
        dropPointName: journey.locationNameSnapshot,
        studentNis: student?.nis ?? null,
        fullAddress: crossKordaStudent ? null : student?.fullAddress ?? external?.address ?? null,
        parrentPhone: crossKordaStudent ? null : student?.parrentPhone ?? null,
        studentGender: student?.gender ?? normalizeExternalParticipantGender(external?.gender) ?? "-",
      }];
    }));

    // Apply secondary filters after numbering so filtered previews preserve the
    // same Korda roster numbers as the complete eligible print roster.
    const studentName = params.studentName?.trim().toLocaleLowerCase("id-ID");
    const printData: PrintDataItem[] = completeRoster
      .filter((item) => !studentName || item.participantName.toLocaleLowerCase("id-ID").includes(studentName))
      .filter((item) => !params.gender || item.studentGender === params.gender)
      .filter((item) => selectedKordaIds.length === 0 || selectedKordaIds.includes(item.destinationKordaId))
      .filter((item) => !params.dropPointId || item.dropPointId === params.dropPointId)
      .map((item) => ({
        id: item.id,
        rosterNumber: item.rosterNumber,
        studentName: item.participantName,
        studentNis: item.studentNis,
        fullAddress: item.fullAddress,
        parrentPhone: item.parrentPhone,
        studentGender: item.studentGender,
        destinationKordaId: item.destinationKordaId,
        korwilName: item.korwilName,
        kordaName: item.destinationKordaName,
        dropPointId: item.dropPointId,
        dropPointName: item.dropPointName,
        busId: item.busId,
        busLabel: item.busLabel,
      }));

    return { success: true, data: printData };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { success: false, error: error.message };
    }
    console.error("Error fetching print roster:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal memuat data roster cetak",
    };
  }
}
