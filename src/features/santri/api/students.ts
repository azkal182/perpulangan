import axios from "axios";
import { StudentsResponseDTO } from "./students.dto";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  headers: {
    "x-api-key": process.env.NEXT_PUBLIC_API_KEY!,
    "Content-Type": "application/json",
  },
});

export async function fetchStudents(): Promise<StudentsResponseDTO> {
  const res = await api.get<StudentsResponseDTO>("/api/anggota/putra");
  return res.data;
}
