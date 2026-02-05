// export type StudentDTO = {
//   id: number;
//   full_name: string;
//   avatar_url: string | null;
//   created_at: string;
// };

export type Data = {
  items: StudentDTO[];
  pagination: Pagination;
};

export type StudentDTO = {
  id_anggota: string;
  nis_santri: string;
  no_rekening: string;
  id_produk: string;
  id_rfid: string;
  identitas_lengkap: string;
  nama: string;
  nama_lengkap: string;
  kelamin: string;
  tempat_lahir: string;
  tgl_lahir: Date;
  tgl_lahir_formatted: string;
  ttl: string;
  alamat: Address;
  kontak: Kontak;
  status_anggota: Asrama;
  kelas: Asrama;
  asrama: Asrama;
  kamar: Asrama;
  tempat_tinggal: string;
  keluarga: Keluarga;
  foto: Foto;
  na: string;
  ket_update_api: null;
  _display: Display;
};

export type Display = {
  identitas_lengkap: string;
  nama_lengkap: string;
  ttl: string;
  alamat_lengkap: string;
  identitas_ortu: string;
  tempat_tinggal: string;
  foto_url?: string;
};

export type Asrama = {
  id: number | null | string;
  nama: null | string;
};

interface RegionDetail {
  id: string;
  nama: string;
}

interface Address {
  provinsi: RegionDetail;
  kabupaten: RegionDetail;
  kecamatan: RegionDetail;
  desa: string;
  rt: number;
  rw: number;
  kodepos: string;
  alamat_lengkap: string;
}

export type Foto = {
  filename: string;
  url: string;
};

export type Keluarga = {
  nama_ayah: string;
  nama_ibu: string;
  identitas_ortu: string;
};

export type Kontak = {
  hp: string;
  hp_ortu?: string;
};

export type Pagination = {
  current_page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type StudentsResponseDTO = {
  data: {
    items: StudentDTO[];
    pagination: Pagination;
  };
};
