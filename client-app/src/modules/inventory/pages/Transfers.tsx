import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import { Textarea } from "@/core/ui/textarea";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { ArrowLeftRight, Check, Eye, Minus, Package, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TransferItem = { productId: number; productName: string; quantity: string };

const statusConfig = {
  pending: { label: "معلق", className: "status-pending" },
  approved: { label: "موافق عليه", className: "status-approved" },
  rejected: { label: "مرفوض", className: "status-rejected" },
};

export default function Transfers() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({ fromWarehouseId: "", toWarehouseId: "", notes: "" });
  const [items, setItems] = useState<TransferItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const utils = trpc.useUtils();

  const statusFilter = tab === "all" ? undefined : (tab as "pending" | "approved" | "rejected");
  const { data: transfers, isLoading } = trpc.transfers.list.useQuery({ status: statusFilter });
  const { data: detail } = trpc.transfers.get.useQuery({ id: selectedId! }, { enabled: !!selectedId && isDetailOpen });
  const { data: warehouses } = trpc.warehouses.list.useQuery();
  const { data: products } = trpc.products.list.useQuery({ search: productSearch || undefined });

  const create = trpc.transfers.create.useMutation({
    onSuccess: () => { utils.transfers.list.invalidate(); toast.success("تم إنشاء طلب التحويل"); setIsCreateOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const approve = trpc.transfers.approve.useMutation({
    onSuccess: () => { utils.transfers.list.invalidate(); utils.transfers.get.invalidate({ id: selectedId! }); toast.success("تمت الموافقة على التحويل"); setIsDetailOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.transfers.reject.useMutation({
    onSuccess: () => { utils.transfers.list.invalidate(); toast.success("تم رفض التحويل"); setIsRejectOpen(false); setIsDetailOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => { setForm({ fromWarehouseId: "", toWarehouseId: "", notes: "" }); setItems([]); };

  const addItem = (product: any) => {
    if (items.find((i) => i.productId === product.id)) { toast.error("الصنف موجود بالفعل"); return; }
    setItems([...items, { productId: product.id, productName: product.name, quantity: "1" }]);
    setProductSearch("");
  };

  const updateItemQty = (idx: number, delta: number) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, Number(item.quantity) + delta);
      return { ...item, quantity: String(newQty) };
    }));
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreate = () => {
    if (!form.fromWarehouseId || !form.toWarehouseId) { toast.error("يجب اختيار المخزنين"); return; }
    if (form.fromWarehouseId === form.toWarehouseId) { toast.error("لا يمكن التحويل لنفس المخزن"); return; }
    if (items.length === 0) { toast.error("أضف أصنافًا للتحويل"); return; }
    create.mutate({ fromWarehouseId: Number(form.fromWarehouseId), toWarehouseId: Number(form.toWarehouseId), items, notes: form.notes || undefined });
  };

  const canApprove = user?.role === "admin" || user?.role === "warehouse_manager";

  const getWarehouseName = (id: number) => warehouses?.find((w) => w.id === id)?.name ?? `مخزن ${id}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">التحويلات بين المخازن</h1><p className="text-muted-foreground text-sm mt-0.5">إدارة حركة المخزون بين الفروع</p></div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2"><Plus className="w-4 h-4" />طلب تحويل</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="pending">معلق</TabsTrigger>
          <TabsTrigger value="approved">موافق عليه</TabsTrigger>
          <TabsTrigger value="rejected">مرفوض</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-right">رقم التحويل</TableHead>
                    <TableHead className="text-right">من مخزن</TableHead>
                    <TableHead className="text-right">إلى مخزن</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right w-24">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>))}</TableRow>
                    ))
                  ) : transfers?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>لا توجد تحويلات</p></TableCell></TableRow>
                  ) : (
                    transfers?.map((t) => {
                      const sc = statusConfig[t.status as keyof typeof statusConfig];
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-medium">{t.transferNumber}</TableCell>
                          <TableCell>{getWarehouseName(t.fromWarehouseId)}</TableCell>
                          <TableCell>{getWarehouseName(t.toWarehouseId)}</TableCell>
                          <TableCell><span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc?.className}`}>{sc?.label}</span></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{fmtDate(t.requestedAt ?? t.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedId(t.id); setIsDetailOpen(true); }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              {canApprove && t.status === "pending" && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={() => { setSelectedId(t.id); approve.mutate({ id: t.id }); }}>
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setSelectedId(t.id); setIsRejectOpen(true); }}>
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Transfer Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>طلب تحويل مخزن</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>من مخزن *</Label>
                <Select value={form.fromWarehouseId} onValueChange={(v) => setForm({ ...form, fromWarehouseId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر المخزن المصدر" /></SelectTrigger>
                  <SelectContent>{warehouses?.map((w) => (<SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>إلى مخزن *</Label>
                <Select value={form.toWarehouseId} onValueChange={(v) => setForm({ ...form, toWarehouseId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر المخزن الهدف" /></SelectTrigger>
                  <SelectContent>{warehouses?.filter((w) => String(w.id) !== form.fromWarehouseId).map((w) => (<SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Add Products */}
            <div>
              <Label>إضافة أصناف</Label>
              <div className="relative mt-1">
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="ابحث عن صنف للإضافة..." />
                {productSearch && products && products.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {products.slice(0, 8).map((p) => (
                      <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-sm text-right">
                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="text-muted-foreground text-xs">{p.barcode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items List */}
            {items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead className="text-right text-xs">الصنف</TableHead>
                      <TableHead className="text-right text-xs">الكمية</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateItemQty(idx, -1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-secondary"><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                            <button onClick={() => updateItemQty(idx, 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-secondary"><Plus className="w-3 h-3" /></button>
                          </div>
                        </TableCell>
                        <TableCell><button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات اختيارية..." className="mt-1 resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={create.isPending}>إرسال طلب التحويل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>تفاصيل التحويل</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">رقم التحويل</p><p className="font-mono font-medium">{detail.transferNumber}</p></div>
                <div><p className="text-muted-foreground text-xs">الحالة</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusConfig[detail.status as keyof typeof statusConfig]?.className}`}>
                    {statusConfig[detail.status as keyof typeof statusConfig]?.label}
                  </span>
                </div>
                <div><p className="text-muted-foreground text-xs">من مخزن</p><p className="font-medium">{getWarehouseName(detail.fromWarehouseId)}</p></div>
                <div><p className="text-muted-foreground text-xs">إلى مخزن</p><p className="font-medium">{getWarehouseName(detail.toWarehouseId)}</p></div>
              </div>
              {detail.notes && <div className="bg-muted/30 rounded-lg p-3 text-sm"><p className="text-muted-foreground text-xs mb-1">ملاحظات</p><p>{detail.notes}</p></div>}
              {detail.rejectionReason && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm"><p className="text-red-600 text-xs mb-1">سبب الرفض</p><p className="text-red-700">{detail.rejectionReason}</p></div>}
              <div>
                <p className="text-sm font-medium mb-2">الأصناف</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent bg-muted/30"><TableHead className="text-right text-xs">الصنف</TableHead><TableHead className="text-right text-xs">الكمية</TableHead></TableRow></TableHeader>
                    <TableBody>{detail.items?.map((item: any) => (<TableRow key={item.id}><TableCell className="text-sm">{item.productName}</TableCell><TableCell className="font-bold">{item.quantity}</TableCell></TableRow>))}</TableBody>
                  </Table>
                </div>
              </div>
              {canApprove && detail.status === "pending" && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => approve.mutate({ id: detail.id })} disabled={approve.isPending}>
                    <Check className="w-4 h-4" />موافقة
                  </Button>
                  <Button variant="destructive" className="flex-1 gap-2" onClick={() => setIsRejectOpen(true)}>
                    <X className="w-4 h-4" />رفض
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>رفض التحويل</DialogTitle></DialogHeader>
          <div>
            <Label>سبب الرفض *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="اذكر سبب الرفض..." className="mt-1 resize-none" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => { if (!rejectReason.trim()) { toast.error("سبب الرفض مطلوب"); return; } reject.mutate({ id: selectedId!, reason: rejectReason }); }} disabled={reject.isPending}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
