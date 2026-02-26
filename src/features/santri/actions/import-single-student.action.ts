"use server";

import { fetchStudentById } from "../api/students";
import type { StudentDTO } from "../api/students.dto";
import { mapStudent } from "../domain/student.mapper";
import { bulkUpsertStudents, type StudentNormalized } from "./students.actions";
import { validateRegionalData } from "./validate-regional.action";

type RegionalMatchInfo = {
  needed: boolean;
  matched: boolean;
  provinceName: string | null;
  regencyName: string | null;
};

export type SingleStudentImportPreview = {
  idApi: string;
  nis: string;
  name: string;
  gender: string;
  ttl: string;
  dormitory: string;
  fullAddress: string;
  provinceId: number | null;
  regencyId: number | null;
  addressSource: "alamat_new" | "fallback_validation" | "none";
  regional: RegionalMatchInfo;
  blockingIssues: string[];
  skippedIssues: string[];
};

function validateSingleStudentForImport(student: StudentNormalized) {
  const missing: string[] = [];
  if (!student.idApi) missing.push("idApi");
  if (!student.nis) missing.push("nis");
  if (!student.name) missing.push("name");
  if (!student.gender) missing.push("gender");
  if (!student.ttl) missing.push("ttl");
  if (!student.dormitory) missing.push("dormitory");
  if (!student.fullAddress) missing.push("fullAddress");

  if (missing.length === 0) {
    return { blockingIssues: [] as string[], skippedIssues: [] as string[] };
  }

  const skippedIssues = missing.filter((field) =>
    field === "nis" || field === "dormitory",
  );
  const blockingIssues = missing.filter(
    (field) => field !== "nis" && field !== "dormitory",
  );

  return { blockingIssues, skippedIssues };
}

function toNormalizedStudent(student: ReturnType<typeof mapStudent>): StudentNormalized {
  return {
    idApi: student.idApi,
    nis: student.nis ?? "",
    name: student.name,
    gender: student.gender,
    status: student.status,
    ttl: student.ttl,
    photoUrl: student.photoUrl ?? null,
    parrentPhone: student.parrentPhone ?? null,
    dormitory: student.dormitory ?? "",
    provinceId: student.provinceId ?? null,
    regencyId: student.regencyId ?? null,
    districtId: student.districtId ?? null,
    villageId: student.villageId ?? null,
    fullAddress: student.fullAddress ?? "",
  };
}

async function mapDtoForSingleImport(dto: StudentDTO): Promise<{
  normalized: StudentNormalized;
  preview: SingleStudentImportPreview;
}> {
  const provinceName = dto.alamat?.provinsi?.nama ?? null;
  const regencyName = dto.alamat?.kabupaten?.nama ?? null;
  const hasNewAddress = Boolean(dto.alamat_new?.provinsi?.id);

  let validationMap:
    | Map<string, { provinceId: number | null; regencyId: number | null }>
    | undefined;

  const regional: RegionalMatchInfo = {
    needed: !hasNewAddress && Boolean(provinceName && regencyName),
    matched: false,
    provinceName,
    regencyName,
  };

  if (regional.needed) {
    const validationResult = await validateRegionalData([
      {
        idApi: dto.id_anggota,
        provinceName,
        regencyName,
      },
    ]);

    if (validationResult.success) {
      validationMap = new Map(validationResult.validationEntries);
      const matched = validationMap.get(dto.id_anggota);
      regional.matched = Boolean(matched?.provinceId && matched?.regencyId);
    }
  }

  const mapped = mapStudent(dto, validationMap);
  const normalized = toNormalizedStudent(mapped);
  const issues = validateSingleStudentForImport(normalized);

  const addressSource: SingleStudentImportPreview["addressSource"] = hasNewAddress
    ? "alamat_new"
    : regional.matched
      ? "fallback_validation"
      : "none";

  return {
    normalized,
    preview: {
      idApi: normalized.idApi,
      nis: normalized.nis,
      name: normalized.name,
      gender: normalized.gender,
      ttl: normalized.ttl,
      dormitory: normalized.dormitory,
      fullAddress: normalized.fullAddress,
      provinceId: normalized.provinceId ?? null,
      regencyId: normalized.regencyId ?? null,
      addressSource,
      regional,
      blockingIssues: issues.blockingIssues,
      skippedIssues: issues.skippedIssues,
    },
  };
}

export async function previewSingleStudentImportByIdAction(idApi: string): Promise<{
  success: boolean;
  data?: SingleStudentImportPreview;
  error?: string;
}> {
  try {
    const dto = await fetchStudentById(idApi);
    const { preview } = await mapDtoForSingleImport(dto);
    return {
      success: true,
      data: preview,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil data anggota dari API",
    };
  }
}

export async function importSingleStudentByIdAction(idApi: string): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  error?: string;
}> {
  try {
    const dto = await fetchStudentById(idApi);
    const { normalized, preview } = await mapDtoForSingleImport(dto);

    if (preview.blockingIssues.length > 0) {
      return {
        success: false,
        error: `Field wajib kosong: ${preview.blockingIssues.join(", ")}`,
      };
    }

    const result = await bulkUpsertStudents([normalized]);

    if (result.processed > 0 && result.failed === 0) {
      return {
        success: true,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      };
    }

    if (result.skipped > 0) {
      return {
        success: false,
        skipped: result.skipped,
        failed: result.failed,
        error:
          result.skippedRows[0]?.message ??
          "Data tidak diimport karena tidak memenuhi syarat",
      };
    }

    return {
      success: false,
      skipped: result.skipped,
      failed: result.failed,
      error: result.errors[0]?.message ?? "Gagal mengimport data santri",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengimport data anggota",
    };
  }
}
