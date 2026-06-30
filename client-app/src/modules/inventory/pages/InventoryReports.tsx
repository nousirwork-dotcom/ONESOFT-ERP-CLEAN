import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/core/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { BarChart3, Package, AlertTriangle, TrendingDown, Warehouse } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export default function InventoryReports() {
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const { data: stockReport = [] } = trpc.reports.stockByWarehouse.useQuery({
    warehouseId: warehouseId !== "all" ? Number(warehouseId) : undefined,
  });
  const { data: voucherReport = [] } = trpc.reports.voucherSummary.useQuery();
  const { data: lowStock = [] } = trpc.reports.lowStockAlert.useQuery();

  const totalValue = (stockReport as any[]).reduce((s, r) => s + Number(r.totalValue ?? 0), 0);
  const totalItems = (stockReport as any[]).reduce((s, r) => s + Number(r.totalQuantity ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">تقارير المخزون والأصناف</h2>
        </div>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="كل المخازن" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المخازن</SelectItem>
            {(warehouses as any[]).map(w => (
              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الأصناف</p>
          <p className="text-2xl font-bold">{(stockReport as any[]).length}</p>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1">إجمالي الكميات</p>
          <p className="text-2xl font-bold">{totalItems.toFixed(0)}</p>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1">قيمة المخزون</p>
          <p className="text-2xl font-bold">{totalValue.toFixed(2)}</p>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card bg-red-500/5 border-red-500/20">
          <p className="text-xs text-red-500 mb-1">أصناف منخفضة</p>
          <p className="text-2xl font-bold text-red-500">{(lowStock as any[]).length}</p>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock" className="gap-2"><Package className="w-4 h-4" />تقرير المخزون</TabsTrigger>
          <TabsTrigger value="vouchers" className="gap-2"><Warehouse className="w-4 h-4" />تقرير السندات</TabsTrigger>
          <TabsTrigger value="lowstock" className="gap-2"><AlertTriangle className="w-4 h-4" />تنبيهات النقص</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          {/* مخطط قيمة المخزون */}
          <div className="border border-border rounded-xl p-4 bg-card">
            <h3 className="font-semibold text-sm mb-4">قيمة المخزون لكل صنف (أعلى 10)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={(stockReport as any[]).slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="productName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [Number(v).toFixed(2), "القيمة"]} />
                <Bar dataKey="totalValue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-right">المخزن</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">سعر التكلفة</TableHead>
                  <TableHead className="text-right">القيمة الإجمالية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stockReport as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : (
                  (stockReport as any[]).map((r: any, i: number) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{r.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.warehouseName}</TableCell>
                      <TableCell className="font-mono">{Number(r.totalQuantity).toFixed(0)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{Number(r.costPrice ?? 0).toFixed(3)}</TableCell>
                      <TableCell className="font-mono font-bold">{Number(r.totalValue ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vouchers">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border rounded-xl p-4 bg-card">
              <h3 className="font-semibold text-sm mb-4">توزيع السندات</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={voucherReport as any[]} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, count }: any) => `${type === "receipt" ? "توريد" : "صرف"}: ${count}`}>
                    {(voucherReport as any[]).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">العدد</TableHead>
                    <TableHead className="text-right">إجمالي التكلفة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(voucherReport as any[]).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge className={r.type === "receipt" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}>
                          {r.type === "receipt" ? "توريد" : "صرف"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{r.count}</TableCell>
                      <TableCell className="font-mono font-bold">{Number(r.totalCost ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lowstock">
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-right">المخزن</TableHead>
                  <TableHead className="text-right">الكمية الحالية</TableHead>
                  <TableHead className="text-right">الحد الأدنى</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lowStock as any[]).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      لا توجد أصناف منخفضة المخزون
                    </TableCell>
                  </TableRow>
                ) : (
                  (lowStock as any[]).map((r: any, i: number) => (
                    <TableRow key={i} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{r.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.warehouseName}</TableCell>
                      <TableCell>
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 font-mono">{Number(r.quantity).toFixed(0)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{Number(r.minQuantity ?? 0).toFixed(0)}</TableCell>
                      <TableCell>
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          نقص
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
