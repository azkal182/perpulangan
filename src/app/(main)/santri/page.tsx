import { SantriToolbarClient } from "@/features/santri/components/SantriToolbar.client";
import { SantriTableCard } from "@/features/santri/components/SantriTableCard";
import { getStudentsLastSync } from "@/features/santri/services/synclog.db";

export default async function SantriPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = await searchParams;

  const page = Number(params?.page ?? "1") || 1;

  const sync = await getStudentsLastSync();

  return (
    <div className="w-full space-y-4">
      <SantriToolbarClient
        lastSyncAt={sync.lastSyncAt?.toISOString() ?? null}
        lastStatus={sync.lastStatus}
      />
      <SantriTableCard page={page} pageSize={6} basePath="/santri" />
    </div>
  );
}
