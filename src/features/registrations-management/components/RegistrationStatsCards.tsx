import { Card, CardContent } from "@/components/ui/card";
import type { JourneyParticipantStats, RegistrationStats } from "../repositories/registrations.repository";

interface RegistrationStatsCardsProps {
  stats: RegistrationStats | null;
}

export function RegistrationStatsCards({ stats }: RegistrationStatsCardsProps) {
  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      <DirectionSummaryCards title="Peserta Pulang" color="text-blue-600" stats={stats.outbound} />
      <DirectionSummaryCards title="Peserta Kembali" color="text-green-600" stats={stats.return} />
      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Jumlah ini hanya untuk event terpilih. Peserta dengan kedua perjalanan tercatat pada kedua kartu.
      </p>
    </div>
  );
}

function DirectionSummaryCards({
  title,
  color,
  stats,
}: {
  title: string;
  color: string;
  stats: JourneyParticipantStats;
}) {
  const details = [
    ["Peserta terdaftar", stats.total, color, "border-t-blue-500"],
    ["Lunas", stats.paid, "text-emerald-700", "border-t-emerald-500"],
    ["Partial / bayar sebagian", stats.partial, "text-amber-700", "border-t-amber-500"],
    ["Belum bayar", stats.unpaid, "text-red-700", "border-t-red-500"],
    ["Tarif belum tersedia", stats.unknownTariff, "text-muted-foreground", "border-t-slate-400"],
    ["Dibatalkan", stats.cancelled, "text-muted-foreground", "border-t-slate-400"],
  ] as const;

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b pb-2">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <span className="text-xs text-muted-foreground">Event terpilih</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {details.map(([label, count, countColor, borderColor]) => (
          <Card key={label} className={`h-full border-t-2 ${borderColor} shadow-sm transition-shadow hover:shadow-md`}>
            <CardContent className="flex min-h-24 flex-col justify-between gap-3 p-4">
              <div className="text-xs leading-5 text-muted-foreground">{label}</div>
              <div className={`text-2xl font-semibold tabular-nums ${countColor}`}>{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
