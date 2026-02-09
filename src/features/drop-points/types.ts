export type Id = string;

// Re-export from master to ensure consistency
export type { Korwil, Korda } from "@/features/master/types";

export type DropPoint = {
  id: Id;
  kordaId: Id;
  name: string;
  price: number; // simpan number, display rupiah
};
