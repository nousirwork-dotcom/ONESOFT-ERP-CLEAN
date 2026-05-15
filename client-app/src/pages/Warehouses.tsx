import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Edit, Printer, Plus, Trash2, Warehouse, Search,
  ChevronFirst, ChevronLast, ChevronLeft as CLeft, ChevronRight as CRight,
  Eye, LogOut, Save, SkipForward,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/* ─────────────────────────── constants ─────────────────────────── */
const DEFAULT_LINKS = [
  "حساب المخزون", "حساب تكلفة مبيعات 1", "حساب تكلفة مبيعات 2",
  "حساب الصندوق", "حساب البنك",
  "حساب مبيعات 1", "حساب مبيعات 2", "حساب مبيعات 3",
  "حساب مبيعات 4", "حساب مبيعات 5",
  "حساب مشتريات 1", "حساب مشتريات 2", "حساب مشتريات 3", "حساب مشتريات 4",
].map((label, i) => ({ label, accountId: "" as string, sortOrder: i }));

type LinkRow = { label: string; accountId: string; sortOrder: number };

const EMPTY_FORM = {
  code: "", name: "", name2: "", fullName1: "", fullName2: "",
  branchId: "", description: "", allowedUserGroup: "",
  allowedUserId: "", copyFromWarehouseId: "",
};
type FormState = typeof EMPTY_FORM;

/* ─────────────────────────── small UI atoms ─────────────────────────── */

/**
 * ERP section card — white bg, subtle border, indigo title, thin divider
 */
const Section = ({
  title, children, action,
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div
    className="bg-white overflow-hidden"
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}
  >
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderBottom: "1px solid #f1f5f9" }}
    >
      <span
        className="font-semibold text-indigo-700"
        style={{ fontSize: 14 }}
      >
        {title}
      </span>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/** Label + child stacked */
const Field = ({
  label, children, span = 1,
}: { label: string; children: React.ReactNode; span?: number }) => (
  <div className={
    span === 4 ? "col-span-4" :
    span === 3 ? "col-span-3" :
    span === 2 ? "col-span-2" : ""
  }>
    <Label className="block text-xs font-medium text-slate-500 mb-1">
      {label}
    </Label>
    {children}
  </div>
);

/** Standard 36-px input */
const FI = ({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="h-9 text-sm border-slate-200 focus:border-indigo-400 focus-visible:ring-1 focus-visible:ring-indigo-200 bg-white rounded"
  />
);

/** Standard 36-px select */
const FS = ({
  value, onValueChange, placeholder, children,
}: { value: string; onValueChange: (v: string) => void; placeholder?: string; children: React.ReactNode }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 bg-white rounded">
      <SelectValue placeholder={placeholder ?? "— اختر —"} />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);

/* ─────────────────────────── main component ─────────────────────────── */
export default function Warehouses() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [links, setLinks] = useState<LinkRow[]>(DEFAULT_LINKS.map(l => ({ ...l })));

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const utils = trpc.useUtils();
  const { data: warehouses, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const { data: loadedLinks } = trpc.warehouses.accountLinks.list.useQuery(
    { warehouseId: editId! }, { enabled: !!editId },
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
  const deleteWarehouse = trpc.warehouses.delete.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم حذف المخزن"); setEditId(null); setShowDeleteDialog(false); setView("list"); },
    onError: (e) => toast.error(e.message),
  });
  const create = trpc.warehouses.create.useMutation({
    onSuccess: async (w) => { await doSaveLinks(w.id); utils.warehouses.list.invalidate(); toast.success("تم إنشاء المخزن"); setView("list"); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.warehouses.update.useMutation({
    onSuccess: async () => { await doSaveLinks(editId!); utils.warehouses.list.invalidate(); toast.success("تم تحديث المخزن"); setView("list"); },
    onError: (e) => toast.error(e.message),
  });

  const doSaveLinks = async (warehouseId: number) =>
    saveLinks.mutateAsync({
      warehouseId,
      links: links.filter(l => l.label.trim()).map((l, i) => ({
        label: l.label,
        accountId: l.accountId && l.accountId !== "none" ? Number(l.accountId) : null,
        sortOrder: i,
      })),
    });

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));
  const f = (v: string) => v || undefined;
  const fNum = (v: string) => (v && v !== "none" ? Number(v) : undefined);

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM);
    setLinks(DEFAULT_LINKS.map(l => ({ ...l }))); setView("form");
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
    setLinks([]); setView("form");
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

  /* ══════════════════════════════════════════════════════════════
     FORM VIEW
  ══════════════════════════════════════════════════════════════ */
  if (view === "form") {
    const toolbar = [
      { label: "حفظ",    icon: <Save className="w-3.5 h-3.5" />,         action: handleSave, primary: true },
      { label: "جديد",   icon: <Plus className="w-3.5 h-3.5" />,         action: openCreate },
      { label: "بحث",    icon: <Search className="w-3.5 h-3.5" />,       action: () => {} },
      { label: "الحل",   icon: <SkipForward className="w-3.5 h-3.5" />,  action: () => {} },
      { label: "الأخير", icon: <ChevronLast className="w-3.5 h-3.5" />,  action: () => warehouseList.at(-1) && openEdit(warehouseList.at(-1)!) },
      { label: "التالي", icon: <CLeft className="w-3.5 h-3.5" />,        action: () => currentIndex < warehouseList.length - 1 && openEdit(warehouseList[currentIndex + 1]) },
      { label: "السابق", icon: <CRight className="w-3.5 h-3.5" />,       action: () => currentIndex > 0 && openEdit(warehouseList[currentIndex - 1]) },
      { label: "الأول",  icon: <ChevronFirst className="w-3.5 h-3.5" />, action: () => warehouseList[0] && openEdit(warehouseList[0]) },
      { label: "حذف",    icon: <Trash2 className="w-3.5 h-3.5" />,       action: () => editId && setShowDeleteDialog(true), danger: true },
      { label: "عرض",    icon: <Eye className="w-3.5 h-3.5" />,          action: () => {} },
      { label: "طباعة",  icon: <Printer className="w-3.5 h-3.5" />,      action: () => {} },
      { label: "خروج",   icon: <LogOut className="w-3.5 h-3.5" />,       action: () => setView("list") },
    ];

    return (
      <div
        className="flex flex-col min-h-full -mx-6 -mt-6 px-6 pt-5"
        style={{ background: "#f8f9fb" }}
        dir="rtl"
      >
        {/* ── Page title ── */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setView("list")}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Warehouse className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <h1 className="text-[15px] font-bold text-slate-700">
              {editId ? "تعديل بيانات المخزن" : "إضافة مخزن جديد"}
            </h1>
          </div>
        </div>

        {/* ── Sections ── */}
        <div className="flex-1 space-y-3 pb-16">

          {/* ══ البيانات الأساسية ══ */}
          <Section title="البيانات الأساسية">
            <div className="grid grid-cols-4 gap-x-5 gap-y-3">
              <Field label="رقم المخزن">
                <FI value={form.code} onChange={v => set("code", v)} placeholder="001" />
              </Field>
              <Field label="الموقع / الفرع" span={2}>
                <FS value={form.branchId} onValueChange={v => set("branchId", v)} placeholder="المقر الرئيسي">
                  <SelectItem value="none">المقر الرئيسي</SelectItem>
                  {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </FS>
              </Field>
              <div /> {/* spacer */}
              <Field label="إسم 1 *" span={2}>
                <FI value={form.name} onChange={v => set("name", v)} placeholder="الإسم الأول" />
              </Field>
              <Field label="إسم 2" span={2}>
                <FI value={form.name2} onChange={v => set("name2", v)} placeholder="الإسم الثاني" />
              </Field>
              <Field label="الإسم الكامل 1" span={4}>
                <FI value={form.fullName1} onChange={v => set("fullName1", v)} />
              </Field>
              <Field label="الإسم الكامل 2" span={4}>
                <FI value={form.fullName2} onChange={v => set("fullName2", v)} />
              </Field>
              <Field label="ملحوظة" span={4}>
                <FI value={form.description} onChange={v => set("description", v)} />
              </Field>
            </div>
          </Section>

          {/* ══ حدود الاستخدام + الروابط المحاسبية ══ */}
          <div className="grid grid-cols-2 gap-3">
            <Section title="حدود الاستخدام">
              <div className="space-y-3">
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

            <Section title="الروابط المحاسبية">
              <div className="space-y-3">
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
              <button
                onClick={addLink}
                className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 border border-indigo-200 rounded px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3 h-3" />
                إضافة سطر
              </button>
            }
          >
            <div
              className="overflow-hidden"
              style={{ border: "1px solid #e5e7eb", borderRadius: 6 }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <th className="w-9 py-2.5 text-center text-[11px] font-semibold text-slate-400 border-l border-slate-200">#</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 border-l border-slate-200 w-52">عنوان الحساب</th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-semibold text-slate-500 border-l border-slate-200 w-24">كود الحساب</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500">إسم الحساب</th>
                    <th className="w-9 border-l border-slate-200" />
                  </tr>
                </thead>
                <tbody>
                  {links.map((link, i) => {
                    const acc = (accounts as any[])?.find((a: any) => String(a.id) === link.accountId);
                    const isEven = i % 2 === 0;
                    return (
                      <tr
                        key={i}
                        className="group transition-colors hover:bg-indigo-50/40"
                        style={{
                          height: 30,
                          background: isEven ? "#ffffff" : "#f9fafb",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <td className="text-center text-[11px] text-slate-400 border-l border-slate-100 select-none" style={{ background: isEven ? "#f8fafc" : "#f4f6f8" }}>
                          {i + 1}
                        </td>
                        <td className="border-l border-slate-100 py-0 px-0">
                          <input
                            value={link.label}
                            onChange={e => updateLink(i, "label", e.target.value)}
                            className="w-full h-full py-0 px-3 text-sm bg-transparent border-0 outline-none focus:bg-indigo-50/60 text-slate-700"
                            style={{ height: 30 }}
                          />
                        </td>
                        <td className="text-center border-l border-slate-100 px-2" style={{ background: isEven ? "#f8fafc" : "#f4f6f8" }}>
                          <span className="font-mono text-xs text-slate-500">{acc?.code ?? ""}</span>
                        </td>
                        <td className="py-0 px-0">
                          <Select value={link.accountId} onValueChange={v => updateLink(i, "accountId", v)}>
                            <SelectTrigger
                              className="border-0 shadow-none rounded-none focus:ring-0 bg-transparent text-slate-700 text-sm"
                              style={{ height: 30 }}
                            >
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
                          <button
                            onClick={() => removeLink(i)}
                            className="w-full flex items-center justify-center text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            style={{ height: 30 }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {links.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                        لا توجد حسابات — اضغط "إضافة سطر"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ══ شريط الأدوات السفلي ══ */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
          style={{ borderTop: "1px solid #e5e7eb", background: "#ffffff", boxShadow: "0 -2px 8px rgba(0,0,0,0.05)" }}
          dir="rtl"
        >
          {toolbar.map(({ label, icon, action, primary, danger }: any) => (
            <button
              key={label}
              onClick={action}
              disabled={(label === "حفظ" && isSaving) || (label === "حذف" && !editId)}
              className={[
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[11px] font-medium transition-colors",
                "border-l border-slate-100 last:border-0",
                primary
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : danger
                    ? "text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              {icon}
              <span className="leading-none mt-0.5">
                {label === "حفظ" && isSaving ? "..." : label}
              </span>
            </button>
          ))}
        </div>

        {/* ══ نافذة تأكيد الحذف ══ */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-base">هل تريد حذف هذا المخزن؟</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500 text-right">
              سيتم إلغاء تفعيل المخزن وإخفاؤه من القوائم. يمكن استعادته لاحقاً عند الحاجة.
            </p>
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => { setShowDeleteDialog(false); deleteWarehouse.mutate({ id: editId! }); }}
                disabled={deleteWarehouse.isPending}
              >
                {deleteWarehouse.isPending ? "جارٍ الحذف..." : "حذف"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeleteDialog(false)}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     LIST VIEW
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Warehouse className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">المخازن</h1>
            <p className="text-slate-400 text-xs">إدارة مخازن الفروع والمواقع</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-9 px-4 text-sm rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          إضافة مخزن
        </Button>
      </div>

      {/* Table card */}
      <div
        className="bg-white overflow-hidden"
        style={{ border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
      >
        <Table>
          <TableHeader>
            <TableRow
              className="hover:bg-transparent"
              style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}
            >
              {["رقم", "إسم المخزن", "إسم 2", "الموقع", "ملحوظة", "الحالة", ""].map((h, i) => (
                <TableHead
                  key={i}
                  className={`text-[11px] font-semibold text-slate-500 py-3 ${i === 0 ? "px-5" : ""} ${i === 6 ? "w-12" : ""}`}
                  style={{ textAlign: "right" }}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j} className="py-3.5 px-4">
                      <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !warehouseList.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <Warehouse className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm mb-1.5">لا توجد مخازن مضافة بعد</p>
                  <button onClick={openCreate} className="text-sm text-indigo-600 hover:underline">
                    إضافة أول مخزن
                  </button>
                </TableCell>
              </TableRow>
            ) : warehouseList.map((w, idx) => (
              <TableRow
                key={w.id}
                className="cursor-pointer transition-colors hover:bg-indigo-50/30"
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  background: idx % 2 === 0 ? "#ffffff" : "#fafafa",
                }}
                onClick={() => openEdit(w)}
              >
                <TableCell className="py-1.5 px-5">
                  <span className="font-mono text-xs text-slate-500">{(w as any).code || "—"}</span>
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                      <Warehouse className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="font-medium text-sm text-slate-800">{w.name}</span>
                  </div>
                </TableCell>
                <TableCell className="py-1.5 text-slate-500 text-sm">{(w as any).name2 || "—"}</TableCell>
                <TableCell className="py-1.5 text-slate-500 text-sm">{getBranchName(w.branchId ?? null)}</TableCell>
                <TableCell className="py-1.5 text-slate-400 text-sm">{w.address || "—"}</TableCell>
                <TableCell className="py-1.5">
                  <Badge
                    variant={w.isActive ? "default" : "secondary"}
                    className={`text-[11px] rounded-full px-2.5 font-medium ${
                      w.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {w.isActive ? "نشط" : "غير نشط"}
                  </Badge>
                </TableCell>
                <TableCell className="py-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(w); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
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
