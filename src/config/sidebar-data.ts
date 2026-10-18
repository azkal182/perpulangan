import {
  Banknote,
  Bus,
  Calendar,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardList,
  Database,
  Home,
  MapPin,
  Navigation,
  Printer,
  User2,
  Users,
  Users2,
} from "lucide-react";

// Beranda dan ringkasan aplikasi.
export const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
];

// Alur kerja utama untuk mengelola perjalanan perpulangan.
export const operations = [
  { title: "Event", url: "/event", icon: Calendar },
  { title: "Registrasi Pulang", url: "/registrasi", icon: ClipboardCheck },
  { title: "Registrasi Kembali", url: "/registrasi-kembali", icon: ClipboardCopy },
  { title: "Daftar Peserta", url: "/daftar-peserta", icon: Users },
  { title: "Rombongan & Armada", url: "/rombongan", icon: Bus },
  { title: "Tracking", url: "/tracking", icon: Navigation },
  { title: "Cetak Kartu & Tiket", url: "/cetak-dokumen", icon: Printer },
];

// Data peserta dan wilayah yang dipakai dalam registrasi serta perjalanan.
export const participantData = [
  { title: "Data Pulang", url: "/data-pulang", icon: ClipboardList },
  { title: "Santri", url: "/santri", icon: User2 },
  { title: "Peserta Eksternal", url: "/peserta-eksternal", icon: Users2 },
  { title: "Master Data", url: "/master", icon: Database },
  { title: "Titik Turun", url: "/titik_turun", icon: MapPin },
];

// Pencatatan pembayaran dan ringkasan keuangan.
export const finance = [
  { title: "Pembayaran", url: "/pembayaran", icon: Banknote },
  { title: "Refund", url: "/refund", icon: Banknote },
  { title: "Koreksi Transaksi", url: "/koreksi-keuangan", icon: ClipboardCopy },
  { title: "Laporan Keuangan", url: "/laporan", icon: ChartNoAxesCombined },
  { title: "Keuangan Pusat", url: "/keuangan", icon: Banknote, adminOnly: true },
];

// Administrasi akun dan akses.
export const administration = [
  { title: "Pengguna", url: "/dashboard/users", icon: Users2 },
];
