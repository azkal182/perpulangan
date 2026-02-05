export type Id = string;

export type Korwil = { id: Id; name: string };
export type Korda = { id: Id; name: string; korwilId: Id };
export type Kota = { id: Id; name: string; kordaId: Id };

export type DropPoint = {
  id: Id;
  kordaId: Id;
  name: string;
  price: number; // IDR per orang
};

export type Member = {
  id: Id;
  name: string;
  phone?: string;
};

export type RegistrationDraft = {
  korwilId: Id | null;
  kordaId: Id | null;
  kotaId: Id | null;

  dropPointId: Id | null;

  departDate: string; // ISO date yyyy-mm-dd

  bookerName: string;
  bookerPhone: string;

  notes: string;

  members: Member[];
};
