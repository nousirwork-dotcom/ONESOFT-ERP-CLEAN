import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Edit, Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const EMPTY = { code: "", name: "", branchId: "", description: "" };

export default function Warehouses() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const utils = trpc.useUtils();

  const { data: warehouses, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();

  const create = trpc.warehouses.create.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم إنشاء المخزن"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم تحديث المخزن"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY); setIsOpen(true); };
  const openEdit = (w: any) => {
    setEditId(w.id);
    setForm({ code: w.code ?? "", name: w.name, branchId: w.branchId ? String(w.branchId) : "", description: w.address ?? "" });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("اسم المخزن مطلوب"); return; }
    const payload = {
      name: form.name,
      code: form.code || undefined,
      branchId: form.branchId && form.branchId !== "none" ? Number(form.branchId) : undefined,
      description: form.description || undefined,
    };
    if (editId) update.mutate({ id: editId, ...payload });
    else create.mutate(payload);
  };

  const getBranchName = (id: number | null) => branches?.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المخازن</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة مخازن الفروع</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />إضافة مخزن</Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">الرقم</TableHead>
                <TableHead className="text-right">المخزن</TableHead>
                <TableHead className="text-right">الفرع</TableHead>
                <TableHead className="text-right">الوصف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : warehouses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">لا توجد مخازن</TableCell>
                </TableRow>
              ) : warehouses?.map((w) => (
                <TableRow key={w.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm text-muted-foreground">{(w as any).code || "—"}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-primary" />
                      {w.name}
                    </div>
                  </TableCell>
                  <TableCell>{getBranchName(w.branchId ?? null)}</TableCell>
                  <TableCell className="text-muted-foreground">{w.address ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={w.isActive ? "default" : "secondary"} className="text-xs">
                      {w.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل المخزن" : "إضافة مخزن جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم المخزن</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="مثال: WH-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>اسم المخزن *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="أدخل اسم المخزن"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>الفرع</Label>
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون فرع</SelectItem>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الوصف</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف اختياري"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
              {editId ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
