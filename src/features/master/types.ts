export type Id = string;

export type Korwil = {
  id: Id;
  name: string;
  picName?: string | null;
  picPhone?: string | null;
  picUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Korda = {
  id: Id;
  name: string;
  korwilId?: Id | null;
  picName?: string | null;
  picPhone?: string | null;
  picUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Kota = {
  id: number;
  name: string;
  regencyName: string;
  regencyLabel?: string | null;
  regencyType?: string | null;
  provinceName?: string | null;
  kordaId?: Id | null;
};

export type RegencyOption = {
  value: number;
  name: string;
  label: string;
  type?: string | null;
  provinceName?: string | null;
  kordaId?: Id | null;
  kordaName?: string | null;
};

export type ProvinceOption = {
  value: number;
  name: string;
  label: string;
  code?: string;
};

export type State = {
  selectedKorwilId: Id | null;
  selectedKordaId: Id | null;
  korwils: Korwil[];
  kordasByKorwil: Record<Id, Korda[]>;
  kotasByKorda: Record<Id, Kota[]>;
};
