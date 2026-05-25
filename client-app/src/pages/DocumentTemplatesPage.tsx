import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag,
  Plus, Save, Trash2, ChevronFirst, ChevronLast,
  ChevronLeft as CLeft, ChevronRight as CRight, FileText, Star,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────── types ──────────────── */
type TplForm = {
  code: string; nameAr: string; nameEn: string;
  paperSize: string; orientation: string;
  isDefault: boolean; notes: string;
};
type Tpl = { id: number; docType: string; sortOrder: number } & TplForm;

const EMPTY: TplForm = {
  code: "", nameAr: "", nameEn: "",
  paperSize: "A4", orientation: "portrait",
  isDefault: false, notes: "",
};

/* ──────────────── document categories ──────────────── */
const DOC_TYPES = [
  { id: "sales_invoice",    label: "فاتورة مبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales_return",     label: "مردود مبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchase_invoice", label: "فاتورة مشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purchase_return",  label: "مردود مشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "stock_receipt",    label: "إذن استلام مخزني", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "stock_issue",      label: "إذن صرف مخزني",    icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "stock_transfer",   label: "تحويل مخزني",      icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "receipt_voucher",  label: "سند قبض",           icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "payment_voucher",  label: "سند صرف",           icon: <Tag className="w-3.5 h-3.5" /> },
];

/* ──────────────── small atoms ──────────────── */
const FI = ({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className="h-7 text-[11px] px-2 border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded disabled:bg-slate-50 disabled:text-slate-400" />
);
const FS = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-7 text-[11px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
      <SelectValue placeholder="— اختر —" />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);
const P = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="overflow-hidden" style={{ border: "1px solid #e8edf3", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
    <div className="px-3 py-1.5" style={{ background: "linear-gradient(to left, #f8faff, #f3f6fb)", borderBottom: "1px solid #edf2f7" }}>
      <span className="font-semibold text-indigo-800 text-[12px]">{title}</span>
    </div>
    <div className="px-3 py-2.5" style={{ background: "#fff" }}>{children}</div>
  </div>
);
const R = ({ label, lw = 100, children }: { label: string; lw?: number; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-[11px] text-slate-500 font-medium shrink-0" style={{ width: lw }}>{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);
const CB = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-1.5 cursor-pointer select-none">
    <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="text-[11px] text-slate-600">{label}</span>
  </label>
);

/* ──────────────── main component ──────────────── */
export default function DocumentTemplatesPage() {
  const [selectedType, setSelectedType] = useState("sales_invoice");
  const [view, setView]                 = useState<"list" | "form">("list");
  const [editId, setEditId]             = useState<number | null>(null);
  const [form, setForm]                 = useState<TplForm>({ ...EMPTY });
  const [isDirty, setIsDirty]           = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);

  const listQuery = trpc.documentTemplates.list.useQuery({ docType: selectedType });
  const templates: Tpl[] = (listQuery.data ?? []) as Tpl[];

  const createMut = trpc.documentTemplates.create.useMutation({
    onSuccess: () => { toast.success("تم حفظ النموذج"); listQuery.refetch(); setIsDirty(false); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.documentTemplates.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث النموذج"); listQuery.refetch(); setIsDirty(false); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.documentTemplates.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف النموذج"); listQuery.refetch(); setView("list"); setEditId(null); },
    onError: e => toast.error(e.message),
  });

  const set = <K extends keyof TplForm>(k: K, v: TplForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const guardDirty = useCallback((action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  }, [isDirty]);

  const openNew = useCallback(() => {
    guardDirty(() => {
      setForm({ ...EMPTY });
      setEditId(null);
      setIsDirty(false);
      setView("form");
    });
  }, [guardDirty]);

  const openEdit = useCallback((t: Tpl) => {
    guardDirty(() => {
      setForm({
        code: t.code ?? "",
        nameAr: t.nameAr ?? "",
        nameEn: t.nameEn ?? "",
        paperSize: t.paperSize ?? "A4",
        orientation: t.orientation ?? "portrait",
        isDefault: t.isDefault ?? false,
        notes: t.notes ?? "",
      });
      setEditId(t.id);
      setIsDirty(false);
      setView("form");
    });
  }, [guardDirty]);

  const handleSave = () => {
    if (!form.code.trim()) { toast.error("رقم النموذج مطلوب"); return; }
    if (!form.nameAr.trim()) { toast.error("اسم النموذج مطلوب"); return; }
    if (editId !== null) {
      updateMut.mutate({ id: editId, ...form, docType: selectedType });
    } else {
      createMut.mutate({ ...form, docType: selectedType });
    }
  };

  const handleDelete = () => {
    if (editId !== null) deleteMut.mutate({ id: editId });
    setShowDelete(false);
  };

  const currentIdx = editId !== null ? templates.findIndex(t => t.id === editId) : -1;
  const gotoIdx = (idx: number) => { if (templates[idx]) openEdit(templates[idx]); };

  const selectType = (id: string) => guardDirty(() => { setSelectedType(id); setView("list"); setEditId(null); setIsDirty(false); });

  const currentTypeMeta = DOC_TYPES.find(d => d.id === selectedType);

  return (
    <div className="flex h-full overflow-hidden" dir="rtl">
      {/* ── Sidebar ── */}
      <div className="w-44 shrink-0 border-l border-slate-200 bg-gradient-to-b from-slate-50 to-white overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">نماذج المستندات</span>
        </div>
        {DOC_TYPES.map(dt => (
          <button key={dt.id} onClick={() => selectType(dt.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] transition-colors text-right ${
              selectedType === dt.id
                ? "bg-indigo-600 text-white font-semibold"
                : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
            }`}>
            <span className={selectedType === dt.id ? "text-white" : "text-slate-400"}>{dt.icon}</span>
            <span className="leading-tight">{dt.label}</span>
          </button>
        ))}
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-white shrink-0">
          <span className="text-[11px] font-semibold text-slate-700 ml-2">{currentTypeMeta?.label}</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-green-700 hover:bg-green-50" onClick={handleSave} disabled={!isDirty || createMut.isPending || updateMut.isPending}>
            <Save className="w-3.5 h-3.5" /> حفظ
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-indigo-700 hover:bg-indigo-50" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" /> جديد
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:bg-red-50" onClick={() => { if (editId !== null) setShowDelete(true); }} disabled={editId === null}>
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </Button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100" onClick={() => gotoIdx(0)} disabled={currentIdx <= 0 && view === "form"}><ChevronLast className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100" onClick={() => gotoIdx(currentIdx - 1)} disabled={currentIdx <= 0}><CRight className="w-3.5 h-3.5" /></Button>
          <span className="text-[10px] text-slate-500 w-12 text-center">
            {view === "form" && currentIdx >= 0 ? `${currentIdx + 1}/${templates.length}` : `0/${templates.length}`}
          </span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100" onClick={() => gotoIdx(currentIdx + 1)} disabled={currentIdx >= templates.length - 1}><CLeft className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100" onClick={() => gotoIdx(templates.length - 1)} disabled={currentIdx >= templates.length - 1}><ChevronFirst className="w-3.5 h-3.5" /></Button>
        </div>

        {/* Content */}
        {view === "list" ? (
          <div className="flex-1 overflow-y-auto p-3">
            {listQuery.isLoading ? (
              <div className="text-center text-slate-400 text-[11px] py-8">جاري التحميل…</div>
            ) : templates.length === 0 ? (
              <div className="text-center text-slate-400 text-[11px] py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                لا توجد نماذج لـ {currentTypeMeta?.label}
                <br />
                <button onClick={openNew} className="mt-2 text-indigo-600 hover:underline text-[11px]">+ إضافة نموذج جديد</button>
              </div>
            ) : (
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 w-24">رقم النموذج</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">اسم النموذج</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 w-20">حجم الورق</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 w-20">الاتجاه</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 w-16">افتراضي</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => (
                    <tr key={t.id} onClick={() => openEdit(t)}
                      className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors">
                      <td className="px-3 py-1.5 font-mono text-indigo-700">{t.code}</td>
                      <td className="px-3 py-1.5 text-slate-800">{t.nameAr}</td>
                      <td className="px-3 py-1.5 text-slate-500">{t.paperSize}</td>
                      <td className="px-3 py-1.5 text-slate-500">{t.orientation === "portrait" ? "عمودي" : "أفقي"}</td>
                      <td className="px-3 py-1.5 text-center">{t.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 mx-auto" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <P title="بيانات النموذج">
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                <R label="رقم النموذج *">
                  <FI value={form.code} onChange={v => set("code", v)} placeholder="T001" />
                </R>
                <R label="اسم النموذج *">
                  <FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder="نموذج الفاتورة الرئيسي" />
                </R>
                <R label="الاسم الإنجليزي">
                  <FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Invoice Template" />
                </R>
                <R label="نوع المستند">
                  <FI value={currentTypeMeta?.label ?? ""} onChange={() => {}} disabled />
                </R>
                <R label="حجم الورق">
                  <FS value={form.paperSize} onValueChange={v => set("paperSize", v)}>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="Letter">Letter</SelectItem>
                    <SelectItem value="Legal">Legal</SelectItem>
                    <SelectItem value="Thermal80">حراري 80mm</SelectItem>
                    <SelectItem value="Thermal58">حراري 58mm</SelectItem>
                  </FS>
                </R>
                <R label="الاتجاه">
                  <FS value={form.orientation} onValueChange={v => set("orientation", v)}>
                    <SelectItem value="portrait">عمودي (Portrait)</SelectItem>
                    <SelectItem value="landscape">أفقي (Landscape)</SelectItem>
                  </FS>
                </R>
                <div className="col-span-2">
                  <CB label="نموذج افتراضي لهذا النوع" checked={form.isDefault} onChange={v => set("isDefault", v)} />
                </div>
              </div>
            </P>
            <P title="ملاحظات">
              <textarea
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder="وصف النموذج أو ملاحظات…"
                rows={3}
                className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded resize-none focus:outline-none focus:border-indigo-400 bg-white"
              />
            </P>
          </div>
        )}
      </div>

      {/* ── Unsaved Dialog ── */}
      <Dialog open={showUnsaved} onOpenChange={open => { if (!open) { setShowUnsaved(false); setPendingAction(null); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm">تغييرات غير محفوظة</DialogTitle></DialogHeader>
          <p className="text-[12px] text-slate-500 py-1">يوجد تغييرات غير محفوظة، هل تريد الاستمرار بدون حفظ؟</p>
          <DialogFooter className="gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={() => { handleSave(); setShowUnsaved(false); }}>حفظ أولاً</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setIsDirty(false); setShowUnsaved(false); pendingAction?.(); setPendingAction(null); }}>تجاهل التعديلات</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowUnsaved(false); setPendingAction(null); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm">تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-[12px] text-slate-500 py-1">هل تريد حذف هذا النموذج؟</p>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleDelete}>حذف</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
