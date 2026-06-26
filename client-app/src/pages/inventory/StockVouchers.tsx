import { useState } from "react";
import { fmtDate } from "@/utils/dateUtils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, ArrowUpCircle, Trash2, Search, Eye } from "lucide-react";

type VoucherItem = { productId: number; productName: string; quantity: string; unitCost: string; totalCost: string; };

export default function StockVouchers({ initialTab = "receipt" }: { initialTab?: "receipt" | "issue" }) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"receipt" | "issue">(initialTab);
  const { data: vouchers = [], isLoading } = trpc.stockVouchers.list.useQuery({ type: activeTab });
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const { data: branches = [] } = trpc.branches.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  const createMutation = trpc.stockVouchers.create.useMutation({
    onSuccess: () => {
      utils.stockVouchers.list.invalidate();
      toast.success(`تم إنشاء سند ${activeTab === "receipt" ? "التوريد" : "الصرف"} بنجاح`);
      setShowDialog(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState<any>(null);
  const [searchProduct, setSearchProduct] = useState("");
  const [form, setForm] = useState({
    warehouseId: "", branchId: "", supplierId: "", reason: "", notes: "",
  });
  const [items, setItems] = useState<VoucherItem[]>([]);

  const resetForm = () => {
    setForm({ warehouseId: "", branchId: "", supplierId: "", reason: "", notes: "" });
    setItems([]);
    setSearchProduct("");
  };

  const filteredProducts = (products as any[]).filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    (p.barcode ?? "").includes(searchProduct)
  );

  const addItem = (product: any) => {
    if (items.find(i => i.productId === product.id)) {
      toast.info("الصنف موجود بالفعل في القائمة");
      return;
    }
    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: "1",
      unitCost: product.costPrice ?? "0",
      totalCost: product.costPrice ?? "0",
    }]);
  };

  const updateItem = (idx: number, field: keyof VoucherItem, value: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unitCost") {
        updated.totalCost = (Number(updated.quantity) * Number(updated.unitCost)).toFixed(3);
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalCost = items.reduce((s, i) => s + Number(i.totalCost), 0);

  const handleSubmit = () => {
    if (!form.warehouseId) return toast.error("اختر المخزن");
    if (!form.branchId) return toast.error("اختر الفرع");
    if (items.length === 0) return toast.error("أضف صنفاً واحداً على الأقل");
    createMutation.mutate({
      type: activeTab,
      warehouseId: Number(form.warehouseId),
      branchId: Number(form.branchId),
      supplierId: form.supplierId ? Number(form.supplierId) : undefined,
      reason: form.reason || undefined,
      notes: form.notes || undefined,
      items,
    });
  };

  const statusColor = (type: string) => type === "receipt"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
    : "bg-red-500/10 text-red-600 border-red-500/20";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">سندات المخزن</h2>
        </div>
        <Button onClick={() => setShowDialog(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          سند جديد
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="receipt" className="gap-2">
            <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
            سند توريد
          </TabsTrigger>
          <TabsTrigger value="issue" className="gap-2">
            <ArrowUpCircle className="w-4 h-4 text-red-500" />
            سند صرف
          </TabsTrigger>
        </TabsList>

        {(["receipt", "issue"] as const).map(tab => (
          <TabsContent key={tab} value={tab}>
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-right">رقم السند</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المخزن</TableHead>
                    <TableHead className="text-right">إجمالي التكلفة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}</TableRow>
                    ))
                  ) : vouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        {tab === "receipt" ? <ArrowDownCircle className="w-10 h-10 mx-auto mb-2 opacity-20" /> : <ArrowUpCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />}
                        لا توجد سندات {tab === "receipt" ? "توريد" : "صرف"} بعد
                      </TableCell>
                    </TableRow>
                  ) : (
                    (vouchers as any[]).map((v: any) => (
                      <TableRow key={v.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-sm font-medium">{v.voucherNumber}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(v.type)}`}>
                            {v.type === "receipt" ? "توريد" : "صرف"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {(warehouses as any[]).find(w => w.id === v.warehouseId)?.name ?? `#${v.warehouseId}`}
                        </TableCell>
                        <TableCell className="font-mono font-bold">{Number(v.totalCost).toFixed(3)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmtDate(v.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowDetails(v)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Dialog إنشاء سند */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeTab === "receipt"
                ? <><ArrowDownCircle className="w-5 h-5 text-emerald-500" />سند توريد جديد</>
                : <><ArrowUpCircle className="w-5 h-5 text-red-500" />سند صرف جديد</>
              }
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* بيانات السند */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المخزن *</Label>
                <Select value={form.warehouseId} onValueChange={v => setForm(p => ({ ...p, warehouseId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                  <SelectContent>{(warehouses as any[]).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الفرع *</Label>
                <Select value={form.branchId} onValueChange={v => setForm(p => ({ ...p, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>{(branches as any[]).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {activeTab === "receipt" && (
                <div className="space-y-1.5">
                  <Label>المورد</Label>
                  <Select value={form.supplierId} onValueChange={v => setForm(p => ({ ...p, supplierId: v }))}>
                    <SelectTrigger><SelectValue placeholder="اختر المورد (اختياري)" /></SelectTrigger>
                    <SelectContent>{(suppliers as any[]).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>السبب</Label>
                <Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="سبب السند" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>ملاحظات</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="ملاحظات إضافية" />
              </div>
            </div>

            {/* بحث وإضافة أصناف */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <Label className="font-semibold">إضافة أصناف</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  placeholder="ابحث بالاسم أو الباركود..."
                  className="pr-9"
                />
              </div>
              {searchProduct && (
                <div className="border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((p: any) => (
                    <button key={p.id} onClick={() => { addItem(p); setSearchProduct(""); }}
                      className="w-full text-right px-3 py-2 hover:bg-accent/50 flex items-center justify-between text-sm transition-colors">
                      <span>{p.name}</span>
                      <span className="text-muted-foreground font-mono">{p.barcode ?? ""}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && <p className="text-center py-3 text-muted-foreground text-sm">لا توجد نتائج</p>}
                </div>
              )}
            </div>

            {/* جدول الأصناف المضافة */}
            {items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right w-24">الكمية</TableHead>
                      <TableHead className="text-right w-28">سعر الوحدة</TableHead>
                      <TableHead className="text-right w-28">الإجمالي</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                        <TableCell>
                          <Input type="number" min="0.001" step="0.001" value={item.quantity}
                            onChange={e => updateItem(idx, "quantity", e.target.value)}
                            className="h-8 w-20 text-center font-mono text-sm" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.001" value={item.unitCost}
                            onChange={e => updateItem(idx, "unitCost", e.target.value)}
                            className="h-8 w-24 text-center font-mono text-sm" />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-sm">{Number(item.totalCost).toFixed(3)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-3 bg-muted/20 border-t border-border flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{items.length} صنف</span>
                  <span className="font-bold text-lg">{totalCost.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || items.length === 0}>
              {createMutation.isPending ? "جاري الحفظ..." : `حفظ سند ${activeTab === "receipt" ? "التوريد" : "الصرف"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
