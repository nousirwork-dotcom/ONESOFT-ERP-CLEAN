import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { trpc } from "@/shared/lib/trpc";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Reports() {
  const [days, setDays] = useState("30");
  const { data: chartData } = trpc.dashboard.salesChart.useQuery({ days: Number(days) });
  const { data: topProducts } = trpc.dashboard.topProducts.useQuery({ limit: 10 });
  const { data: stats } = trpc.dashboard.stats.useQuery();

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(val);

  const chartFormatted = (chartData ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
    مبيعات: Number(d.total),
  }));

  const pieData = (topProducts ?? []).slice(0, 5).map((p) => ({
    name: p.productName,
    value: Number(p.totalRevenue),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">تحليل أداء المبيعات والمخزون</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "مبيعات اليوم", value: formatCurrency(stats?.todaySales ?? 0), color: "text-indigo-600" },
          { label: "مبيعات الشهر", value: formatCurrency(stats?.monthSales ?? 0), color: "text-emerald-600" },
          { label: "فواتير اليوم", value: String(stats?.todayInvoices ?? 0), color: "text-amber-600" },
          { label: "فواتير الشهر", value: String(stats?.monthInvoices ?? 0), color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">المبيعات اليومية</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val) => [formatCurrency(Number(val)), "المبيعات"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="مبيعات" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">توزيع المبيعات حسب الصنف</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">أكثر الأصناف مبيعًا</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts?.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد بيانات مبيعات بعد</p>
            )}
            {topProducts?.map((p, i) => {
              const maxRevenue = Number(topProducts[0]?.totalRevenue ?? 1);
              const pct = (Number(p.totalRevenue) / maxRevenue) * 100;
              return (
                <div key={p.productId} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground text-center font-bold">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{p.productName}</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(Number(p.totalRevenue))}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
