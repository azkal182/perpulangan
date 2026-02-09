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
  outboundKordaId: Id;
  outboundDropPointId: Id;
  returnKordaId: Id;
  returnDropPointId: Id;
  notes?: string;
};

export type Registration = {
  id: Id;
  eventId: Id;
  studentId: Id;
  student: Student;
  
  outboundKordaId: Id;
  outboundKorda: { id: Id; name: string };
  outboundDropPointId: Id;
  outboundDropPoint: { id: Id; name: string; price: number };
  outboundPaid: boolean;
  
  returnKordaId: Id;
  returnKorda: { id: Id; name: string };
  returnDropPointId: Id;
  returnDropPoint: { id: Id; name: string; price: number };
  returnPaid: boolean;
  
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  kordaChanged: boolean;
  kordaChangeConfirmed: boolean;
  
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
