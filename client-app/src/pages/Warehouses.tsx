import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Edit, Printer, Plus, Trash2, Warehouse, Search,
  ChevronFirst, ChevronLast, ChevronLeft as CLeft, ChevronRight as CRight,
  Eye, LogOut, FileText, SkipBack, SkipForward
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DEFAULT_LINKS = [
  "حساب المخزون",
  "حساب تكلفة مبيعات 1",
  "حساب تكلفة مبيعات 2",
  "حساب الصندوق",
  "حساب البنك",
  "حساب مبيعات 1",
  "حساب مبيعات 2",
  "حساب مبيعات 3",
  "حساب مبيعات 4",
  "حساب مبيعات 5",
  "حساب مشتريات 1",
  "حساب مشتريات 2",
  "حساب مشتريات 3",
  "حساب مشتريات 4",
].map((label, i) => ({ label, accountId: "" as string, sortOrder: i }));

type LinkRow = { label: string; accountId: string; sortOrder: number };

const EMPTY_FORM = {
  code: "", name: "", name2: "", fullName1: "", fullName2: "",
  branchId: "", description: "",
  allowedUserGroup: "", allowedUserId: "", copyFromWarehouseId: "",
};
type FormState = typeof EMPTY_FORM;

/* ── Borderless inline input ── */
const CI = ({ value, onChange, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full h-7 text-sm px-2 bg-transparent border-0 outline-none focus:bg-blue-50/50 ${className}`}
  />
);

/* ── Compact select (borderless) ── */
const CS = ({ value, onValueChange, placeholder, children }: {
  value: string; onValueChange: (v: string) => void; placeholder?: string; children: React.ReactNode;
}) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-7 text-sm rounded-none border-0 shadow-none focus:ring-0 bg-transparent px-2">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);

export default function Warehouses() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [links, setLinks] = useState<LinkRow[]>(DEFAULT_LINKS.map(l => ({ ...l })));

  const utils = trpc.useUtils();
  const { data: warehouses, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const { data: loadedLinks } = trpc.warehouses.accountLinks.list.useQuery(
    { warehouseId: editId! }, { enabled: !!editId }
  );

  useEffect(() => {
    if (loadedLinks && loadedLinks.length > 0) {
      setLinks(loadedLinks.map(l => ({
        label: l.label,
        accountId: l.accountId ? String(l.accountId) : "",
        sortOrder: l.sortOrder,
      })));
    } else if (editId) {
      setLinks([]);
    }
  }, [loadedLinks, editId]);

  const saveLinks = trpc.warehouses.accountLinks.save.useMutation();
  const create = trpc.warehouses.create.useMutation({
    onSuccess: async (w) => {
      await doSaveLinks(w.id);
      utils.warehouses.list.invalidate();
      toast.success("تم إنشاء المخزن");
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: async () => {
      await doSaveLinks(editId!);
      utils.warehouses.list.invalidate();
      toast.success("تم تحديث المخزن");
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });

  const doSaveLinks = async (warehouseId: number) => {
    await saveLinks.mutateAsync({
      warehouseId,
      links: links.filter(l => l.label.trim()).map((l, i) => ({
        label: l.label,
        accountId: l.accountId && l.accountId !== "none" ? Number(l.accountId) : null,
        sortOrder: i,
      })),
    });
  };

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));
  const f = (v: string) => v || undefined;
  const fNum = (v: string) => (v && v !== "none" ? Number(v) : undefined);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setLinks(DEFAULT_LINKS.map(l => ({ ...l })));
    setView("form");
  };
  const openEdit = (w: any) => {
    setEditId(w.id);
    setForm({
      code: w.code ?? "", name: w.name ?? "", name2: w.name2 ?? "",
      fullName1: w.fullName1 ?? "", fullName2: w.fullName2 ?? "",
      branchId: w.branchId ? String(w.branchId) : "",
      description: w.address ?? "",
      allowedUserGroup: w.allowedUserGroup ?? "",
      allowedUserId: w.allowedUserId ? String(w.allowedUserId) : "",
      copyFromWarehouseId: w.copyFromWarehouseId ? String(w.copyFromWarehouseId) : "",
    });
    setLinks([]);
    setView("form");
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("إسم 1 مطلوب"); return; }
    const payload = {
      name: form.name, code: f(form.code), name2: f(form.name2),
      fullName1: f(form.fullName1), fullName2: f(form.fullName2),
      branchId: fNum(form.branchId), description: f(form.description),
      allowedUserGroup: f(form.allowedUserGroup),
      allowedUserId: fNum(form.allowedUserId),
      copyFromWarehouseId: fNum(form.copyFromWarehouseId),
    };
    if (editId) update.mutate({ id: editId, ...payload });
    else create.mutate(payload);
  };

  const addLink = () => setLinks(p => [...p, { label: "", accountId: "", sortOrder: p.length }]);
  const removeLink = (i: number) => setLinks(p => p.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: keyof LinkRow, val: string) =>
    setLinks(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const getBranchName = (id: number | null) => branches?.find(b => b.id === id)?.name ?? "—";
  const isSaving = create.isPending || update.isPending || saveLinks.isPending;
  const warehouseList = warehouses ?? [];
  const currentIndex = editId ? warehouseList.findIndex(w => w.id === editId) : -1;
  const otherWarehouses = warehouseList.filter(w => w.id !== editId);

  /* ════════════════════ FORM VIEW ════════════════════ */
  if (view === "form") {
    return (
      <div className="flex flex-col min-h-full" dir="rtl">

        {/* ── Page title ── */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Warehouse className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground text-base">
              {editId ? "تعديل مخزن" : "إضافة مخزن جديد"}
            </span>
          </div>
          <button onClick={() => setView("list")}
            className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* ── Main form container ── */}
        <div className="flex-1 pb-16 space-y-0">

          {/* ══ الأوصاف ══ */}
          <div className="border border-border/50 rounded-sm bg-white">
            {/* Section title */}
            <div className="px-3 pt-1.5 pb-0.5">
              <span className="text-xs font-bold text-blue-600">الأوصاف</span>
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {/* Row 1: رقم + موقع */}
                <tr className="border-t border-border/30">
                  <td className="w-24 px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">رقم</td>
                  <td className="w-36 border-l border-border/30">
                    <CI value={form.code} onChange={v => set("code", v)} placeholder="001" />
                  </td>
                  <td className="w-20 px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">موقع</td>
                  <td className="border-l border-border/30">
                    <CS value={form.branchId} onValueChange={v => set("branchId", v)} placeholder="المقر الرئيسي">
                      <SelectItem value="none">المقر الرئيسي</SelectItem>
                      {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                    </CS>
                  </td>
                  {/* spacer column to keep visual balance */}
                  <td className="w-8 bg-slate-50/70"></td>
                </tr>
                {/* Row 2: إسم 1 + إسم 2 */}
                <tr className="border-t border-border/30">
                  <td className="px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">إسم 1 *</td>
                  <td className="border-l border-border/30">
                    <CI value={form.name} onChange={v => set("name", v)} />
                  </td>
                  <td className="px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">إسم 2</td>
                  <td colSpan={2} className="border-l border-border/30">
                    <CI value={form.name2} onChange={v => set("name2", v)} />
                  </td>
                </tr>
                {/* Row 3: إسم كامل 1 */}
                <tr className="border-t border-border/30">
                  <td className="px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">إسم كامل 1</td>
                  <td colSpan={4}>
                    <CI value={form.fullName1} onChange={v => set("fullName1", v)} />
                  </td>
                </tr>
                {/* Row 4: إسم كامل 2 */}
                <tr className="border-t border-border/30">
                  <td className="px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">إسم كامل 2</td>
                  <td colSpan={4}>
                    <CI value={form.fullName2} onChange={v => set("fullName2", v)} />
                  </td>
                </tr>
                {/* Row 5: ملحوظة */}
                <tr className="border-t border-border/30">
                  <td className="px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">ملحوظة</td>
                  <td colSpan={4}>
                    <CI value={form.description} onChange={v => set("description", v)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══ حدود الأستخدام + الروابط المحاسبية ══ */}
          <div className="border border-t-0 border-border/50 bg-white">
            <div className="flex">
              {/* حدود الأستخدام — RIGHT half */}
              <div className="flex-1 border-l border-border/30">
                <div className="px-3 pt-1.5 pb-0.5">
                  <span className="text-xs font-bold text-blue-600">حدود الأستخدام</span>
                </div>
                <table className="w-full text-sm border-collapse border-t border-border/30">
                  <tbody>
                    <tr>
                      <td className="w-32 px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">مجموعة مستخدمين</td>
                      <td>
                        <CI value={form.allowedUserGroup} onChange={v => set("allowedUserGroup", v)} />
                      </td>
                      <td className="w-20 px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">مستخدم</td>
                      <td>
                        <CS value={form.allowedUserId} onValueChange={v => set("allowedUserId", v)} placeholder="— الكل —">
                          <SelectItem value="none">— الكل —</SelectItem>
                          {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                        </CS>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* الروابط المحاسبية — LEFT half */}
              <div className="flex-1">
                <div className="px-3 pt-1.5 pb-0.5">
                  <span className="text-xs font-bold text-blue-600">الروابط المحاسبية</span>
                </div>
                <table className="w-full text-sm border-collapse border-t border-border/30">
                  <tbody>
                    <tr>
                      <td className="w-24 px-3 py-1 text-right text-xs text-muted-foreground border-l border-border/30 bg-slate-50/70 whitespace-nowrap">إستبعد من</td>
                      <td>
                        <CS value={form.copyFromWarehouseId} onValueChange={v => set("copyFromWarehouseId", v)} placeholder="— بدون —">
                          <SelectItem value="none">— بدون —</SelectItem>
                          {otherWarehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{(w as any).code ?? w.name}</SelectItem>)}
                        </CS>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ══ جدول الروابط المحاسبية ══ */}
          <div className="border border-t-0 border-border/50 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-slate-50/80">
                  <th className="w-10 text-center text-xs font-semibold text-blue-600 border-l border-border/30 py-1.5 px-2">#</th>
                  <th className="text-right text-xs font-semibold text-blue-600 border-l border-border/30 py-1.5 px-3">عنوان</th>
                  <th className="w-28 text-right text-xs font-semibold text-blue-600 border-l border-border/30 py-1.5 px-3">كود الحساب</th>
                  <th className="text-right text-xs font-semibold text-blue-600 py-1.5 px-3">إسم الحساب</th>
                  <th className="w-8 border-r border-border/30">
                    <button onClick={addLink} title="إضافة سطر"
                      className="w-full h-6 flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((link, i) => {
                  const acc = (accounts as any[])?.find((a: any) => String(a.id) === link.accountId);
                  return (
                    <tr key={i} className="border-b border-border/20 hover:bg-blue-50/30 group">
                      <td className="text-center text-xs text-muted-foreground border-l border-border/30 py-0.5 px-2 bg-slate-50/60">
                        {i + 1}
                      </td>
                      <td className="border-l border-border/30 py-0">
                        <input
                          value={link.label}
                          onChange={e => updateLink(i, "label", e.target.value)}
                          className="w-full h-7 text-sm px-3 bg-transparent border-0 outline-none focus:bg-blue-50/60"
                        />
                      </td>
                      <td className="text-center border-l border-border/30 py-0.5 px-2 font-mono text-xs text-slate-500 bg-slate-50/40">
                        {acc?.code ?? ""}
                      </td>
                      <td className="py-0">
                        <CS value={link.accountId} onValueChange={v => updateLink(i, "accountId", v)} placeholder="">
                          <SelectItem value="none">— بدون —</SelectItem>
                          {(accounts as any[])?.map((a: any) => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                          ))}
                        </CS>
                      </td>
                      <td className="border-r border-border/30 text-center">
                        <button onClick={() => removeLink(i)}
                          className="w-full h-7 flex items-center justify-center text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {links.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                      لا توجد روابط — اضغط (+) لإضافة سطر
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ شريط الأدوات السفلي ══ */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-[#f0f0f0]" dir="rtl">
          <div className="flex items-stretch divide-x divide-x-reverse divide-border/40">
            {[
              { label: "حفظ",   icon: <FileText className="w-4 h-4" />,   action: handleSave,  primary: true },
              { label: "جديد",  icon: <Plus className="w-4 h-4" />,       action: openCreate },
              { label: "بحث",   icon: <Search className="w-4 h-4" />,     action: () => {} },
              { label: "الحل",  icon: <SkipForward className="w-4 h-4" />, action: () => {} },
              { label: "الأخير",icon: <ChevronLast className="w-4 h-4" />, action: () => warehouseList.at(-1) && openEdit(warehouseList.at(-1)!) },
              { label: "التالي",icon: <CLeft className="w-4 h-4" />,       action: () => currentIndex < warehouseList.length - 1 && openEdit(warehouseList[currentIndex + 1]) },
              { label: "السابق",icon: <CRight className="w-4 h-4" />,      action: () => currentIndex > 0 && openEdit(warehouseList[currentIndex - 1]) },
              { label: "الأول", icon: <ChevronFirst className="w-4 h-4" />,action: () => warehouseList[0] && openEdit(warehouseList[0]) },
              { label: "حذف",   icon: <Trash2 className="w-4 h-4" />,     action: () => {},    danger: true },
              { label: "عرض",   icon: <Eye className="w-4 h-4" />,        action: () => {} },
              { label: "طباعة", icon: <Printer className="w-4 h-4" />,    action: () => {} },
              { label: "خروج",  icon: <LogOut className="w-4 h-4" />,     action: () => setView("list") },
            ].map(({ label, icon, action, primary, danger }: any) => (
              <button key={label} onClick={action}
                disabled={label === "حفظ" && isSaving}
                className={[
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-[11px] min-w-[52px] flex-1 transition-colors",
                  primary
                    ? "bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                    : danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-slate-700 hover:bg-slate-200",
                ].join(" ")}>
                {icon}
                <span>{label === "حفظ" && isSaving ? "..." : label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    );
  }

  /* ════════════════════ LIST VIEW ════════════════════ */
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
                <TableHead className="w-12"></TableHead>
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
              ) : !warehouseList.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    لا توجد مخازن
                  </TableCell>
                </TableRow>
              ) : warehouseList.map(w => (
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
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={e => { e.stopPropagation(); openEdit(w); }}>
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
