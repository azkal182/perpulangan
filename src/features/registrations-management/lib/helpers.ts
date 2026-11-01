import type { RegistrationWithDetails } from "../repositories/registrations.repository";

export type JourneyType = "both" | "return_only" | "outbound_only" | "cancelled" | "unknown";

export function getJourneyType(
  registration: RegistrationWithDetails,
): JourneyType {
  const hasOutbound = registration.outboundJourneyStatus === "REGISTERED";
  const hasReturn = registration.returnJourneyStatus === "REGISTERED";

  if (hasOutbound && hasReturn) return "both";
  if (!hasOutbound && hasReturn) return "return_only";
  if (hasOutbound && !hasReturn) return "outbound_only";
  if (registration.outboundJourneyStatus || registration.returnJourneyStatus) return "cancelled";
  return "unknown";
}

export function getJourneyTypeLabel(type: JourneyType): string {
  switch (type) {
    case "both":
      return "Pulang & Kembali aktif";
    case "return_only":
      return "Kembali aktif";
    case "outbound_only":
      return "Pulang aktif";
    case "cancelled":
      return "Tidak ada perjalanan aktif";
    default:
      return "Belum ada data perjalanan";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-green-100 text-green-800 border-green-300";
    case "CANCELLED":
      return "bg-red-100 text-red-800 border-red-300";
    case "PARTIAL_CANCEL":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "DRAFT":
      return "bg-gray-100 text-gray-800 border-gray-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

export function formatDate(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
