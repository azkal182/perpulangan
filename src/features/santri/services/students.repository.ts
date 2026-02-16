import { fetchStudents, type StudentGroup } from "../api/students";
import { logger } from "@/lib/logger";
import { mapStudent } from "../domain/student.mapper";
import type { Student } from "../domain/student.model";

async function fetchAllStudentsByGroup(group: StudentGroup) {
  try {
    const first = await fetchStudents({ page: 1, group });
    const allItems = [...first.data.items];

    const pagination = first.data.pagination;
    if (!pagination) return allItems;

    const currentPage = Number(pagination.current_page ?? 1);
    const totalPages = Number(pagination.total_pages ?? currentPage);

    if (Number.isFinite(totalPages) && totalPages > currentPage) {
      for (let page = currentPage + 1; page <= totalPages; page++) {
        const res = await fetchStudents({ page, group });
        allItems.push(...res.data.items);
      }
      return allItems;
    }

    if (pagination.has_next) {
      let page = currentPage + 1;
      let safety = 0;
      let hasNext = true;

      while (hasNext && safety < 200) {
        const res = await fetchStudents({ page, group });
        allItems.push(...res.data.items);

        const nextPagination = res.data.pagination;
        hasNext = Boolean(nextPagination?.has_next);

        const nextCurrent = Number(nextPagination?.current_page ?? page);
        const nextPage = nextCurrent + 1;

        if (!Number.isFinite(nextPage) || nextPage <= page) break;
        page = nextPage;
        safety += 1;
      }
    }

    logger.debug({ group, count: allItems.length }, "students.repository.fetchAllStudentsByGroup success");
    return allItems;
  } catch (error) {
    logger.error({ err: error, group }, "students.repository.fetchAllStudentsByGroup failed");
    throw error;
  }
}

export async function getStudents(): Promise<Student[]> {
  try {
    const [putra, putri] = await Promise.all([
      fetchAllStudentsByGroup("putra"),
      fetchAllStudentsByGroup("putri"),
    ]);

    const result = [...putra, ...putri].map((dto) => mapStudent(dto));
    logger.debug({ count: result.length }, "students.repository.getStudents success");
    return result;
  } catch (error) {
    logger.error({ err: error }, "students.repository.getStudents failed");
    throw error;
  }
}

/**
 * Returns both raw DTOs and mapped Students.
 * Raw DTOs are needed for regional validation (to access `alamat` field).
 */
export async function getStudentDTOs(): Promise<{
  students: Student[];
  dtos: import("../api/students.dto").StudentDTO[];
}> {
  try {
    const [putra, putri] = await Promise.all([
      fetchAllStudentsByGroup("putra"),
      fetchAllStudentsByGroup("putri"),
    ]);

    const allDTOs = [...putra, ...putri];
    const students = allDTOs.map((dto) => mapStudent(dto));
    logger.debug({ count: students.length }, "students.repository.getStudentDTOs success");
    return { students, dtos: allDTOs };
  } catch (error) {
    logger.error({ err: error }, "students.repository.getStudentDTOs failed");
    throw error;
  }
}
