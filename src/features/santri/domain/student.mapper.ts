import type { StudentDTO } from "../api/students.dto";
import type { Student } from "./student.model";

function mapStatusParamToBoolean(status?: string): boolean {
  if (status?.toLowerCase() === "aktif") {
    return true;
  } else {
    return false;
  }
}

export function mapStudent(dto: StudentDTO): Student {
  return {
    id: String(dto.id_anggota),
    idApi: dto.id_anggota,
    nis: dto.nis_santri,
    name: dto.nama,
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
