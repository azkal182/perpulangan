"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { StudentDTO } from "../api/students.dto";
import { Student } from "@/features/santri/domain/student.model";

export type StudentNormalized = {
  idApi: string;
  nis: string;
  name: string;
  gender: string;
  status: boolean; // boolean DB
  ttl: string;

  photoUrl?: string | null;
  parrentPhone?: string | null;
  dormitory: string;

  provinceId?: number | null;
  regencyId?: number | null;
  districtId?: number | null;

  villageId?: number | null;
  fullAddress: string;
};

export type BulkImportResult = {
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{
    index: number;
    idApi?: string;
    nis?: string;
    message: string;
  }>;
  skippedRows: Array<{
    index: number;
    idApi?: string;
    nis?: string;
    message: string;
  }>;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function isAktifFromApi(row: StudentDTO): boolean {
  const byStatusAnggota =
    row.status_anggota?.nama?.trim().toLowerCase() === "aktif";
  if (byStatusAnggota) return true;

  // fallback 1: nama_lengkap mengandung "(Aktif)" / kata "aktif"
  const nl = (row.nama_lengkap ?? "").toLowerCase();
  if (nl.includes("(aktif)") || nl.includes(" aktif")) return true;

  return false;
}

function validateStudent(s: StudentNormalized) {
  const missing: string[] = [];
  if (!s.idApi) missing.push("idApi");
  if (!s.nis) missing.push("nis");
  if (!s.name) missing.push("name");
  if (!s.gender) missing.push("gender");
  // status tidak perlu wajib: default false valid
  if (!s.ttl) missing.push("ttl");
  if (!s.dormitory) missing.push("dormitory");
  //   if (!s.village) missing.push("village");
  if (!s.fullAddress) missing.push("fullAddress");

  if (missing.length === 0) return null;

  const shouldSkip =
    missing.includes("nis") || missing.includes("dormitory");

  return {
    level: shouldSkip ? "skip" : "error",
    message: `${missing.join(", ")} wajib`,
  };
}

function prismaErrorMessage(e: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyE = e as any;
  if (anyE?.code === "P2002") {
    const target = anyE?.meta?.target;
    const t = Array.isArray(target)
      ? target.join(", ")
      : String(target ?? "unique");
    return `Duplikat unique constraint (${t})`;
  }
  return anyE?.message ?? "Gagal upsert";
}

export async function bulkUpsertStudents(
  rawRows: Student[],
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: rawRows?.length ?? 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    skippedRows: [],
  };

  if (!Array.isArray(rawRows) || rawRows.length === 0) return result;
  //   console.log(JSON.stringify(rawRows[0], null, 2));

  // 1) normalize + validate
  const rows: { index: number; data: StudentNormalized }[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    // console.log(JSON.stringify(normalized, null, 2));
    const validation = validateStudent(rawRows[i]);

    if (validation) {
      if (validation.level === "skip") {
        result.skipped++;
        result.skippedRows.push({
          index: i,
          idApi: rawRows[i].idApi,
          nis: rawRows[i].nis,
          message: validation.message,
        });
        continue;
      }

      result.failed++;
      result.errors.push({
        index: i,
        idApi: rawRows[i].idApi,
        nis: rawRows[i].nis,
        message: validation.message,
      });
      continue;
    }

    rows.push({ index: i, data: rawRows[i] });
  }

  if (rows.length === 0) return result;

  // 2) prefetch existing by idApi
  const idApis = Array.from(new Set(rows.map((r) => r.data.idApi)));
  const existing = await prisma.student.findMany({
    where: { idApi: { in: idApis } },
    select: { idApi: true },
  });
  const existingSet = new Set(existing.map((e) => e.idApi));

  // 3) chunk + upsert
  const BATCH_SIZE = 200;
  const batches = chunk(rows, BATCH_SIZE);

  for (const batch of batches) {
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          const s = row.data;

          try {
            await tx.student.upsert({
              where: { idApi: s.idApi },
              create: {
                idApi: s.idApi,
                nis: s.nis,
                name: s.name,
                gender: s.gender,
                status: s.status, // boolean
                ttl: s.ttl,
                photoUrl: s.photoUrl,
                parrentPhone: s.parrentPhone,
                dormitory: s.dormitory,
                provinceId: s.provinceId,
                regencyId: s.regencyId,
                districtId: s.districtId,
                villageId: s.villageId,
                fullAddress: s.fullAddress,
              },
              update: {
                nis: s.nis,
                name: s.name,
                gender: s.gender,
                status: s.status,
                ttl: s.ttl,
                photoUrl: s.photoUrl,
                parrentPhone: s.parrentPhone,
                dormitory: s.dormitory,
                provinceId: s.provinceId,
                regencyId: s.regencyId,
                districtId: s.districtId,
                villageId: s.villageId,
                fullAddress: s.fullAddress,
              },
            });

            if (existingSet.has(s.idApi)) result.updated++;
            else {
              result.inserted++;
              existingSet.add(s.idApi);
            }

            result.processed++;
          } catch (e) {
            result.failed++;
            result.errors.push({
              index: row.index,
              idApi: s.idApi,
              nis: s.nis,
              message: prismaErrorMessage(e),
            });

            console.log(e);
          }
        }
      },
      { timeout: 60_000 },
    );
  }

  await prisma.syncLog.upsert({
    where: { key: "students" },
    create: {
      key: "students",
      lastSyncAt: new Date(),
      lastStatus: result.failed > 0 ? "failed" : "success",
      lastSummary: {
        total: result.total,
        processed: result.processed,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
    },
    update: {
      lastSyncAt: new Date(),
      lastStatus: result.failed > 0 ? "failed" : "success",
      lastSummary: {
        total: result.total,
        processed: result.processed,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
    },
  });

  revalidatePath("/santri");
  return result;
}
