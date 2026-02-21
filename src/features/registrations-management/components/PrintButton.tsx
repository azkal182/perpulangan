import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button asChild variant="default">
      <Link href="/cetak-dokumen">
        <Printer className="mr-2 h-4 w-4" />
        Cetak Kartu & Tiket
      </Link>
    </Button>
  );
}
