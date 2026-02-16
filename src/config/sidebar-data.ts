import {
  AudioWaveform,
  Banknote,
  Bus,
  Calendar,
  ClipboardMinus,
  Command,
  GalleryVerticalEnd,
  Home,
  MapPin,
  Settings,
  User2,
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
];

// Data untuk secondary navigation

// Data Manajemen
export const managements = [
  {
    title: "Master",
    url: "/master",
    icon: Bus,
  },
  {
    title: "registrasi Rombongan",
    url: "/registrasi",
    icon: Bus,
  },
  {
    title: "Registrasi Kembali Saja",
    url: "/registrasi/kembali-saja",
    icon: Bus,
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
];

// Data Lainnya
export const others = [
  {
    title: "laporan",
    url: "/laporan",
    icon: ClipboardMinus,
    badge: "5",
  },
  {
    title: "Pengaturan",
    url: "/titik_turun",
    icon: Settings,
  },
  {
    title: "Pembayaran",
    url: "/pembayaran",
    icon: Banknote,
  },
];
