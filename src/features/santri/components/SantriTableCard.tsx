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
import { SantriPageSizeSelect } from "@/features/santri/components/SantriPageSizeSelect.client";

type StudentStatus = "Aktif" | "Non Aktif";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function statusBadgeVariant(status: StudentStatus) {
  if (status === "Aktif") return "secondary";
  if (status === "Non Aktif") return "destructive";
  return "outline";
}

// Contoh mapping demo saja (kamu bebas ubah)
function mapStudentStatusToPaymentStatus(status: boolean): StudentStatus {
  return status ? "Aktif" : "Non Aktif";
}

export async function SantriTableCard({
  page = 1,
  pageSize = 10,
  basePath = "/santri",
  query = "",
  status = "all",
  korwilId = "all",
  kordaId = "all",
}: {
  page?: number;
  pageSize?: number;
  basePath?: string;
  query?: string;
  status?: string; // "all" | "active" | "inactive"
  korwilId?: string;
  kordaId?: string;
}) {
  const effectiveKordaId = korwilId === "all" ? "all" : (kordaId ?? "all");
  const { total, students } = await getStudentsPage(
    page,
    pageSize,
    query,
    status,
    korwilId,
    effectiveKordaId,
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 1), totalPages);

  const showingFrom = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const showingTo = Math.min(clampedPage * pageSize, total);

  const pagesToShow = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: Array<number | "ellipsis"> = [];
    const start = Math.max(2, clampedPage - 1);
    const end = Math.min(totalPages - 1, clampedPage + 1);

    items.push(1);
    if (start > 2) items.push("ellipsis");

    for (let p = start; p <= end; p++) items.push(p);

    if (end < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);

    return items;
  })();

  const hrefPage = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("perPage", String(pageSize));
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    if (korwilId && korwilId !== "all") params.set("korwilId", korwilId);
    if (effectiveKordaId && effectiveKordaId !== "all") {
      params.set("kordaId", effectiveKordaId);
    }
    return `${basePath}?${params.toString()}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-0" />

      <CardContent className="pt-0">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Santri</TableHead>
                <TableHead className="w-[320px]">P/L</TableHead>
                <TableHead className="w-[160px]">Kamar</TableHead>
                <TableHead className="w-[220px]">Korwil</TableHead>
                <TableHead className="w-[220px]">Korda</TableHead>
                <TableHead className="w-[220px]">Kota</TableHead>

                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[56px]" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {students.map((s) => {
                // s.status boolean
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

                    <TableCell className="opacity-80">
                      {s.gender.toLowerCase() === "laki-laki" ? "L" : "P"}
                    </TableCell>
                    <TableCell className="opacity-80">{s.dormitory}</TableCell>

                    <TableCell className="opacity-70">
                      {s.regency?.korda?.korwil?.name ?? "-"}
                    </TableCell>

                    <TableCell className="opacity-70">
                      {s.regency?.korda?.name ?? "-"}
                    </TableCell>
                    <TableCell className="opacity-70">
                      {s.regency?.name ?? "-"}
                    </TableCell>

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

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="flex items-center gap-2 text-sm">
            <span className="opacity-70">Show</span>
            <SantriPageSizeSelect pageSize={pageSize} />
            <span className="opacity-70">per halaman</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="icon"
              disabled={clampedPage === 1}
              aria-label="Sebelumnya"
            >
              <Link
                href={hrefPage(Math.max(1, clampedPage - 1))}
                scroll={false}
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>

            {pagesToShow.map((p, idx) =>
              p === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-sm text-muted-foreground"
                >
                  ...
                </span>
              ) : (
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
              ),
            )}

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
        </div>
      </CardFooter>
    </Card>
  );
}
