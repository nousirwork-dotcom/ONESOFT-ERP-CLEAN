import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Building2, Edit, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const emptyForm = { name: "", address: "", phone: "" };

export default function Branches() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();

  const { data: branches, isLoading } = trpc.branches.list.useQuery();
  const create = trpc.branches.create.useMutation({
    onSuccess: () => { utils.branches.list.invalidate(); toast.success("تم إنشاء الفرع"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.branches.update.useMutation({
    onSuccess: () => { utils.branches.list.invalidate(); toast.success("تم تحديث الفرع"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBranch = trpc.branches.delete.useMutation({
    onSuccess: () => {
      utils.branches.list.invalidate();
      toast.success("تم حذف الفرع");
      setShowDeleteConfirm(false);
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditId(null); setForm(emptyForm); setIsOpen(true); };
  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({ name: b.name, address: b.address ?? "", phone: b.phone ?? "" });
    setIsOpen(true);
  };
  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("اسم الفرع مطلوب"); return; }
    const data = { name: form.name.trim(), address: form.address || undefined, phone: form.phone || undefined };
    if (editId) update.mutate({ id: editId, ...data });
    else create.mutate(data);
  };
  const handleDelete = () => {
    if (editId) deleteBranch.mutate({ id: editId });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفروع</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة فروع الشركة</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />إضافة فرع</Button>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">الفرع</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right w-16">تعديل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => (<TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>))}</TableRow>
                ))
              ) : (
                branches?.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {b.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.address ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{b.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={b.isActive ? "default" : "secondary"} className="text-xs">
                        {b.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "تعديل الفرع" : "إضافة فرع جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>اسم الفرع *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter className="flex-row-reverse sm:flex-row gap-2">
            {editId && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="mr-auto gap-1"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </Button>
            )}
            <div className="flex gap-2 ms-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editId ? "حفظ" : "إضافة"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف الفرع "<span className="font-medium text-foreground">{form.name}</span>"؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBranch.isPending}>
              {deleteBranch.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
