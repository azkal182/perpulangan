import * as React from "react";
import Link from "next/link";

import { getStudentsPage } from "@/features/santri/services/students.db";

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

// util
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function statusBadgeVariant(status: PaymentStatus) {
  if (status === "Lunas") return "secondary";
  if (status === "Belum") return "destructive";
  return "outline";
}

/**
 * Mapping status Student (string bebas) -> PaymentStatus (demo)
 * Kamu bisa sesuaikan aturan mapping sesuai kebutuhan.
 */
function mapStudentStatusToPaymentStatus(
  status: string | null | undefined,
): PaymentStatus {
  const s = (status ?? "").toLowerCase();
  if (s.includes("lunas") || s.includes("paid") || s.includes("aktif"))
    return "Lunas";
  if (s.includes("kurang") || s.includes("partial")) return "Kurang";
  return "Belum";
}

export async function SantriTableCard({
  page = 1,
  pageSize = 6,
  basePath = "/santri",
}: {
  page?: number;
  pageSize?: number;
  basePath?: string; // path halaman yg menampilkan tabel
}) {
  const { total, students } = await getStudentsPage(page, pageSize);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);

  const showingFrom = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const showingTo = Math.min(clampedPage * pageSize, total);

  const pagesToShow = (() => {
    const arr: number[] = [];
    const from = Math.max(1, clampedPage - 1);
    const to = Math.min(totalPages, from + 2);
    for (let p = Math.max(1, to - 2); p <= to; p++) arr.push(p);
    return arr;
  })();

  const hrefPage = (p: number) => `${basePath}?page=${p}`;

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
              {students.map((s) => {
                // Field yang ada di DB kamu saat ini:
                // name, nis, dormitory, status
                // Sisanya belum ada -> fallback "-"

                const paymentStatus = mapStudentStatusToPaymentStatus(s.status);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{initials(s.name)}</AvatarFallback>
                        </Avatar>

                        <div className="leading-tight">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-sm opacity-70">{s.nis}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="opacity-80">{s.dormitory}</TableCell>

                    {/* Rombongan (belum ada di schema) */}
                    <TableCell className="opacity-70">-</TableCell>

                    {/* Titik turun (belum ada di schema) */}
                    <TableCell className="opacity-70">-</TableCell>

                    {/* Pembayaran (belum ada di schema) */}
                    <TableCell className="text-right opacity-70">-</TableCell>

                    <TableCell>
                      <Badge variant={statusBadgeVariant(paymentStatus)}>
                        {paymentStatus}
                      </Badge>
                    </TableCell>

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
                );
              })}

              {students.length === 0 ? (
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
            asChild
            variant="outline"
            size="icon"
            disabled={clampedPage === 1}
            aria-label="Sebelumnya"
          >
            <Link href={hrefPage(Math.max(1, clampedPage - 1))} scroll={false}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          {pagesToShow.map((p) => (
            <Button
              key={p}
              asChild
              variant={p === clampedPage ? "default" : "outline"}
              size="icon"
              aria-label={`Halaman ${p}`}
            >
              <Link href={hrefPage(p)} scroll={false}>
                {p}
              </Link>
            </Button>
          ))}

          <Button
            asChild
            variant="outline"
            size="icon"
            disabled={clampedPage === totalPages}
            aria-label="Berikutnya"
          >
            <Link
              href={hrefPage(Math.min(totalPages, clampedPage + 1))}
              scroll={false}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
