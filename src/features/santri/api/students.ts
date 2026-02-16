import axios from "axios";
import { StudentsResponseDTO } from "./students.dto";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "x-api-key": process.env.NEXT_PUBLIC_API_KEY!,
    "Content-Type": "application/json",
  },
});

export type StudentGroup = "putra" | "putri";

type FetchStudentsParams = {
  page?: number;
  perPage?: number;
  group?: StudentGroup;
};

export async function fetchStudents(
  params?: FetchStudentsParams,
): Promise<StudentsResponseDTO> {
  const query: Record<string, number> = {};
  const group = params?.group ?? "putra";

  if (typeof params?.page === "number" && Number.isFinite(params.page)) {
    query.page = params.page;
  }

  if (typeof params?.perPage === "number" && Number.isFinite(params.perPage)) {
    // Ikuti konvensi API umum: per_page
    query.per_page = params.perPage;
  }

  const res = await api.get<StudentsResponseDTO>(`/api/anggota/${group}?limit=100`, {
    params: Object.keys(query).length > 0 ? query : undefined,
  });
  return res.data;
}
