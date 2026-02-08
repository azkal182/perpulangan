"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type StudentInput = {
  idApi: string;
  nis: string;
  name: string;
  gender: string;
  status: string;
  ttl: string;
  photoUrl?: string | null;
  parrentPhone?: string | null;
  dormitory: string;
  provinceId?: number | null;
  regencyId?: number | null;
  districtId?: number | null;
  village: string;
  fullAddress: string;
};

export type BulkImportResult = {
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{
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

function normalizeStudent(s: StudentInput): StudentInput {
  return {
    ...s,
    idApi: String(s.idApi).trim(),
    nis: String(s.nis).trim(),
    name: String(s.name).trim(),
    gender: String(s.gender).trim(),
    status: String(s.status).trim(),
    ttl: String(s.ttl).trim(),
    dormitory: String(s.dormitory).trim(),
    village: String(s.village).trim(),
    fullAddress: String(s.fullAddress).trim(),
    photoUrl: s.photoUrl ?? null,
    parrentPhone: s.parrentPhone ?? null,
    provinceId: s.provinceId ?? null,
    regencyId: s.regencyId ?? null,
    districtId: s.districtId ?? null,
  };
}

function validateStudent(s: StudentInput) {
  // Minimal sesuai schema + unik (idApi, nis)
  if (!s.idApi) return "idApi wajib";
  if (!s.nis) return "nis wajib";
  if (!s.name) return "name wajib";
  if (!s.gender) return "gender wajib";
  if (!s.status) return "status wajib";
  if (!s.ttl) return "ttl wajib";
  if (!s.dormitory) return "dormitory wajib";
  if (!s.village) return "village wajib";
  if (!s.fullAddress) return "fullAddress wajib";
  return null;
}

export async function bulkUpsertStudents(
  rawRows: StudentInput[],
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    total: rawRows?.length ?? 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!Array.isArray(rawRows) || rawRows.length === 0) return result;

  // 1) normalize + validate
  const rows: { index: number; data: StudentInput }[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const normalized = normalizeStudent(rawRows[i]);
    const err = validateStudent(normalized);
    if (err) {
      result.failed++;
      result.errors.push({
        index: i,
        idApi: normalized.idApi,
        nis: normalized.nis,
        message: err,
      });
      continue;
    }
    rows.push({ index: i, data: normalized });
  }

  if (rows.length === 0) return result;

  // 2) prefetch existing by idApi untuk hitung inserted/updated
  const idApis = rows.map((r) => r.data.idApi);
  const existing = await prisma.student.findMany({
    where: { idApi: { in: idApis } },
    select: { idApi: true },
  });
  const existingSet = new Set(existing.map((e) => e.idApi));

  // 3) proses dalam chunk biar tidak terlalu berat
  const BATCH_SIZE = 200;
  const batches = chunk(rows, BATCH_SIZE);

  for (const batch of batches) {
    // Gunakan transaction biar konsisten per-batch
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          const s = row.data;

          try {
            // Upsert by idApi (unique)
            await tx.student.upsert({
              where: { idApi: s.idApi },
              create: {
                idApi: s.idApi,
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
                village: s.village,
                fullAddress: s.fullAddress,
              },
              update: {
                // update field yang kamu mau sync dari API
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
                village: s.village,
                fullAddress: s.fullAddress,
              },
            });

            // hitung insert/update (berdasarkan existingSet sebelum import)
            if (existingSet.has(s.idApi)) result.updated++;
            else {
              result.inserted++;
              existingSet.add(s.idApi);
            }

            result.processed++;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            result.failed++;
            result.errors.push({
              index: row.index,
              idApi: s.idApi,
              nis: s.nis,
              message: e?.message ?? "Gagal upsert",
            });
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
        failed: result.failed,
      },
    },
  });

  revalidatePath("/santri");

  return result;
}
