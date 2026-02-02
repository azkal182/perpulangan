import { Plus, Search, FileDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  {
    icon: Plus,
    label: "Buat Event Baru",
    description: "Tambah event liburan",
    variant: "default" as const,
  },
  {
    icon: UserPlus,
    label: "Tambah Santri",
    description: "Daftarkan ke event",
    variant: "outline" as const,
  },
  {
    icon: Search,
    label: "Cari Santri",
    description: "Dari database API",
    variant: "outline" as const,
  },
  {
    icon: FileDown,
    label: "Export Laporan",
    description: "Unduh data lengkap",
    variant: "outline" as const,
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground mb-4">Aksi Cepat</h3>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className="h-auto flex-col items-start p-4 gap-2"
          >
            <action.icon className="h-5 w-5" />
            <div className="text-left">
              <p className="font-medium">{action.label}</p>
              <p className="text-xs opacity-70 font-normal">
                {action.description}
              </p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
