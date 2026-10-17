import { SantriToolbarClient } from "@/features/santri/components/SantriToolbar.client";
import { SantriTableCard } from "@/features/santri/components/SantriTableCard";
import { getStudentsLastSync } from "@/features/santri/services/synclog.db";
import { getMissingCityCount, getUnlinkedKordaCount } from "@/features/santri/services/students.db";
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
    missingCity?: string;
    unlinkedKorda?: string;
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
  const missingCity = params?.missingCity === "true";
  const unlinkedKorda = params?.unlinkedKorda === "true";

  const rawPageSize = Number(params?.perPage ?? params?.pageSize ?? "10");
  const pageSizeOptions = new Set([10, 20, 50]);
  const pageSize = pageSizeOptions.has(rawPageSize) ? rawPageSize : 10;

  const [sync, missingCityCount, unlinkedKordaCount] = await Promise.all([
    getStudentsLastSync(),
    getMissingCityCount(),
    getUnlinkedKordaCount(),
  ]);

  return (
    <div className="w-full space-y-4">
      {(missingCityCount > 0 || unlinkedKordaCount > 0) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Data wilayah perlu ditinjau: <strong>{missingCityCount}</strong> santri belum memiliki kota/kabupaten, dan <strong>{unlinkedKordaCount}</strong> santri memiliki kota/kabupaten yang belum terhubung ke Korda. Admin dapat memperbaikinya melalui aksi Update Regional.
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
        missingCityCount={missingCityCount}
        unlinkedKordaCount={unlinkedKordaCount}
        initialMissingCity={missingCity}
        initialUnlinkedKorda={unlinkedKorda}
      />

      <SantriTableCard
        page={page}
        pageSize={pageSize}
        basePath="/santri"
        query={q}
        status={status}
        korwilId={korwilId}
        kordaId={effectiveKordaId}
        missingCity={missingCity}
        unlinkedKorda={unlinkedKorda}
      />
    </div>
  );
}
