import { TrendingUp, TrendingDown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const paymentData = [
  { name: "Lunas", value: 180, color: "hsl(142, 76%, 36%)" },
  { name: "Kurang Bayar", value: 45, color: "hsl(38, 92%, 50%)" },
  { name: "Belum Bayar", value: 20, color: "hsl(0, 84%, 60%)" },
];

const summaryData = [
  { label: "Total Tagihan", value: "Rp 245.000.000", trend: null },
  {
    label: "Sudah Diterima",
    value: "Rp 198.500.000",
    trend: { value: 12, isPositive: true },
  },
  {
    label: "Piutang",
    value: "Rp 46.500.000",
    trend: { value: 8, isPositive: false },
  },
];

export function PaymentOverview() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground mb-4">
        Ringkasan Pembayaran
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} santri`, ""]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          {summaryData.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <span className="text-sm text-muted-foreground">
                {item.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {item.value}
                </span>
                {item.trend && (
                  <span
                    className={`flex items-center text-xs ${item.trend.isPositive ? "text-success" : "text-destructive"}`}
                  >
                    {item.trend.isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
