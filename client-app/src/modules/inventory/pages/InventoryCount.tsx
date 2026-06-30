import { useState } from "react";
import { fmtDate } from "@/shared/utils/dateUtils";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/core/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { Textarea } from "@/core/ui/textarea";
import { toast } from "sonner";
import { ClipboardList, Plus, Eye, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/core/hooks/useAuth";

export default function InventoryCount() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: counts = [], isLoading } = trpc.inventoryCount.list.useQuery();
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const { data: branches = [] } = trpc.branches.list.useQuery();

  const createMutation = trpc.inventoryCount.create.useMutation({
    onSuccess: (id) => {
      utils.inventoryCount.list.invalidate();
      toast.success("تم إنشاء جلسة الجرد");
      setShowCreate(false);
      setCreateForm({ warehouseId: "", branchId: "", notes: "" });
      // فتح تفاصيل الجرد الجديد
      if (id) openCount(id as unknown as number);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateItemMutation = trpc.inventoryCount.updateItem.useMutation({
    onSuccess: () => utils.inventoryCount.get.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const confirmMutation = trpc.inventoryCount.confirm.useMutation({
    onSuccess: () => {
      utils.inventoryCount.list.invalidate();
      utils.inventoryCount.get.invalidate();
      toast.success("تم تأكيد الجرد وتحديث المخزون");
      setActiveCount(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ warehouseId: "", branchId: "", notes: "" });

  const { data: countDetails } = trpc.inventoryCount.get.useQuery(
    { id: activeCount! },
    { enabled: !!activeCount }
  );

  const openCount = (id: number) => setActiveCount(id);

  const handleCreate = () => {
    if (!createForm.warehouseId) return toast.error("اختر المخزن");
    if (!createForm.branchId) return toast.error("اختر الفرع");
    createMutation.mutate({
      warehouseId: Number(createForm.warehouseId),
      branchId: Number(createForm.branchId),
      notes: createForm.notes || undefined,
    });
  };

  const statusBadge = (status: string) => {
    if (status === "confirmed") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle className="w-3 h-3" />مؤكد</Badge>;
    if (status === "draft") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1"><Clock className="w-3 h-3" />مسودة</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const canConfirm = user?.role === "admin" || user?.role === "warehouse_manager";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">جرد المخزون</h2>
          <Badge variant="secondary">{counts.length} جلسة</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          جلسة جرد جديدة
        </Button>
      </div>

      {/* قائمة جلسات الجرد */}
      {!activeCount && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right">رقم الجرد</TableHead>
                <TableHead className="text-right">المخزن</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>)}</TableRow>
                ))
              ) : counts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    لا توجد جلسات جرد بعد
                  </TableCell>
                </TableRow>
              ) : (
                (counts as any[]).map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm font-medium">{c.countNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(warehouses as any[]).find(w => w.id === c.warehouseId)?.name ?? `#${c.warehouseId}`}
                    </TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(c.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCount(c.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* تفاصيل جلسة الجرد */}
      {activeCount && countDetails && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setActiveCount(null)}>← رجوع</Button>
              <div>
                <h3 className="font-bold">{(countDetails as any).countNumber}</h3>
                <p className="text-sm text-muted-foreground">
                  {(warehouses as any[]).find(w => w.id === (countDetails as any).warehouseId)?.name}
                </p>
              </div>
              {statusBadge((countDetails as any).status)}
            </div>
            {canConfirm && (countDetails as any).status === "draft" && (
              <Button
                onClick={() => confirmMutation.mutate({ id: activeCount })}
                disabled={confirmMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-4 h-4" />
                تأكيد الجرد وتطبيق الفروقات
              </Button>
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-right">الكمية في النظام</TableHead>
                  <TableHead className="text-right">الكمية الفعلية</TableHead>
                  <TableHead className="text-right">الفرق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((countDetails as any).items ?? []).map((item: any) => {
                  const diff = Number(item.difference);
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{Number(item.systemQuantity).toFixed(0)}</TableCell>
                      <TableCell>
                        {(countDetails as any).status === "draft" ? (
                          <Input
                            type="number" min="0" step="0.001"
                            defaultValue={item.actualQuantity}
                            onBlur={e => {
                              if (e.target.value !== item.actualQuantity) {
                                updateItemMutation.mutate({ id: item.id, actualQuantity: e.target.value });
                              }
                            }}
                            className="h-8 w-24 font-mono text-sm"
                          />
                        ) : (
                          <span className="font-mono">{Number(item.actualQuantity).toFixed(0)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {diff === 0 ? (
                          <Badge variant="secondary" className="font-mono">0</Badge>
                        ) : (
                          <Badge
                            className={`font-mono ${diff > 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}
                          >
                            {diff > 0 ? "+" : ""}{diff.toFixed(0)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Dialog إنشاء جلسة جرد */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء جلسة جرد جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>المخزن *</Label>
              <Select value={createForm.warehouseId} onValueChange={v => setCreateForm(p => ({ ...p, warehouseId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                <SelectContent>{(warehouses as any[]).map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الفرع *</Label>
              <Select value={createForm.branchId} onValueChange={v => setCreateForm(p => ({ ...p, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{(branches as any[]).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={createForm.notes} onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="ملاحظات اختيارية" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
