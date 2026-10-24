type EventScopeBannerProps = {
  eventName?: string;
  status?: "DRAFT" | "ACTIVE" | "COMPLETED" | null;
};

const statusLabel = {
  DRAFT: "draf",
  ACTIVE: "aktif",
  COMPLETED: "selesai",
} as const;

export function EventScopeBanner({ eventName, status }: EventScopeBannerProps) {
  if (!eventName) {
    return (
      <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <strong>Tidak ada event terpilih.</strong> Pilih event dari pemilih di header untuk melihat data event.
      </div>
    );
  }

  return (
    <div role="status" className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
      <strong className="text-foreground">Cakupan halaman:</strong> event {eventName}. Data dan transaksi mengikuti event serta cakupan wilayah Anda.
      {status && <span className="ml-1">Status event: {statusLabel[status]}.</span>}
      {status && status !== "ACTIVE" && <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">Halaman ini dalam mode baca-saja.</span>}
    </div>
  );
}
