import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Edit, Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ERPToolbar from "@/components/ERPToolbar";

const emptyForm = { code: "", name: "", phone: "", email: "", address: "" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customers.list.useQuery({});
  const create = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم إضافة العميل"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم تحديث العميل"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditId(null); setForm(emptyForm); setIsOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ code: c.code ?? "", name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "" });
    setIsOpen(true);
  };
  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("اسم العميل مطلوب"); return; }
    const data = {
      code: form.code.trim() || undefined,
      name: form.name.trim(),
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
    };
    if (editId) update.mutate({ id: editId, ...data });
    else create.mutate(data);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? (customers ?? []).filter((c: any) => c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q) || (c.phone ?? "").includes(q))
    : (customers ?? []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة قاعدة بيانات العملاء</p>
        </div>
      </div>

      <ERPToolbar
        pageTitle="العملاء"
        hideStatusBar
        onNew={openCreate}
        onEdit={() => toast.info("اختر عميلاً للتعديل")}
        onDelete={() => toast.info("اختر عميلاً للحذف")}
        onSearch={() => toast.info("بحث...")}
        onRefresh={() => window.location.reload()}
        onPrint={() => toast.info("جاري الطباعة...")}
      />

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود أو الهاتف..." className="pr-9" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right w-28">الكود</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right w-16">تعديل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>))}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا يوجد عملاء</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-muted/30">
                    <TableCell>
                      {c.code
                        ? <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#e0eaf4", color: "#406B93" }}>{c.code}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.address ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
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
          <DialogHeader><DialogTitle>{editId ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الكود</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 font-mono"
                placeholder="مثال: CU-001"
              />
            </div>
            <div><Label>الاسم <span className="text-red-500">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
            <div><Label>البريد الإلكتروني</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{editId ? "حفظ" : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
