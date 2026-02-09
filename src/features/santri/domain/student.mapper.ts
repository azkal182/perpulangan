import type { StudentDTO } from "../api/students.dto";
import type { Student } from "./student.model";

function mapStatusParamToBoolean(status?: string): boolean {
  if (status?.toLowerCase() === "aktif") {
    return true;
  } else {
    return false;
  }
}

/**
 * Membersihkan nama dari teks di dalam kurung dan spasi berlebih
 * @param name - Nama mentah yang mengandung keterangan dalam kurung
 * @returns Nama yang sudah bersih
 */
function normalizeName(name: string): string {
    if (!name) return "";

    return name
        // 1. Regex untuk mencari teks di dalam kurung: \(.*?\)
        // g = global (semua kurung), s = dotAll (termasuk line breaks)
        .replace(/\([\s\S]*?\)/g, "")        
        // 2. Menghapus spasi ganda yang mungkin muncul setelah penghapusan
        .replace(/\s+/g, " ")
        
        // 3. Membersihkan spasi di awal dan akhir string
        .trim();
}

export function mapStudent(dto: StudentDTO): Student {
  return {
    id: String(dto.id_anggota),
    idApi: dto.id_anggota,
    nis: dto.nis_santri,
    name: normalizeName(dto.nama),
    gender: dto.kelamin,
    status:
      dto.status_anggota.nama !== null
        ? mapStatusParamToBoolean(dto.status_anggota.nama)
        : false,
    ttl: dto.ttl,
    photoUrl: dto.foto.url,
    parrentPhone: dto.kontak.hp_ortu,
    dormitory: dto.asrama.nama || "",
    provinceId: dto.alamat_new.provinsi.id
      ? Number(dto.alamat_new.provinsi.id)
      : undefined,
    regencyId: dto.alamat_new.kabupaten.id
      ? Number(dto.alamat_new.kabupaten.id)
      : undefined,
    districtId: dto.alamat_new.kecamatan.id
      ? Number(dto.alamat_new.kecamatan.id)
      : undefined,
    villageId: dto.alamat_new.desa.id
      ? Number(dto.alamat_new.desa.id)
      : undefined,
    fullAddress: dto.alamat_new.alamat_lengkap,
  };
}
