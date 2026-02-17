import { SantriToolbarClient } from "@/features/santri/components/SantriToolbar.client";
import { SantriTableCard } from "@/features/santri/components/SantriTableCard";
import { getStudentsLastSync } from "@/features/santri/services/synclog.db";

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

  const rawPageSize = Number(params?.perPage ?? params?.pageSize ?? "10");
  const pageSizeOptions = new Set([10, 20, 50]);
  const pageSize = pageSizeOptions.has(rawPageSize) ? rawPageSize : 10;

  const sync = await getStudentsLastSync();

  return (
    <div className="w-full space-y-4">
      <SantriToolbarClient
        lastSyncAt={sync.lastSyncAt?.toISOString() ?? null}
        lastStatus={sync.lastStatus}
        initialQuery={q}
        initialStatus={status}
        initialKorwilId={korwilId}
        initialKordaId={effectiveKordaId}
      />

      <SantriTableCard
        page={page}
        pageSize={pageSize}
        basePath="/santri"
        query={q}
        status={status}
        korwilId={korwilId}
        kordaId={effectiveKordaId}
      />
    </div>
  );
}
