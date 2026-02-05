export type Id = string;

export type Korwil = { id: Id; name: string };
export type Korda = { id: Id; name: string; korwilId: Id };

export type DropPoint = {
  id: Id;
  kordaId: Id;
  name: string;
  price: number; // simpan number, display rupiah
};
