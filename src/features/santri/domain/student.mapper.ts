import type { StudentDTO } from "../api/students.dto";
import type { Student } from "./student.model";

export function mapStudent(dto: StudentDTO): Student {
  return {
    id: String(dto.id_anggota),
    nis: dto.nis_santri,
    fullName: dto.nama_lengkap,
    gender: dto.kelamin,
    dormitory: dto.asrama.nama || "",
  };
}
