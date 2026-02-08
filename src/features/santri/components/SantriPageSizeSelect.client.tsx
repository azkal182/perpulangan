"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZES = [6, 10, 20, 50] as const;

export function SantriPageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [value, setValue] = useState(String(pageSize));

  useEffect(() => {
    setValue(String(pageSize));
  }, [pageSize]);

  const onValueChange = (next: string) => {
    setValue(next);

    const params = new URLSearchParams(sp.toString());
    params.delete("page"); // reset page saat page size berubah
    params.set("perPage", next);

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[90px]">
        <SelectValue placeholder="Per halaman" />
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZES.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
