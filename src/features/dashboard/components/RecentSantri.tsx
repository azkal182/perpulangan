import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Santri {
  id: string;
  nama: string;
  nis: string;
  kamar: string;
  rombongan: string;
  statusPembayaran: "lunas" | "kurang" | "belum";
}

const mockSantri: Santri[] = [
  {
    id: "1",
    nama: "Ahmad Fauzi",
    nis: "2024001",
    kamar: "Al-Fatih 1",
    rombongan: "Jateng Bus 1",
    statusPembayaran: "lunas",
  },
  {
    id: "2",
    nama: "Muhammad Rizki",
    nis: "2024002",
    kamar: "Al-Fatih 2",
    rombongan: "Jatim Bus 2",
    statusPembayaran: "kurang",
  },
  {
    id: "3",
    nama: "Abdullah Hakim",
    nis: "2024003",
    kamar: "Al-Amin 1",
    rombongan: "Jabar Bus 1",
    statusPembayaran: "belum",
  },
  {
    id: "4",
    nama: "Umar Faruq",
    nis: "2024004",
    kamar: "Al-Amin 2",
    rombongan: "Jateng Bus 2",
    statusPembayaran: "lunas",
  },
  {
    id: "5",
    nama: "Hasan Basri",
    nis: "2024005",
    kamar: "Al-Fatih 3",
    rombongan: "Jatim Bus 1",
    statusPembayaran: "lunas",
  },
];

const statusConfig = {
  lunas: { label: "Lunas", className: "badge-lunas" },
  kurang: { label: "Kurang", className: "badge-kurang" },
  belum: { label: "Belum", className: "badge-belum" },
};

export function RecentSantri() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground mb-4">
        Santri Terdaftar Terbaru
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="table-header text-left py-3 px-2">Santri</th>
              <th className="table-header text-left py-3 px-2 hidden sm:table-cell">
                Kamar
              </th>
              <th className="table-header text-left py-3 px-2 hidden md:table-cell">
                Rombongan
              </th>
              <th className="table-header text-right py-3 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockSantri.map((santri) => (
              <tr
                key={santri.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {santri.nama
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {santri.nama}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {santri.nis}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-sm text-muted-foreground hidden sm:table-cell">
                  {santri.kamar}
                </td>
                <td className="py-3 px-2 text-sm text-muted-foreground hidden md:table-cell">
                  {santri.rombongan}
                </td>
                <td className="py-3 px-2 text-right">
                  <Badge
                    className={cn(
                      "text-xs",
                      statusConfig[santri.statusPembayaran].className,
                    )}
                  >
                    {statusConfig[santri.statusPembayaran].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
