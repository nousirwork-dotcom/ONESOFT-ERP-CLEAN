import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Edit, Printer, Plus, Trash2, Warehouse, Search,
  ChevronFirst, ChevronLast, ChevronLeft as CLeft, ChevronRight as CRight,
  Eye, LogOut, FileText, SkipForward
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/* ─── Default account link labels ─── */
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

/* ─── Section card wrapper ─── */
const Section = ({ title, children, action }: {
  title: string; children: React.ReactNode; action?: React.ReactNode;
}) => (
  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
      <span className="text-[15px] font-semibold text-blue-700 tracking-wide">{title}</span>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/* ─── Labeled field ─── */
const Field = ({ label, children, span = 1 }: {
  label: string; children: React.ReactNode; span?: number;
}) => (
  <div className={span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : ""}>
    <Label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</Label>
    {children}
  </div>
);

/* ─── Standard input (h-10) ─── */
const FI = ({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <Input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="h-10 text-sm border-slate-200 focus:border-blue-400 focus-visible:ring-1 focus-visible:ring-blue-200 bg-white rounded-md"
  />
);

/* ─── Standard select (h-10) ─── */
const FS = ({ value, onValueChange, placeholder, children }: {
  value: string; onValueChange: (v: string) => void; placeholder?: string; children: React.ReactNode;
}) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 bg-white rounded-md">
      <SelectValue placeholder={placeholder ?? "— اختر —"} />
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
      toast.success("تم إنشاء المخزن بنجاح");
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: async () => {
      await doSaveLinks(editId!);
      utils.warehouses.list.invalidate();
      toast.success("تم تحديث المخزن بنجاح");
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

  /* ════════════════════════════ FORM VIEW ════════════════════════════ */
  if (view === "form") {
    return (
      <div className="flex flex-col min-h-full" dir="rtl">

        {/* ── Page title ── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setView("list")}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Warehouse className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-800">
              {editId ? "تعديل بيانات المخزن" : "إضافة مخزن جديد"}
            </h1>
          </div>
        </div>

        {/* ── Sections ── */}
        <div className="flex-1 space-y-4 pb-20">

          {/* ══ البيانات الأساسية ══ */}
          <Section title="البيانات الأساسية">
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <Field label="رقم المخزن">
                <FI value={form.code} onChange={v => set("code", v)} placeholder="مثال: 001" />
              </Field>
              <Field label="الموقع / الفرع" span={2}>
                <FS value={form.branchId} onValueChange={v => set("branchId", v)} placeholder="المقر الرئيسي">
                  <SelectItem value="none">المقر الرئيسي</SelectItem>
                  {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </FS>
              </Field>
              <div /> {/* spacer */}
              <Field label="إسم 1 *" span={2}>
                <FI value={form.name} onChange={v => set("name", v)} placeholder="الإسم الأول للمخزن" />
              </Field>
              <Field label="إسم 2" span={2}>
                <FI value={form.name2} onChange={v => set("name2", v)} placeholder="الإسم الثاني (اختياري)" />
              </Field>
              <Field label="الإسم الكامل 1" span={4}>
                <FI value={form.fullName1} onChange={v => set("fullName1", v)} placeholder="الإسم الكامل الأول" />
              </Field>
              <Field label="الإسم الكامل 2" span={4}>
                <FI value={form.fullName2} onChange={v => set("fullName2", v)} placeholder="الإسم الكامل الثاني" />
              </Field>
              <Field label="ملحوظة" span={4}>
                <FI value={form.description} onChange={v => set("description", v)} placeholder="أي ملاحظات..." />
              </Field>
            </div>
          </Section>

          {/* ══ حدود الاستخدام + الروابط المحاسبية ══ */}
          <div className="grid grid-cols-2 gap-4">

            {/* حدود الاستخدام */}
            <Section title="حدود الاستخدام">
              <div className="space-y-4">
                <Field label="مجموعة المستخدمين">
                  <FI value={form.allowedUserGroup} onChange={v => set("allowedUserGroup", v)} placeholder="اسم المجموعة" />
                </Field>
                <Field label="مستخدم محدد">
                  <FS value={form.allowedUserId} onValueChange={v => set("allowedUserId", v)} placeholder="— الكل —">
                    <SelectItem value="none">— الكل —</SelectItem>
                    {(users as any[])?.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </FS>
                </Field>
              </div>
            </Section>

            {/* الروابط المحاسبية */}
            <Section title="الروابط المحاسبية">
              <div className="space-y-4">
                <Field label="إستبعد من مخزن">
                  <FS value={form.copyFromWarehouseId} onValueChange={v => set("copyFromWarehouseId", v)} placeholder="— بدون —">
                    <SelectItem value="none">— بدون —</SelectItem>
                    {otherWarehouses.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {(w as any).code ? `${(w as any).code} - ${w.name}` : w.name}
                      </SelectItem>
                    ))}
                  </FS>
                </Field>
              </div>
            </Section>
          </div>

          {/* ══ جدول الحسابات ══ */}
          <Section
            title="الحسابات المحاسبية للمخزن"
            action={
              <Button variant="outline" size="sm" onClick={addLink}
                className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300">
                <Plus className="w-3.5 h-3.5" />
                إضافة سطر
              </Button>
            }
          >
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 py-3 px-4 text-center text-xs font-semibold text-slate-500 border-l border-slate-200">#</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 border-l border-slate-200 w-56">عنوان الحساب</th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-slate-600 border-l border-slate-200 w-28">كود الحساب</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600">إسم الحساب</th>
                    <th className="w-10 border-l border-slate-200"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {links.map((link, i) => {
                    const acc = (accounts as any[])?.find((a: any) => String(a.id) === link.accountId);
                    return (
                      <tr key={i} className="hover:bg-blue-50/30 group transition-colors" style={{ height: 40 }}>
                        <td className="px-4 text-center text-xs text-slate-400 border-l border-slate-100 bg-slate-50/50">
                          {i + 1}
                        </td>
                        <td className="px-1 border-l border-slate-100">
                          <input
                            value={link.label}
                            onChange={e => updateLink(i, "label", e.target.value)}
                            className="w-full h-10 text-sm px-3 bg-transparent border-0 outline-none rounded focus:bg-blue-50/60 text-slate-700"
                          />
                        </td>
                        <td className="px-4 text-center border-l border-slate-100 bg-slate-50/30">
                          <span className="font-mono text-xs text-slate-500">{acc?.code ?? ""}</span>
                        </td>
                        <td className="px-1">
                          <Select value={link.accountId} onValueChange={v => updateLink(i, "accountId", v)}>
                            <SelectTrigger className="h-10 text-sm rounded-none border-0 shadow-none focus:ring-0 bg-transparent text-slate-700">
                              <SelectValue placeholder="— اختر الحساب —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— بدون —</SelectItem>
                              {(accounts as any[])?.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.code} - {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border-l border-slate-100 text-center">
                          <button onClick={() => removeLink(i)}
                            className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {links.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-slate-400 py-10">
                        لا توجد حسابات — اضغط "إضافة سطر" لإضافة حساب
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ══ شريط الأدوات السفلي ══ */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]" dir="rtl">
          <div className="flex items-stretch">
            {[
              { label: "حفظ",    icon: <FileText className="w-4 h-4" />,    action: handleSave,   style: "bg-blue-600 text-white hover:bg-blue-700 font-semibold" },
              { label: "جديد",   icon: <Plus className="w-4 h-4" />,         action: openCreate,   style: "text-slate-700 hover:bg-slate-50" },
              { label: "بحث",    icon: <Search className="w-4 h-4" />,       action: () => {},     style: "text-slate-700 hover:bg-slate-50" },
              { label: "الحل",   icon: <SkipForward className="w-4 h-4" />,  action: () => {},     style: "text-slate-700 hover:bg-slate-50" },
              { label: "الأخير", icon: <ChevronLast className="w-4 h-4" />,  action: () => warehouseList.at(-1) && openEdit(warehouseList.at(-1)!), style: "text-slate-700 hover:bg-slate-50" },
              { label: "التالي", icon: <CLeft className="w-4 h-4" />,        action: () => currentIndex < warehouseList.length - 1 && openEdit(warehouseList[currentIndex + 1]), style: "text-slate-700 hover:bg-slate-50" },
              { label: "السابق", icon: <CRight className="w-4 h-4" />,       action: () => currentIndex > 0 && openEdit(warehouseList[currentIndex - 1]), style: "text-slate-700 hover:bg-slate-50" },
              { label: "الأول",  icon: <ChevronFirst className="w-4 h-4" />, action: () => warehouseList[0] && openEdit(warehouseList[0]), style: "text-slate-700 hover:bg-slate-50" },
              { label: "حذف",    icon: <Trash2 className="w-4 h-4" />,       action: () => {},     style: "text-red-500 hover:bg-red-50" },
              { label: "عرض",    icon: <Eye className="w-4 h-4" />,          action: () => {},     style: "text-slate-700 hover:bg-slate-50" },
              { label: "طباعة",  icon: <Printer className="w-4 h-4" />,      action: () => {},     style: "text-slate-700 hover:bg-slate-50" },
              { label: "خروج",   icon: <LogOut className="w-4 h-4" />,       action: () => setView("list"), style: "text-slate-700 hover:bg-slate-50" },
            ].map(({ label, icon, action, style }: any) => (
              <button key={label} onClick={action}
                disabled={label === "حفظ" && isSaving}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-[11px] font-medium border-l border-slate-100 last:border-0 transition-colors min-w-0 ${style}`}>
                {icon}
                <span className="leading-none">{label === "حفظ" && isSaving ? "..." : label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    );
  }

  /* ════════════════════════════ LIST VIEW ════════════════════════════ */
  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <Warehouse className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">المخازن</h1>
            <p className="text-slate-400 text-sm">إدارة مخازن الفروع والمواقع</p>
          </div>
        </div>
        <Button onClick={openCreate}
          className="gap-2 bg-blue-600 hover:bg-blue-700 h-10 px-5 rounded-lg shadow-sm">
          <Plus className="w-4 h-4" />
          إضافة مخزن
        </Button>
      </div>

      {/* Table card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-slate-100 bg-slate-50/60">
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5 px-5">رقم</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5">إسم المخزن</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5">إسم 2</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5">الموقع</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5">ملحوظة</TableHead>
              <TableHead className="text-right text-xs font-semibold text-slate-500 py-3.5">الحالة</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-b border-slate-50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j} className="py-4 px-5">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !warehouseList.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <Warehouse className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">لا توجد مخازن مضافة بعد</p>
                  <button onClick={openCreate} className="mt-2 text-sm text-blue-600 hover:underline">
                    إضافة أول مخزن
                  </button>
                </TableCell>
              </TableRow>
            ) : warehouseList.map(w => (
              <TableRow key={w.id}
                className="border-b border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-colors"
                onClick={() => openEdit(w)}>
                <TableCell className="py-3.5 px-5">
                  <span className="font-mono text-sm text-slate-500">{(w as any).code || "—"}</span>
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                      <Warehouse className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <span className="font-medium text-slate-800">{w.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-slate-500 text-sm">{(w as any).name2 || "—"}</TableCell>
                <TableCell className="py-3.5 text-slate-500 text-sm">{getBranchName(w.branchId ?? null)}</TableCell>
                <TableCell className="py-3.5 text-slate-400 text-sm">{w.address || "—"}</TableCell>
                <TableCell className="py-3.5">
                  <Badge variant={w.isActive ? "default" : "secondary"}
                    className={`text-xs rounded-full px-2.5 ${w.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50" : ""}`}>
                    {w.isActive ? "نشط" : "غير نشط"}
                  </Badge>
                </TableCell>
                <TableCell className="py-3.5">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(w); }}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
