import type { StudentDTO } from "../api/students.dto";
import type { Student } from "./student.model";

export function mapStudent(dto: StudentDTO): Student {
  return {
    id: String(dto.id_anggota),
    idApi: dto.id_anggota,
    nis: dto.nis_santri,
    name: dto.nama,
    gender: dto.kelamin,
    status: dto.status_anggota.nama ?? "",
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
    village: dto.alamat_new.desa,
    fullAddress: dto.alamat_new.alamat_lengkap,
  };
}
