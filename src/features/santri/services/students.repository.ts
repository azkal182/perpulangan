import { fetchStudents, type StudentGroup } from "../api/students";
import { mapStudent } from "../domain/student.mapper";
import type { Student } from "../domain/student.model";

async function fetchAllStudentsByGroup(group: StudentGroup) {
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

  return allItems;
}

export async function getStudents(): Promise<Student[]> {
  const [putra, putri] = await Promise.all([
    fetchAllStudentsByGroup("putra"),
    fetchAllStudentsByGroup("putri"),
  ]);

  return [...putra, ...putri].map(mapStudent);
}
