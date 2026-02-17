"use server";

import { revalidatePath } from "next/cache";

import {
  getFilteredRegistrations,
  getRegistrationStats,
  type RegistrationFilters,
} from "../repositories/registrations.repository";

export async function getRegistrationsAction(filters: RegistrationFilters) {
  try {
    const result = await getFilteredRegistrations(filters);
    return {
      success: true,
      data: result.data,
      total: result.total,
      page: filters.page || 1,
      pageSize: filters.pageSize || 20,
    };
  } catch (error) {
    console.error("Failed to get registrations:", error);
    return {
      success: false,
      error: "Gagal mengambil data registrasi",
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };
  }
}

export async function getStatsAction(eventId: string) {
  try {
    const stats = await getRegistrationStats(eventId);
    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Failed to get registration stats:", error);
    return {
      success: false,
      error: "Gagal mengambil statistik",
      data: null,
    };
  }
}
