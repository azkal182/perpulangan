import { fetchStudents } from "../api/students";
import { mapStudent } from "../domain/student.mapper";
import type { Student } from "../domain/student.model";

export async function getStudents(): Promise<Student[]> {
  const response = await fetchStudents();
  return response.data.items.map(mapStudent);
}
