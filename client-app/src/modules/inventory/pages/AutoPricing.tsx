import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { toast } from "sonner";
import { TrendingUp, Calculator, Zap, AlertTriangle } from "lucide-react";

export default function AutoPricing() {
  const utils = trpc.useUtils();
  const { data: products = [], isLoading } = trpc.products.list.useQuery();
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const priceMutation = trpc.pricing.autoPrice.useMutation({
    onSuccess: (data) => {
      utils.products.list.invalidate();
      toast.success(`تم تحديث أسعار ${data?.updated ?? 0} صنف بنجاح`);
    },
    onError: (e) => toast.error(e.message),
  });

  const [margin, setMargin] = useState("30");
  const [warehouseId, setWarehouseId] = useState("");
  const [preview, setPreview] = useState(false);

  const handleApply = () => {
    if (!warehouseId) return toast.error("اختر المخزن أولاً");
    const m = Number(margin);
    if (isNaN(m) || m < 0 || m > 500) return toast.error("نسبة الربح يجب أن تكون بين 0 و 500");
    priceMutation.mutate({ warehouseId: Number(warehouseId), marginPercent: m });
  };

  const previewProducts = (products as any[]).filter(p => Number(p.costPrice ?? 0) > 0);
  const marginNum = Number(margin) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">تسعير الأصناف آلياً</h2>
      </div>

      {/* إعدادات التسعير */}
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            سيتم تحديث سعر البيع لجميع الأصناف التي لها سعر تكلفة بناءً على نسبة الربح المحددة.
            <strong> هذا الإجراء لا يمكن التراجع عنه.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>المخزن</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المخزن" />
              </SelectTrigger>
              <SelectContent>
                {(warehouses as any[]).map(w => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نسبة الربح (%)</Label>
            <div className="relative">
              <Input
                type="number" min="0" max="500" value={margin}
                onChange={e => setMargin(e.target.value)}
                className="pl-8"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => setPreview(!preview)} className="flex-1 gap-2">
              <Calculator className="w-4 h-4" />
              {preview ? "إخفاء المعاينة" : "معاينة"}
            </Button>
            <Button onClick={handleApply} disabled={priceMutation.isPending} className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700">
              <Zap className="w-4 h-4" />
              تطبيق
            </Button>
          </div>
        </div>
      </div>

      {/* معاينة الأسعار */}
      {preview && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="p-3 bg-muted/30 border-b border-border">
            <p className="text-sm font-medium">معاينة الأسعار الجديدة (نسبة الربح: {margin}%)</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="text-right">الصنف</TableHead>
                <TableHead className="text-right">سعر التكلفة</TableHead>
                <TableHead className="text-right">السعر الحالي</TableHead>
                <TableHead className="text-right">السعر الجديد</TableHead>
                <TableHead className="text-right">الفرق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : previewProducts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد أصناف بسعر تكلفة</TableCell></TableRow>
              ) : (
                previewProducts.map((p: any) => {
                  const cost = Number(p.costPrice);
                  const current = Number(p.salePrice);
                  const newPrice = cost * (1 + marginNum / 100);
                  const diff = newPrice - current;
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-sm">{cost.toFixed(3)}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{current.toFixed(3)}</TableCell>
                      <TableCell className="font-mono text-sm font-bold text-primary">{newPrice.toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge variant={diff > 0 ? "default" : diff < 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                          {diff > 0 ? "+" : ""}{diff.toFixed(3)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
