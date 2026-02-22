"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bus,
  ClipboardCheck,
  Home,
  MapPin,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BottomNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const mobileNavItems: BottomNavItem[] = [
  {
    title: "Home",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Registrasi",
    href: "/registrasi",
    icon: ClipboardCheck,
  },
  {
    title: "Daftar Peserta",
    href: "/daftar-peserta",
    icon: Users,
  },
  {
    title: "Rombongan",
    href: "/rombongan",
    icon: Bus,
  },
  {
    title: "Titik Turun",
    href: "/titik_turun",
    icon: MapPin,
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      <ul className="grid h-16 grid-cols-5">
        {mobileNavItems.map((item) => {
          const active = isItemActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 px-1 text-[10px] leading-tight",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-center">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
