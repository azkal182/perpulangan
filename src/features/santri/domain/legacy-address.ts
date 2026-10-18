type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function regionName(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const region = asRecord(value);
  for (const key of ["nama", "name", "label"]) {
    const candidate = region?.[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

/** Formats the API's legacy address hierarchy as readable text, never raw JSON. */
export function formatLegacyAddress(sourceAddress: unknown): string {
  const source = asRecord(sourceAddress);
  const legacy = asRecord(source?.alamat_legacy ?? source?.alamat ?? source);
  if (!legacy) return "Alamat legacy tidak tersedia";

  const parts = [legacy.provinsi, legacy.kabupaten, legacy.kecamatan].map(regionName);
  if (parts.every((part) => part === null)) return "Alamat legacy tidak tersedia";
  return parts.map((part) => part ?? "—").join(" → ");
}
