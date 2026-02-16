export type Id = string;

// Re-export from other features for consistency
export type { Korwil, Korda } from "@/features/master/types";
export type { DropPoint } from "@/features/drop-points/types";

export type Student = {
  id: Id;
  name: string;
  nis: string;
  regency?: {
    kordaId?: string | null;
  } | null;
};

export type RegistrationFormData = {
  eventId: Id;
  studentId: Id;
  // Optional outbound journey (for return-only registration)
  outboundKordaId?: Id | null;
  outboundDropPointId?: Id | null;
  outboundDate?: string | null;
  // Optional return journey (can be cancelled)
  returnKordaId?: Id | null;
  returnDropPointId?: Id | null;
  returnDate?: string | null;
  // Required registrar info
  registrarName: string;
  registrarPhone: string;
  notes?: string;
};

export type Registration = {
  id: Id;
  eventId: Id;
  studentId: Id;
  student: Student;
  
  // Optional outbound journey
  outboundKordaId: Id | null;
  outboundKorda: { id: Id; name: string } | null;
  outboundDropPointId: Id | null;
  outboundDropPoint: { id: Id; name: string; price: number } | null;
  outboundDate: Date | null;
  outboundPaid: boolean;
  
  // Optional return journey
  returnKordaId: Id | null;
  returnKorda: { id: Id; name: string } | null;
  returnDropPointId: Id | null;
  returnDropPoint: { id: Id; name: string; price: number } | null;
  returnDate: Date | null;
  returnPaid: boolean;
  
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "PARTIAL_CANCEL";
  kordaChanged: boolean;
  kordaChangeConfirmed: boolean;
  
  // Cancellation tracking
  cancelledAt: Date | null;
  cancelReason: string | null;
  refundAmount: number | null;
  
  // Registrar info
  registrarName: string;
  registrarPhone: string;
  notes?: string | null;
  
  createdAt: Date;
  updatedAt: Date;
};
