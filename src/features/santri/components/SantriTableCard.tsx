"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";

type PaymentStatus = "Lunas" | "Kurang" | "Belum";

type Row = {
  id: string;
  name: string;
  nis: string;
  kamar: string;
  rombongan: { utama: string; pergi?: string };
  titikTurun: { utama: string; pergi?: string };
  pembayaran: { paid: number; total: number };
  status: PaymentStatus;
};

const DATA: Row[] = [
  {
    id: "1",
    name: "Ahmad Fauzi",
    nis: "2024001",
    kamar: "Al-Fatih 1",
    rombongan: { utama: "Jateng Bus 1" },
    titikTurun: { utama: "Semarang" },
    pembayaran: { paid: 1000000, total: 1000000 },
    status: "Lunas",
  },
  {
    id: "2",
    name: "Muhammad Rizki",
    nis: "2024002",
    kamar: "Al-Fatih 2",
    rombongan: { utama: "Jatim Bus 2", pergi: "Jatim Bus 1" },
    titikTurun: { utama: "Surabaya", pergi: "Malang" },
    pembayaran: { paid: 800000, total: 1200000 },
    status: "Kurang",
  },
  {
    id: "3",
    name: "Abdullah Hakim",
    nis: "2024003",
    kamar: "Al-Amin 1",
    rombongan: { utama: "Jabar Bus 1" },
    titikTurun: { utama: "Bandung" },
    pembayaran: { paid: 0, total: 900000 },
    status: "Belum",
  },
  {
    id: "4",
    name: "Umar Faruq",
    nis: "2024004",
    kamar: "Al-Amin 2",
    rombongan: { utama: "Jateng Bus 2" },
    titikTurun: { utama: "Solo" },
    pembayaran: { paid: 950000, total: 950000 },
    status: "Lunas",
  },
  {
    id: "5",
    name: "Hasan Basri",
    nis: "2024005",
    kamar: "Al-Fatih 3",
    rombongan: { utama: "Jatim Bus 1" },
    titikTurun: { utama: "Malang" },
    pembayaran: { paid: 1100000, total: 1100000 },
    status: "Lunas",
  },
  {
    id: "6",
    name: "Salman Al-Farisi",
    nis: "2024006",
    kamar: "Al-Amin 3",
    rombongan: { utama: "Jabar Bus 2", pergi: "Jateng Bus 1" },
    titikTurun: { utama: "Cirebon", pergi: "Tegal" },
    pembayaran: { paid: 500000, total: 1050000 },
    status: "Kurang",
  },
];

// util
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("Rp", "Rp ");
}

function statusBadgeVariant(status: PaymentStatus) {
  // shadcn Badge default variants: default | secondary | destructive | outline
  // biar mirip screenshot: Lunas=secondary, Kurang=outline, Belum=destructive
  if (status === "Lunas") return "secondary";
  if (status === "Belum") return "destructive";
  return "outline";
}

export function SantriTableCard() {
  const pageSize = 6;
  const [page, setPage] = React.useState(1);

  const total = DATA.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const clampedPage = Math.min(Math.max(page, 1), totalPages);
  React.useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPage]);

  const start = (clampedPage - 1) * pageSize;
  const endExclusive = Math.min(start + pageSize, total);
  const pageRows = DATA.slice(start, endExclusive);

  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = endExclusive;

  // tombol pagination: tampilkan max 3 halaman seperti contoh
  const pagesToShow = (() => {
    const arr: number[] = [];
    const from = Math.max(1, clampedPage - 1);
    const to = Math.min(totalPages, from + 2);
    for (let p = Math.max(1, to - 2); p <= to; p++) arr.push(p);
    return arr;
  })();

  return (
    <Card className="w-full">
      <CardHeader className="pb-0" />

      <CardContent className="pt-0">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Santri</TableHead>
                <TableHead className="w-[160px]">Kamar</TableHead>
                <TableHead className="w-[220px]">Rombongan</TableHead>
                <TableHead className="w-[220px]">Titik Turun</TableHead>
                <TableHead className="w-[190px] text-right">
                  Pembayaran
                </TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.id}>
                  {/* Santri */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{initials(r.name)}</AvatarFallback>
                      </Avatar>

                      <div className="leading-tight">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-sm opacity-70">{r.nis}</div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Kamar */}
                  <TableCell className="opacity-80">{r.kamar}</TableCell>

                  {/* Rombongan */}
                  <TableCell>
                    <div className="leading-tight">
                      <div className="font-medium">{r.rombongan.utama}</div>
                      {r.rombongan.pergi ? (
                        <div className="text-sm opacity-70">
                          Pergi: {r.rombongan.pergi}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Titik turun */}
                  <TableCell>
                    <div className="leading-tight">
                      <div className="font-medium">{r.titikTurun.utama}</div>
                      {r.titikTurun.pergi ? (
                        <div className="text-sm opacity-70">
                          Pergi: {r.titikTurun.pergi}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Pembayaran */}
                  <TableCell className="text-right">
                    <div className="leading-tight">
                      <div className="font-medium">
                        {rupiah(r.pembayaran.paid)}
                      </div>
                      <div className="text-sm opacity-70">
                        dari {rupiah(r.pembayaran.total)}
                      </div>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {r.status}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Aksi"
                          className="h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Detail</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}

              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center opacity-70"
                  >
                    Data tidak tersedia.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm opacity-70">
          Menampilkan {showingFrom}-{showingTo} dari {total} santri
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={clampedPage === 1}
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pagesToShow.map((p) => (
            <Button
              key={p}
              variant={p === clampedPage ? "default" : "outline"}
              size="icon"
              onClick={() => setPage(p)}
              aria-label={`Halaman ${p}`}
            >
              {p}
            </Button>
          ))}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={clampedPage === totalPages}
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
