export type Id = string;

export type Korwil = { id: Id; name: string };
export type Korda = { id: Id; name: string };
export type Kota = { id: Id; name: string };

export type State = {
  selectedKorwilId: Id | null;
  selectedKordaId: Id | null;
  korwils: Korwil[];
  kordasByKorwil: Record<Id, Korda[]>;
  kotasByKorda: Record<Id, Kota[]>;
};
