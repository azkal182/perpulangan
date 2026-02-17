"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PrintDialog } from "./PrintDialog";

interface PrintButtonProps {
  eventId: string;
  kordas: Array<{ id: string; name: string }>;
  dropPoints: Array<{ id: string; name: string }>;
}

export function PrintButton({ eventId, kordas, dropPoints }: PrintButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="default">
        <Printer className="mr-2 h-4 w-4" />
        Cetak Kartu & Tiket
      </Button>

      <PrintDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
        kordas={kordas}
        dropPoints={dropPoints}
      />
    </>
  );
}
