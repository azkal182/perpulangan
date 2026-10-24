"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error, "Application error occurred");
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Terjadi kesalahan
        </h2>
        <p className="text-muted-foreground">
          Terjadi kendala saat memuat halaman. Silakan coba lagi.
        </p>
      </div>
      <div className="flex gap-4">
        <Button onClick={() => window.location.reload()} variant="outline">
            Muat ulang halaman
        </Button>
        <Button onClick={() => reset()}>Coba lagi</Button>
      </div>
    </div>
  );
}
