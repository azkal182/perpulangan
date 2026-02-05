"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "../lib/format";

type Props = {
  memberCount: number;
  pricePerPerson: number;
  total: number;
};

export function SummaryCard({ memberCount, pricePerPerson, total }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ringkasan</CardTitle>
        <CardDescription>Perhitungan otomatis berdasarkan titik turun dan jumlah anggota.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Jumlah anggota (valid)</span>
          <Badge variant="secondary">{memberCount}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Harga / orang</span>
          <span className="font-medium">{formatRupiah(pricePerPerson)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Total</span>
          <span className="text-base font-semibold">{formatRupiah(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
