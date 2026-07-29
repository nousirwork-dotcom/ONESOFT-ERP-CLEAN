import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/core/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { toast } from "sonner";
import { Plus, Ruler, Edit, Trash2 } from "lucide-react";
import { FoundationPolicyPanel } from "@/shared/components/FoundationPolicyPanel";
import type { RecordPolicy } from "@/shared/components/FoundationPolicyPanel";

export default function Units() {
  const utils = trpc.useUtils();
  const { data: units = [], isLoading } = trpc.units.list.useQuery();
  const createMutation = trpc.units.create.useMutation({
    onSuccess: () => { utils.units.list.invalidate(); toast.success("تم إضافة الوحدة"); setShowDialog(false); setForm({ name: "", symbol: "", recordPolicy: "flexible", foundationKey: "", includeInFoundation: false }); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.units.update.useMutation({
    onSuccess: () => { utils.units.list.invalidate(); toast.success("تم تحديث الوحدة"); setShowDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.units.delete.useMutation({
    onSuccess: () => { utils.units.list.invalidate(); toast.success("تم حذف الوحدة"); },
    onError: (e) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", symbol: "",
    recordPolicy: "flexible" as RecordPolicy,
    foundationKey: "",
    includeInFoundation: false,
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: "", symbol: "", recordPolicy: "flexible", foundationKey: "", includeInFoundation: false });
    setShowDialog(true);
  };
  const openEdit = (u: any) => {
    setEditItem(u);
    setForm({
      name: u.name, symbol: u.symbol ?? "",
      recordPolicy: (u.recordPolicy as RecordPolicy) ?? "flexible",
      foundationKey: u.foundationKey ?? "",
      includeInFoundation: u.includeInFoundation ?? false,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("اسم الوحدة مطلوب");
    const foundationFields = {
      recordPolicy: form.recordPolicy,
      includeInFoundation: form.includeInFoundation,
      foundationKey: form.foundationKey || undefined,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, name: form.name, symbol: form.symbol || undefined, ...foundationFields });
    } else {
      createMutation.mutate({ name: form.name, symbol: form.symbol || undefined, ...foundationFields });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">وحدات الأصناف</h2>
          <Badge variant="secondary">{units.length} وحدة</Badge>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة وحدة
        </Button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">اسم الوحدة</TableHead>
              <TableHead className="text-right">الرمز</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <Ruler className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  لا توجد وحدات بعد
                </TableCell>
              </TableRow>
            ) : (
              units.map((u: any, i: number) => (
                <TableRow key={u.id} className="hover:bg-muted/20">
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>
                    {u.symbol ? <Badge variant="outline">{u.symbol}</Badge> : <span className="text-muted-foreground text-sm">-</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: u.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editItem ? "تعديل الوحدة" : "إضافة وحدة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم الوحدة *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: كيلوغرام" />
            </div>
            <div className="space-y-1.5">
              <Label>الرمز</Label>
              <Input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} placeholder="مثال: كغ" />
            </div>
            <FoundationPolicyPanel
              recordPolicy={form.recordPolicy}
              foundationKey={form.foundationKey || null}
              includeInFoundation={form.includeInFoundation}
              onChange={(policy, include) => setForm(p => ({ ...p, recordPolicy: policy, includeInFoundation: include }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
