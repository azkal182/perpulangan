type FinanceContextNoteProps = {
  mode: "event" | "global";
  eventName?: string;
};

export function FinanceContextNote({ mode, eventName }: FinanceContextNoteProps) {
  if (mode === "global") {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <strong>Keuangan pusat bersifat global.</strong> Angka di halaman ini mencakup semua event dan tidak berubah saat event pada header diganti.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
      <strong className="text-foreground">Cakupan halaman:</strong> event {eventName ?? "yang dipilih"}. Data dan transaksi mengikuti event serta cakupan wilayah Anda.
    </div>
  );
}

export function FinanceHowToRead() {
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Cara membaca angka keuangan</summary>
      <dl className="mt-3 grid gap-3 text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Tagihan bruto</dt>
          <dd>Total tarif perjalanan yang terdaftar, bukan uang yang sudah diterima.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Penerimaan tercatat</dt>
          <dd>Total pembayaran yang masuk dan tercatat, sebelum memperhitungkan refund.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Hak Korda setelah fee</dt>
          <dd>Hak pembukuan Korda setelah dikurangi fee pusat; belum tentu sudah tersedia untuk dicairkan.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Kelebihan pembayaran</dt>
          <dd>Saldo lebih dari pembayaran peserta yang masih ditahan di pusat untuk Korda tujuan.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Kas pusat</dt>
          <dd>Uang yang benar-benar tercatat masuk, dikurangi refund dan pencairan.</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Maksimal dapat dicairkan</dt>
          <dd>Batas pencairan saat ini berdasarkan hak Korda dan kas pusat yang tersedia.</dd>
        </div>
      </dl>
    </details>
  );
}
