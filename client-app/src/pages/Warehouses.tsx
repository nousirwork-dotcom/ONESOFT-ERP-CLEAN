import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Edit, Plus, Warehouse } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ACCOUNT_LINKS = [
  { key: "invAccountId",    label: "حساب المخزون" },
  { key: "cogsAccount1Id",  label: "حساب تكلفة مبيعات 1" },
  { key: "cogsAccount2Id",  label: "حساب تكلفة مبيعات 2" },
  { key: "cashAccountId",   label: "حساب الصندوق" },
  { key: "bankAccountId",   label: "حساب البنك" },
  { key: "salesAccount1Id", label: "حساب مبيعات 1" },
] as const;

type AccountKey = typeof ACCOUNT_LINKS[number]["key"];

const EMPTY = {
  code: "", name: "", name2: "", fullName1: "", fullName2: "",
  branchId: "", description: "",
  invAccountId: "", cogsAccount1Id: "", cogsAccount2Id: "",
  cashAccountId: "", bankAccountId: "", salesAccount1Id: "",
  allowedUserGroup: "", allowedUserId: "", copyFromWarehouseId: "",
};

type FormState = typeof EMPTY;

export default function Warehouses() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const utils = trpc.useUtils();

  const { data: warehouses, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const create = trpc.warehouses.create.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم إنشاء المخزن"); setView("list"); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم تحديث المخزن"); setView("list"); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => { setEditId(null); setForm(EMPTY); setView("form"); };
  const openEdit = (w: any) => {
    setEditId(w.id);
    setForm({
      code: w.code ?? "",
      name: w.name ?? "",
      name2: w.name2 ?? "",
      fullName1: w.fullName1 ?? "",
      fullName2: w.fullName2 ?? "",
      branchId: w.branchId ? String(w.branchId) : "",
      description: w.address ?? "",
      invAccountId: w.invAccountId ? String(w.invAccountId) : "",
      cogsAccount1Id: w.cogsAccount1Id ? String(w.cogsAccount1Id) : "",
      cogsAccount2Id: w.cogsAccount2Id ? String(w.cogsAccount2Id) : "",
      cashAccountId: w.cashAccountId ? String(w.cashAccountId) : "",
      bankAccountId: w.bankAccountId ? String(w.bankAccountId) : "",
      salesAccount1Id: w.salesAccount1Id ? String(w.salesAccount1Id) : "",
      allowedUserGroup: w.allowedUserGroup ?? "",
      allowedUserId: w.allowedUserId ? String(w.allowedUserId) : "",
      copyFromWarehouseId: w.copyFromWarehouseId ? String(w.copyFromWarehouseId) : "",
    });
    setView("form");
  };

  const f = (v: string) => (v ? v : undefined);
  const fNum = (v: string) => (v && v !== "none" ? Number(v) : undefined);

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("إسم 1 مطلوب"); return; }
    const payload = {
      name: form.name,
      code: f(form.code),
      name2: f(form.name2),
      fullName1: f(form.fullName1),
      fullName2: f(form.fullName2),
      branchId: fNum(form.branchId),
      description: f(form.description),
      invAccountId: fNum(form.invAccountId),
      cogsAccount1Id: fNum(form.cogsAccount1Id),
      cogsAccount2Id: fNum(form.cogsAccount2Id),
      cashAccountId: fNum(form.cashAccountId),
      bankAccountId: fNum(form.bankAccountId),
      salesAccount1Id: fNum(form.salesAccount1Id),
      allowedUserGroup: f(form.allowedUserGroup),
      allowedUserId: fNum(form.allowedUserId),
      copyFromWarehouseId: fNum(form.copyFromWarehouseId),
    };
    if (editId) update.mutate({ id: editId, ...payload });
    else create.mutate(payload);
  };

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const getBranchName = (id: number | null) => branches?.find((b) => b.id === id)?.name ?? "—";

  const AccountSelect = ({ field }: { field: AccountKey }) => (
    <Select value={form[field]} onValueChange={(v) => set(field, v)}>
      <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— بدون —</SelectItem>
        {(accounts as any[])?.map((a: any) => (
          <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (view === "form") {
    const otherWarehouses = warehouses?.filter(w => w.id !== editId) ?? [];
    return (
      <div className="space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("list")} className="h-8 w-8">
            <ArrowRight className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">{editId ? "تعديل مخزن" : "إضافة مخزن جديد"}</h1>
        </div>

        {/* البيانات الأساسية */}
        <Card className="border shadow-sm">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold">البيانات الأساسية</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm w-20 shrink-0 text-right">موقع</Label>
                <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
                  <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="اختر الموقع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون —</SelectItem>
                    {branches?.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm w-16 shrink-0 text-right">رقم</Label>
                <Input value={form.code} onChange={(e) => set("code", e.target.value)}
                  placeholder="001" className="h-8 text-sm flex-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm w-20 shrink-0 text-right">إسم 2</Label>
                <Input value={form.name2} onChange={(e) => set("name2", e.target.value)}
                  className="h-8 text-sm flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm w-16 shrink-0 text-right">إسم 1 *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="h-8 text-sm flex-1" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm w-20 shrink-0 text-right">إسم كامل 1</Label>
              <Input value={form.fullName1} onChange={(e) => set("fullName1", e.target.value)}
                className="h-8 text-sm flex-1" />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm w-20 shrink-0 text-right">إسم كامل 2</Label>
              <Input value={form.fullName2} onChange={(e) => set("fullName2", e.target.value)}
                className="h-8 text-sm flex-1" />
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm w-20 shrink-0 text-right">ملحوظة</Label>
              <Input value={form.description} onChange={(e) => set("description", e.target.value)}
                className="h-8 text-sm flex-1" />
            </div>
          </CardContent>
        </Card>

        {/* حدود الاستخدام */}
        <Card className="border shadow-sm">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold">حدود الاستخدام</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm w-28 shrink-0 text-right">مجموعة مستخدمين</Label>
                <Input
                  value={form.allowedUserGroup}
                  onChange={(e) => set("allowedUserGroup", e.target.value)}
                  placeholder="اسم المجموعة"
                  className="h-8 text-sm flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm w-16 shrink-0 text-right">مستخدم</Label>
                <Select value={form.allowedUserId} onValueChange={(v) => set("allowedUserId", v)}>
                  <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="اختر المستخدم" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— الكل —</SelectItem>
                    {(users as any[])?.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm w-16 shrink-0 text-right">إنسخ من</Label>
                <Select value={form.copyFromWarehouseId} onValueChange={(v) => set("copyFromWarehouseId", v)}>
                  <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="اختر المخزن" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون —</SelectItem>
                    {otherWarehouses.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* الروابط المحاسبية */}
        <Card className="border shadow-sm">
          <CardHeader className="py-3 px-4 border-b bg-muted/30">
            <CardTitle className="text-sm font-semibold">الروابط المحاسبية</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right text-xs py-2 w-8">#</TableHead>
                  <TableHead className="text-right text-xs py-2">عنوان</TableHead>
                  <TableHead className="text-right text-xs py-2">الحساب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ACCOUNT_LINKS.map((link, i) => (
                  <TableRow key={link.key} className="hover:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground py-1.5 w-8">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium py-1.5">{link.label}</TableCell>
                    <TableCell className="py-1.5">
                      <AccountSelect field={link.key} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* أزرار الحفظ */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setView("list")}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {editId ? "حفظ التعديلات" : "إضافة المخزن"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
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
                <TableHead className="text-right">رقم</TableHead>
                <TableHead className="text-right">إسم 1</TableHead>
                <TableHead className="text-right">إسم 2</TableHead>
                <TableHead className="text-right">موقع</TableHead>
                <TableHead className="text-right">ملحوظة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !warehouses?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    لا توجد مخازن
                  </TableCell>
                </TableRow>
              ) : warehouses.map((w) => (
                <TableRow key={w.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(w)}>
                  <TableCell className="font-mono text-sm">{(w as any).code || "—"}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-primary shrink-0" />
                      {w.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{(w as any).name2 || "—"}</TableCell>
                  <TableCell>{getBranchName(w.branchId ?? null)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{w.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={w.isActive ? "default" : "secondary"} className="text-xs">
                      {w.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(w); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
