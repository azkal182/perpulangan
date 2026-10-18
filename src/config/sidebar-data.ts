import {
  AudioWaveform,
  Banknote,
  ChartNoAxesCombined,
  Bus,
  Calendar,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardList,
  Command,
  Database,
  GalleryVerticalEnd,
  Home,
  MapPin,
  Navigation,
  Printer,
  User2,
  Users,
  Users2,
} from "lucide-react";

// Data untuk workspace/team selector
export const teams = [
  {
    name: "Acme Inc",
    logo: GalleryVerticalEnd,
    plan: "Enterprise",
  },
  {
    name: "Acme Corp.",
    logo: AudioWaveform,
    plan: "Startup",
  },
  {
    name: "Evil Corp.",
    logo: Command,
    plan: "Free",
  },
];

// Data untuk navigation utama
export const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    isActive: true,
  },
  {
    title: "Event",
    url: "/event",
    icon: Calendar,
  },
  {
    title: "Santri",
    url: "/santri",
    icon: User2,
  },
  {
    title: "Peserta Eksternal",
    url: "/peserta-eksternal",
    icon: Users2,
  },
  {
    title: "Tracking",
    url: "/tracking",
    icon: Navigation,
  },
];

// Data untuk secondary navigation

// Data Manajemen
export const managements = [
  {
    title: "Master",
    url: "/master",
    icon: Database,
  },
  {
    title: "registrasi",
    url: "/registrasi",
    icon: ClipboardCheck,
  },
  {
    title: "Registrasi Kembali",
    url: "/registrasi-kembali",
    icon: ClipboardCopy,
  },
  {
    title: "Daftar Peserta",
    url: "/daftar-peserta",
    icon: Users,
  },
  {
    title: "Data Pulang",
    url: "/data-pulang",
    icon: ClipboardList,
  },
  {
    title: "Cetak Kartu & Tiket",
    url: "/cetak-dokumen",
    icon: Printer,
  },
  {
    title: "Rombongan",
    url: "/rombongan",
    icon: Bus,
  },
  {
    title: "Titik Turun",
    url: "/titik_turun",
    icon: MapPin,
  },
  {
    title: "Pembayaran",
    url: "/pembayaran",
    icon: Banknote,
  },
  {
    title: "Laporan",
    url: "/laporan",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Keuangan Pusat",
    url: "/keuangan",
    icon: Banknote,
  },
  {
    title: "Refund",
    url: "/refund",
    icon: Banknote,
  },
];

// Data Lainnya
export const others = [
  //   {
  //     title: "laporan",
  //     url: "/laporan",
  //     icon: ClipboardMinus,
  //     badge: "5",
  //   },
  {
    title: "Users",
    url: "/dashboard/users",
    icon: Users2,
  },
  //   {
  //     title: "Pengaturan",
  //     url: "/pengaturan",
  //     icon: Settings,
  //   },
];
