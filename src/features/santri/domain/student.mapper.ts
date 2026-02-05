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
    provinceId: Number(dto.alamat.provinsi.id),
    regencyId: Number(dto.alamat.kabupaten.id),
    districtId: Number(dto.alamat.kecamatan.id),
    village: dto.alamat.desa,
    fullAddress: dto.alamat.alamat_lengkap,
  };
}
