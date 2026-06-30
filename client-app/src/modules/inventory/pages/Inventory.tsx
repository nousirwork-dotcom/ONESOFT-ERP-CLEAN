import { Badge } from "@/core/ui/badge";
import { Card, CardContent } from "@/core/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import { PackageSearch } from "lucide-react";
import { useState } from "react";

export default function Inventory() {
  const [warehouseId, setWarehouseId] = useState<string>("");
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: stock, isLoading } = trpc.products.stockByWarehouse.useQuery(
    { warehouseId: Number(warehouseId) },
    { enabled: !!warehouseId }
  );

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(Number(val));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">الجرد</h1>
        <p className="text-muted-foreground text-sm mt-0.5">عرض مخزون الأصناف في كل مخزن</p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="اختر مخزنًا لعرض الجرد" />
          </SelectTrigger>
          <SelectContent>
            {warehouses?.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stock && <span className="text-sm text-muted-foreground">{stock.length} صنف</span>}
      </div>

      {warehouseId ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">الكمية المتاحة</TableHead>
                  <TableHead className="text-right">الكمية المحجوزة</TableHead>
                  <TableHead className="text-right">الحد الأدنى</TableHead>
                  <TableHead className="text-right">سعر البيع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : stock?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <PackageSearch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>لا توجد أصناف في هذا المخزن</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  stock?.map((s) => {
                    const available = Number(s.quantity) - Number(s.reservedQuantity ?? 0);
                    const isLow = available <= Number(s.minStock ?? 0);
                    return (
                      <TableRow key={`${s.productId}-${s.warehouseId}`} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{s.productName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.barcode ?? "—"}</TableCell>
                        <TableCell className={`font-bold ${isLow ? "text-red-600" : "text-emerald-600"}`}>{available}</TableCell>
                        <TableCell className="text-amber-600">{s.reservedQuantity ?? 0}</TableCell>
                        <TableCell>{s.minStock ?? 0}</TableCell>
                        <TableCell>{formatCurrency(s.salePrice)}</TableCell>
                        <TableCell>
                          {isLow ? (
                            <Badge variant="destructive" className="text-xs">مخزون منخفض</Badge>
                          ) : (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">متوفر</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <PackageSearch className="w-12 h-12 mb-3 opacity-20" />
          <p>اختر مخزنًا لعرض الجرد</p>
        </div>
      )}
    </div>
  );
}
