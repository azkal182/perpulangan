import { SantriToolbarClient } from "@/features/santri/components/SantriToolbar.client";
import { SantriTableCard } from "@/features/santri/components/SantriTableCard";
import { getStudentsLastSync } from "@/features/santri/services/synclog.db";
import { getIncompleteRegionalCount } from "@/features/santri/services/students.db";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default async function SantriPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    status?: string;
    korwilId?: string;
    kordaId?: string;
    perPage?: string;
    pageSize?: string;
    incompleteRegional?: string;
  }>;
}) {
  const params = await searchParams;

  const page = Number(params?.page ?? "1") || 1;
  const q = (params?.q ?? "").trim();

  // URL: all | active | inactive
  const status = (params?.status ?? "all").trim();
  const korwilId = (params?.korwilId ?? "all").trim() || "all";
  const kordaId = (params?.kordaId ?? "all").trim() || "all";
  const effectiveKordaId = korwilId === "all" ? "all" : kordaId;
  const incompleteRegional = params?.incompleteRegional === "true";

  const rawPageSize = Number(params?.perPage ?? params?.pageSize ?? "10");
  const pageSizeOptions = new Set([10, 20, 50]);
  const pageSize = pageSizeOptions.has(rawPageSize) ? rawPageSize : 10;

  const [sync, incompleteCount] = await Promise.all([
    getStudentsLastSync(),
    getIncompleteRegionalCount(),
  ]);

  return (
    <div className="w-full space-y-4">
      {incompleteCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Terdapat <strong>{incompleteCount}</strong> santri yang belum memiliki data provinsi atau kabupaten/kota.
          </AlertDescription>
        </Alert>
      )}

      <SantriToolbarClient
        lastSyncAt={sync.lastSyncAt?.toISOString() ?? null}
        lastStatus={sync.lastStatus}
        initialQuery={q}
        initialStatus={status}
        initialKorwilId={korwilId}
        initialKordaId={effectiveKordaId}
        incompleteCount={incompleteCount}
        initialIncompleteRegional={incompleteRegional}
      />

      <SantriTableCard
        page={page}
        pageSize={pageSize}
        basePath="/santri"
        query={q}
        status={status}
        korwilId={korwilId}
        kordaId={effectiveKordaId}
        incompleteRegional={incompleteRegional}
      />
    </div>
  );
}
