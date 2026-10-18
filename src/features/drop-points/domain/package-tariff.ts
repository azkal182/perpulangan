import type { JourneyDirection } from "@/generated/prisma/client";

export type PackageTariff = {
  outbound: number;
  returning: number;
};

/**
 * Split a DropPoint package price across the Pulang and Kembali journeys.
 * Prices are integer rupiah: Pulang gets the lower half and Kembali receives
 * any odd rupiah so the two directions always add up to the package price.
 */
export function splitPackageTariff(packagePrice: number): PackageTariff {
  if (!Number.isSafeInteger(packagePrice) || packagePrice < 0) {
    throw new RangeError("Harga paket harus berupa bilangan rupiah bulat non-negatif.");
  }

  const outbound = Math.floor(packagePrice / 2);
  return { outbound, returning: packagePrice - outbound };
}

export function getJourneyTariff(packagePrice: number, direction: JourneyDirection): number {
  const split = splitPackageTariff(packagePrice);
  return direction === "OUTBOUND" ? split.outbound : split.returning;
}
