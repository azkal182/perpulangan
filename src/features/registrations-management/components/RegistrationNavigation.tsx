"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, UserPlus, UserCheck } from "lucide-react";

const navItems = [
  {
    href: "/daftar-peserta",
    label: "Daftar Peserta",
    icon: Users,
    description: "Lihat semua peserta terdaftar",
  },
  {
    href: "/registrasi",
    label: "Daftar Pulang-Kembali",
    icon: UserPlus,
    description: "Daftar peserta pulang & kembali",
  },
  {
    href: "/registrasi-kembali",
    label: "Daftar Kembali Saja",
    icon: UserCheck,
    description: "Daftar peserta kembali saja",
  },
];

export function RegistrationNavigation() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <nav className="flex gap-1 overflow-x-auto py-2" aria-label="Registration navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
