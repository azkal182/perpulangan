export type Student = {
  id: string;
  idApi: string;
  nis: string | null;
  name: string;
  gender: string;
  status: boolean;
  ttl: string;
  photoUrl: string;
  parrentPhone?: string;
  dormitory: string;
  provinceId?: number;
  regencyId?: number;
  districtId?: number;
  villageId?: number;
  fullAddress: string;
};
