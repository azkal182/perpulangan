import { Card, CardContent } from "@/components/ui/card";
import type { RegistrationStats } from "../repositories/registrations.repository";

interface RegistrationStatsCardsProps {
  stats: RegistrationStats | null;
}

export function RegistrationStatsCards({ stats }: RegistrationStatsCardsProps) {
  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {/* Total */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      {/* Both Journeys */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Pulang-Kembali</div>
          <div className="text-2xl font-bold text-blue-600">
            {stats.byJourneyType.both}
          </div>
        </CardContent>
      </Card>

      {/* Return Only */}
     <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Kembali Saja</div>
          <div className="text-2xl font-bold text-green-600">
            {stats.byJourneyType.returnOnly}
          </div>
        </CardContent>
      </Card>

      {/* Confirmed */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Confirmed</div>
          <div className="text-2xl font-bold text-emerald-600">
            {stats.byStatus.confirmed}
          </div>
        </CardContent>
      </Card>

      {/* Cancelled */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Cancelled</div>
          <div className="text-2xl font-bold text-red-600">
            {stats.byStatus.cancelled + stats.byStatus.partialCancel}
          </div>
        </CardContent>
      </Card>

      {/* Payment Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Sudah Bayar</div>
          <div className="text-xl font-bold text-purple-600">
            {stats.paymentStats.outboundPaidCount + stats.paymentStats.returnPaidCount}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
