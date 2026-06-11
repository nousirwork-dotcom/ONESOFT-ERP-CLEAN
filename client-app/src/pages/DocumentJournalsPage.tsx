import { useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag,
  Plus, Save, Trash2, ChevronFirst, ChevronLast, RefreshCw,
  ChevronLeft as CLeft, ChevronRight as CRight, ArrowLeft, FileText, Eye,
  BookText, PackageMinus, PackagePlus, Users, Truck, Copy,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────── types ──────────────── */
type JournalForm = {
  nameAr: string; nameEn: string; fixedPart: string; docType: string;
  transferOwnership: boolean; userGroup: string; user: string; warehouse: string;
  systemOnly: boolean; autoSerial: boolean; firstNum: string; digits: string;
  lastNum: string; printTemplate: string; printTemplate2: string;
  printOnSave: boolean; status: string; postingMethod: string;
  resetFrequency: string;
  customersJournal: string; suppliersJournal: string;
};

type DBJournal = {
  id: number; orgId: number; docType: string; code: string;
  name: string; name2?: string | null; description?: string | null;
  numberPrefix: string; firstNumber: number; lastNumber: number;
  increment: number; numDigits: number; includeYear: boolean; currentSeq: number;
  warehouseId?: number | null; allowedUserGroup?: string | null; allowedUserId?: number | null;
  printTemplate?: string | null; printTemplate2?: string | null;
  resetFrequency?: string | null;
  autoSerial: boolean; printOnSave: boolean;
  isActive: boolean; sortOrder: number;
};

const EMPTY: JournalForm = {
  nameAr: "", nameEn: "", fixedPart: "", docType: "",
  transferOwnership: false, userGroup: "", user: "", warehouse: "",
  systemOnly: false, autoSerial: false, firstNum: "1", digits: "6",
  lastNum: "999999", printTemplate: "", printTemplate2: "",
  printOnSave: false, status: "ready", postingMethod: "normal",
  resetFrequency: "none",
  customersJournal: "", suppliersJournal: "",
};

/* ── أنواع السندات (sales journal only) ── */
type PTRow = {
  enabled: boolean;
  salesAccountId: number | null;
  cashAccountId: number | null;
  customerAccountId: number | null;
  taxAccountId: number | null;
  discountAccountId: number | null;
};
type PTC = { cash: PTRow; credit: PTRow };
const EMPTY_PT_ROW: PTRow = { enabled: false, salesAccountId: null, cashAccountId: null, customerAccountId: null, taxAccountId: null, discountAccountId: null };
const DEFAULT_PTC: PTC = { cash: { ...EMPTY_PT_ROW }, credit: { ...EMPTY_PT_ROW } };

/* ──────────────── document types ──────────────── */
const DOC_TYPES = [
  { id: "sales_invoice",    label: "فاتورة مبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales_return",     label: "مردود مبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchase_invoice", label: "فاتورة مشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purchase_return",  label: "مردود مشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "sales_order",      label: "أمر بيع",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales_quote",      label: "عرض سعر مبيعات",  icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase_order",   label: "أمر شراء",         icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "purchase_quote",   label: "عرض سعر مشتريات", icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "stock_transfer",      label: "سند تحويل مخزني",   icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "journal_entry",       label: "سند قيد",            icon: <BookText className="w-3.5 h-3.5" /> },
  { id: "stock_issue_items",   label: "سند صرف أصناف",      icon: <PackageMinus className="w-3.5 h-3.5" /> },
  { id: "stock_receipt_items", label: "سند توريد أصناف",    icon: <PackagePlus className="w-3.5 h-3.5" /> },
  { id: "customers_journal",   label: "دفتر العملاء",        icon: <Users className="w-3.5 h-3.5" /> },
  { id: "suppliers_journal",   label: "دفتر الموردين",       icon: <Truck className="w-3.5 h-3.5" /> },
  { id: "sales",               label: "sales",               icon: <BookOpen className="w-3.5 h-3.5" /> },
];

/* ──────────────── small atoms ──────────────── */
const FI = ({ value, onChange, placeholder, disabled, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; mono?: boolean;
}) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className={`h-7 text-[11px] px-2 border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded disabled:bg-slate-50 disabled:text-slate-400 ${mono ? "font-mono" : ""}`} />
);
const FS = ({ value, onValueChange, children, placeholder }: {
  value: string; onValueChange: (v: string) => void; children: React.ReactNode; placeholder?: string;
}) => (
  <Select value={value || "__none__"} onValueChange={v => onValueChange(v === "__none__" ? "" : v)}>
    <SelectTrigger className="h-7 text-[11px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
      <SelectValue placeholder={placeholder ?? "— اختر —"} />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);
const P = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="overflow-hidden" style={{ border: "1px solid #e8edf3", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
    <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: "linear-gradient(to left, #f8faff, #f3f6fb)", borderBottom: "1px solid #edf2f7" }}>
      <span className="font-semibold text-indigo-800 text-[12px]">{title}</span>
      {action}
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

/* ──────────────── helpers ──────────────── */
function dbToForm(j: DBJournal): JournalForm {
  return {
    nameAr:            j.name ?? "",
    nameEn:            j.name2 ?? "",
    fixedPart:         j.numberPrefix ?? "",
    docType:           j.docType ?? "",
    transferOwnership: false,
    userGroup:         j.allowedUserGroup ?? "",
    user:              j.allowedUserId != null ? String(j.allowedUserId) : "",
    warehouse:         j.warehouseId != null ? String(j.warehouseId) : "",
    systemOnly:        false,
    autoSerial:        j.autoSerial ?? false,
    firstNum:          String(j.firstNumber ?? 1),
    digits:            String(j.numDigits ?? 6),
    lastNum:           String(j.lastNumber ?? 999999),
    printTemplate:     j.printTemplate ?? "",
    printTemplate2:    j.printTemplate2 ?? "",
    printOnSave:       j.printOnSave ?? false,
    status:            "ready",
    postingMethod:     "normal",
    resetFrequency:    j.resetFrequency ?? "none",
    customersJournal:  (j as any).customersJournal ?? "",
    suppliersJournal:  (j as any).suppliersJournal ?? "",
  };
}

function buildPreview(fixedPart: string, firstNum: string, digits: string): string {
  const n = parseInt(firstNum) || 1;
  const d = parseInt(digits) || 6;
  return `${fixedPart}${String(n).padStart(d, "0")}`;
}

/* ──────────────── main component ──────────────── */
export default function DocumentJournalsPage() {
  const [selectedType, setSelectedType] = useState("sales_invoice");
  const [view, setView]       = useState<"list" | "form">("list");
  const [editId, setEditId]   = useState<number | null>(null);
  const [form, setForm]       = useState<JournalForm>({ ...EMPTY });
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);
  const [showReset, setShowReset]       = useState(false);
  const [ptConfig, setPtConfig]         = useState<PTC>(DEFAULT_PTC);

  /* ── queries ── */
  const listQuery = trpc.documentJournals.list.useQuery();
  const allJournals: DBJournal[] = (listQuery.data ?? []) as DBJournal[];
  const typeJournals = useMemo(() => allJournals.filter(j => j.docType === selectedType), [allJournals, selectedType]);

  const currentIndex = editId != null ? typeJournals.findIndex(j => j.id === editId) : -1;
  const currentDBJournal = editId != null ? allJournals.find(j => j.id === editId) : null;

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.listBasic.useQuery();
  const { data: templates }       = trpc.documentTemplates.list.useQuery({ docType: selectedType });
  const { data: custJournalsList }  = trpc.documentJournals.list.useQuery({ docType: "customers_journal" });
  const { data: suppJournalsList }  = trpc.documentJournals.list.useQuery({ docType: "suppliers_journal" });
  const { data: chartAccounts = [] } = trpc.accounts.list.useQuery();

  /* ── mutations ── */
  const createMut = trpc.documentJournals.create.useMutation({
    onSuccess: (row) => {
      toast.success("تم حفظ الدفتر ✓");
      listQuery.refetch();
      setEditId(row.id);
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.documentJournals.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الدفتر ✓");
      listQuery.refetch();
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.documentJournals.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الدفتر");
      listQuery.refetch();
      setView("list");
      setEditId(null);
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const resetMut = trpc.documentJournals.resetNumbering.useMutation({
    onSuccess: () => {
      toast.success("تم إعادة ضبط الترقيم ✓");
      listQuery.refetch();
      setShowReset(false);
    },
    onError: e => toast.error(e.message),
  });

  const set = <K extends keyof JournalForm>(k: K, v: JournalForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const currentType = DOC_TYPES.find(t => t.id === selectedType);

  const safeNavigate = useCallback((action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  }, [isDirty]);

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm({ ...EMPTY, docType: selectedType });
    setIsDirty(false);
    setPtConfig(DEFAULT_PTC);
    setView("form");
  }, [selectedType]);

  const openEdit = useCallback((j: DBJournal) => {
    setEditId(j.id);
    setForm(dbToForm(j));
    setPtConfig((j as any).paymentTypesConfig ?? DEFAULT_PTC);
    setIsDirty(false);
    setView("form");
  }, []);

  const handleSave = () => {
    if (!form.nameAr.trim()) { toast.error("إسم الدفتر بالعربي مطلوب"); return; }
    const payload = {
      docType:        form.docType || selectedType,
      code:           form.fixedPart.trim() || form.nameAr.slice(0, 20) || "JRN",
      name:           form.nameAr.trim(),
      name2:          form.nameEn.trim() || undefined,
      numberPrefix:   form.fixedPart.trim() || "INV",
      firstNumber:    parseInt(form.firstNum) || 1,
      lastNumber:     parseInt(form.lastNum) || 999999,
      increment:      1,
      numDigits:      parseInt(form.digits) || 6,
      includeYear:    false,
      warehouseId:    form.warehouse ? parseInt(form.warehouse) : null,
      allowedUserGroup: form.userGroup || null,
      allowedUserId:  form.user ? parseInt(form.user) : null,
      printTemplate:  form.printTemplate || null,
      printTemplate2: form.printTemplate2 || null,
      resetFrequency:   form.resetFrequency,
      autoSerial:       form.autoSerial,
      printOnSave:      form.printOnSave,
      customersJournal: (form.customersJournal && form.customersJournal !== "none") ? form.customersJournal : null,
      suppliersJournal: (form.suppliersJournal && form.suppliersJournal !== "none") ? form.suppliersJournal : null,
      paymentTypesConfig: selectedType === "sales" ? ptConfig : null,
      sortOrder:        0,
    };
    if (editId != null) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = () => deleteMut.mutate({ id: editId! });
  const handleResetNumbering = () => { if (editId != null) resetMut.mutate({ journalId: editId }); };

  const handleDuplicate = useCallback(() => {
    if (!editId) { toast.warning("اختر دفتراً أولاً ثم اضغط نسخة مماثلة"); return; }
    setForm(prev => ({
      ...prev,
      nameAr:    `نسخة من: ${prev.nameAr}`,
      nameEn:    prev.nameEn ? `Copy of ${prev.nameEn}` : "",
      fixedPart: prev.fixedPart ? `${prev.fixedPart}2` : "",
    }));
    setEditId(null);
    setIsDirty(true);
    setView("form");
    toast.success("تم نسخ الدفتر — راجع البيانات ثم احفظ");
  }, [editId]);

  /* ── Toolbar ── */
  const isBusy = createMut.isPending || updateMut.isPending || deleteMut.isPending;
  const toolbar = [
    { label: "حفظ",           icon: <Save className="w-3.5 h-3.5" />,  action: handleSave,       primary: true,  disabled: isBusy },
    { label: "جديد",          icon: <Plus className="w-3.5 h-3.5" />,  action: () => safeNavigate(openCreate) },
    { label: "نسخة مماثلة",   icon: <Copy className="w-3.5 h-3.5" />,  action: handleDuplicate,  disabled: !editId },
    { label: "الأخير", icon: <ChevronLast className="w-3.5 h-3.5" />,  action: () => typeJournals.at(-1) && safeNavigate(() => openEdit(typeJournals.at(-1)!)) },
    { label: "التالي", icon: <CLeft className="w-3.5 h-3.5" />,        action: () => currentIndex < typeJournals.length - 1 && safeNavigate(() => openEdit(typeJournals[currentIndex + 1])) },
    { label: "السابق", icon: <CRight className="w-3.5 h-3.5" />,       action: () => currentIndex > 0 && safeNavigate(() => openEdit(typeJournals[currentIndex - 1])) },
    { label: "الأول",  icon: <ChevronFirst className="w-3.5 h-3.5" />, action: () => typeJournals[0] && safeNavigate(() => openEdit(typeJournals[0])) },
    { label: "حذف",    icon: <Trash2 className="w-3.5 h-3.5" />,       action: () => editId && setShowDelete(true), danger: true, disabled: !editId },
    { label: "خروج",   icon: <ArrowLeft className="w-3.5 h-3.5" />,    action: () => safeNavigate(() => { setView("list"); setEditId(null); }) },
  ];

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className="flex h-full gap-0 overflow-hidden" dir="rtl">

      {/* ══ Type Sidebar ══ */}
      <div className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: 180, background: "#fff", borderLeft: "1px solid #e8edf3" }}>
        <div className="px-3 py-2 shrink-0"
          style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">نوع المستند</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DOC_TYPES.map(dt => {
            const active = selectedType === dt.id;
            const count  = allJournals.filter(j => j.docType === dt.id).length;
            return (
              <button key={dt.id}
                onClick={() => safeNavigate(() => { setSelectedType(dt.id); setView("list"); setEditId(null); })}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-right transition-colors"
                style={{
                  background: active ? "#dbeafe" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  borderRight: active ? "2px solid #3b82f6" : "2px solid transparent",
                }}>
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{dt.icon}</span>
                <span className="text-[11px] truncate flex-1">{dt.label}</span>
                {count > 0 && (
                  <span className="text-[9px] font-bold px-1 rounded-full shrink-0"
                    style={{ background: active ? "#bfdbfe" : "#f1f5f9", color: active ? "#1e40af" : "#64748b" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Main Area ══ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: "#f6f8fc" }}>

        {view === "list" ? (
          /* ─────────────── List View ─────────────── */
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-slate-700">دفاتر — {currentType?.label}</h2>
                  <p className="text-[10px] text-slate-400">{typeJournals.length} دفتر</p>
                </div>
              </div>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm transition-colors">
                <Plus className="w-3.5 h-3.5" /> دفتر جديد
              </button>
            </div>

            {listQuery.isLoading ? (
              <div className="text-center text-slate-400 text-[11px] py-12">جاري التحميل…</div>
            ) : typeJournals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
                <p className="text-[13px] font-medium text-slate-400">لا توجد دفاتر لـ {currentType?.label}</p>
                <p className="text-[11px] text-slate-300 mt-1">اضغط "دفتر جديد" لإضافة أول دفتر</p>
                <button onClick={openCreate}
                  className="mt-4 flex items-center gap-1.5 px-4 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm">
                  <Plus className="w-3.5 h-3.5" /> دفتر جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {typeJournals.map((j, idx) => (
                  <button key={j.id} onClick={() => openEdit(j)}
                    className="group flex flex-col items-start gap-1 p-3 rounded-lg bg-white text-right transition-all hover:shadow-md hover:border-indigo-200"
                    style={{ border: "1px solid #e8edf3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9px] font-bold text-slate-300">#{String(idx + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate group-hover:text-indigo-700">
                        {j.name || `دفتر ${currentType?.label} ${idx + 1}`}
                      </span>
                      {j.numberPrefix && (
                        <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {j.numberPrefix}
                        </span>
                      )}
                    </div>
                    {j.name2 && <span className="text-[10px] text-slate-400 truncate w-full" dir="ltr">{j.name2}</span>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">مستعد</span>
                      {j.autoSerial && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">تسلسل تلقائي</span>
                      )}
                      {j.currentSeq > 0 && (
                        <span className="text-[9px] text-slate-400">آخر رقم: {j.currentSeq}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ─────────────── Form View ─────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Form header */}
            <div className="flex items-center gap-2 px-4 py-2 shrink-0"
              style={{ borderBottom: "1px solid #e8edf3", background: "#fff" }}>
              <button onClick={() => safeNavigate(() => { setView("list"); setEditId(null); })}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                <ArrowLeft className="w-2.5 h-2.5" />
              </button>
              <span className="text-[12px] font-bold text-slate-600">
                {editId ? (form.nameAr || `دفتر ${currentType?.label}`) : `دفتر جديد — ${currentType?.label}`}
              </span>
              {editId && (
                <span className="text-[10px] text-slate-400">({currentIndex + 1} / {typeJournals.length})</span>
              )}
              {isDirty && <span className="text-[10px] text-amber-600 mr-auto">● تعديلات غير محفوظة</span>}
            </div>

            {/* Form content */}
            <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* ── بيانات الدفتر ── */}
              <P title="بيانات الدفتر">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نوع المستند">
                    <FS value={form.docType} onValueChange={v => set("docType", v)}>
                      <SelectItem value="__none__">— اختر —</SelectItem>
                      {DOC_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="الجزء الثابت">
                    <FI value={form.fixedPart} onChange={v => set("fixedPart", v)} placeholder="S01-" mono />
                  </R>
                  <R label="إسم عربي *">
                    <FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder={`دفتر ${currentType?.label}`} />
                  </R>
                  <R label="إسم إنجليزي">
                    <FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Journal Name in English" />
                  </R>
                  <div className="flex items-center col-span-2">
                    <CB label="نقل الملكية أوتوماتيكي" checked={form.transferOwnership} onChange={v => set("transferOwnership", v)} />
                  </div>
                </div>
              </P>

              {/* ── حدود الاستخدام + ربط العملاء والموردين (جنباً إلى جنب) ── */}
              <div className="grid grid-cols-2 gap-3">
                <P title="حدود الاستخدام">
                  <div className="grid grid-cols-1 gap-y-2">
                    <R label="مجموعة مستخدمين" lw={130}>
                      <FS value={form.userGroup} onValueChange={v => set("userGroup", v)}>
                        <SelectItem value="__none__">الكل</SelectItem>
                        {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </FS>
                    </R>
                    <R label="مستخدم" lw={130}>
                      <FS value={form.user} onValueChange={v => set("user", v)}>
                        <SelectItem value="__none__">الكل</SelectItem>
                        {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                      </FS>
                    </R>
                    <R label="مخزن" lw={130}>
                      <FS value={form.warehouse} onValueChange={v => set("warehouse", v)}>
                        <SelectItem value="__none__">الكل</SelectItem>
                        {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                      </FS>
                    </R>
                  </div>
                  <div className="mt-2">
                    <CB label="للمستندات التي يصدرها النظام فقط" checked={form.systemOnly} onChange={v => set("systemOnly", v)} />
                  </div>
                </P>

                <P title="ربط العملاء والموردين بالدفتر">
                  <div className="grid grid-cols-1 gap-y-2">
                    <R label="تكويد العملاء" lw={120}>
                      <FS value={form.customersJournal} onValueChange={v => set("customersJournal", v)}>
                        <SelectItem value="none">— بدون ربط —</SelectItem>
                        {(custJournalsList as any[] ?? []).map((j: any) => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                    <R label="تكويد الموردين" lw={120}>
                      <FS value={form.suppliersJournal} onValueChange={v => set("suppliersJournal", v)}>
                        <SelectItem value="none">— بدون ربط —</SelectItem>
                        {(suppJournalsList as any[] ?? []).map((j: any) => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                  </div>
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      يتم ربط الدفتر بدفاتر العملاء والموردين لتحديد نظام تكويد الأرقام عند إنشاء أو تعديل كارتات العملاء والموردين من خلال هذا الدفتر.
                    </p>
                  </div>
                </P>
              </div>

              {/* ── الأرقام والترقيم ── */}
              <P title="الأرقام والترقيم"
                action={
                  editId != null ? (
                    <button onClick={() => setShowReset(true)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
                      <RefreshCw className="w-3 h-3" /> إعادة ضبط
                    </button>
                  ) : null
                }
              >
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 items-center mb-3">
                  <div className="col-span-4">
                    <CB label="تسلسل أرقام أوتوماتيكي" checked={form.autoSerial} onChange={v => set("autoSerial", v)} />
                  </div>
                  <R label="أول رقم">
                    <FI value={form.firstNum} onChange={v => set("firstNum", v)} placeholder="1" mono />
                  </R>
                  <R label="عدد الخانات">
                    <FI value={form.digits} onChange={v => set("digits", v)} placeholder="6" mono />
                  </R>
                  <R label="آخر رقم">
                    <FI value={form.lastNum} onChange={v => set("lastNum", v)} placeholder="999999" mono />
                  </R>
                  <R label="آخر مستخدم">
                    <FI value={currentDBJournal ? String(currentDBJournal.currentSeq) : "0"} onChange={() => {}} disabled mono />
                  </R>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-center pt-2" style={{ borderTop: "1px solid #f1f5f9" }}>
                  <R label="إعادة الترقيم" lw={110}>
                    <FS value={form.resetFrequency} onValueChange={v => set("resetFrequency", v)}>
                      <SelectItem value="none">بدون إعادة</SelectItem>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="annual">سنوي</SelectItem>
                    </FS>
                  </R>
                  {/* معاينة الرقم */}
                  <div className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 shrink-0">معاينة:</span>
                    <span className="font-mono text-[13px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {buildPreview(form.fixedPart, form.firstNum, form.digits)}
                    </span>
                  </div>
                </div>
              </P>

              {/* ── خيارات الطباعة ── */}
              <div className="grid grid-cols-2 gap-3">
                <P title="نماذج الطباعة">
                  <div className="space-y-2">
                    <R label="النموذج الأساسي">
                      <FS value={form.printTemplate} onValueChange={v => set("printTemplate", v)} placeholder="— اختر نموذج —">
                        <SelectItem value="__none__">— بدون نموذج —</SelectItem>
                        {(templates ?? []).map(t => (
                          <SelectItem key={t.code} value={t.code}>
                            {t.code} — {t.nameAr}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                    <R label="النموذج الثانوي">
                      <FS value={form.printTemplate2} onValueChange={v => set("printTemplate2", v)} placeholder="— اختر نموذج —">
                        <SelectItem value="__none__">— بدون نموذج —</SelectItem>
                        {(templates ?? []).map(t => (
                          <SelectItem key={t.code} value={t.code}>
                            {t.code} — {t.nameAr}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                    <div className="flex items-center gap-4 mt-1">
                      <CB label="طباعة مع الحفظ" checked={form.printOnSave} onChange={v => set("printOnSave", v)} />
                      {(["ready", "pending"] as const).map((v, i) => (
                        <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                            checked={form.status === v} onChange={() => set("status", v)} />
                          <span className="text-[11px] text-slate-600">{["مستعد", "معلق"][i]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </P>

                <P title="أسلوب الترحيل">
                  <div className="space-y-2 mt-0.5">
                    {(["normal", "onSave", "immediate", "daily"] as const).map((v, idx) => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                          checked={form.postingMethod === v} onChange={() => set("postingMethod", v)} />
                        <span className="text-[11px] text-slate-600">
                          {["ترحيل طبيعي (يدوي)", "ترحيل مع الحفظ", "ترحيل فوري", "ترحيل يومي دفعة واحدة"][idx]}
                        </span>
                      </label>
                    ))}
                  </div>
                </P>
              </div>

            </div>

            {/* ── لوحة أنواع السندات (sales فقط) ── */}
            {selectedType === "sales" && (
              <div className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50" dir="rtl">
                <div className="px-3 py-2 border-b border-slate-200" style={{ background: "linear-gradient(to left,#f0f4ff,#e8f0fb)" }}>
                  <span className="text-[12px] font-bold text-indigo-800">أنواع السندات</span>
                </div>
                <div className="p-3 space-y-3">
                  {(["cash","credit"] as const).map(kind => {
                    const isCash = kind === "cash";
                    const row = ptConfig[kind];
                    const setRow = (patch: Partial<PTRow>) => {
                      setPtConfig(p => ({ ...p, [kind]: { ...p[kind], ...patch } }));
                      setIsDirty(true);
                    };
                    const acctPick = (label: string, val: number | null, key: keyof PTRow) => (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-slate-500 shrink-0" style={{ width: 110 }}>{label}</span>
                        <div className="flex-1 min-w-0">
                          <Select
                            value={val ? String(val) : "__none__"}
                            onValueChange={v => { setRow({ [key]: v === "__none__" ? null : parseInt(v) } as any); }}
                          >
                            <SelectTrigger className="h-6 text-[10px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
                              <SelectValue placeholder="— حساب —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— بدون —</SelectItem>
                              {chartAccounts.map((a: any) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {a.code} — {a.nameAr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                    return (
                      <div key={kind} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                        <div className={`flex items-center gap-2 px-3 py-2 border-b ${isCash ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                          <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                            checked={row.enabled} onChange={e => setRow({ enabled: e.target.checked })} />
                          <span className={`text-[12px] font-semibold ${isCash ? "text-emerald-800" : "text-blue-800"}`}>
                            {isCash ? "نقداً" : "آجل (ائتمان)"}
                          </span>
                        </div>
                        {row.enabled && (
                          <div className="p-2.5 space-y-1.5">
                            {acctPick("إيرادات المبيعات", row.salesAccountId, "salesAccountId")}
                            {isCash
                              ? acctPick("الصندوق / النقد", row.cashAccountId, "cashAccountId")
                              : acctPick("ذمم العملاء", row.customerAccountId, "customerAccountId")}
                            {acctPick("الخصم المنوح", row.discountAccountId, "discountAccountId")}
                            {acctPick("ضريبة القيمة المضافة", row.taxAccountId, "taxAccountId")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

            {/* ══ Sticky Toolbar ══ */}
            <div className="shrink-0 flex items-center gap-1 px-3"
              style={{ borderTop: "1px solid #e2e8f0", background: "#ffffff", boxShadow: "0 -2px 8px rgba(0,0,0,0.06)", height: 44 }}>
              {toolbar.map(({ label, icon, action, primary, danger, disabled: dis }: any) => (
                <button key={label} onClick={action} disabled={dis || isBusy}
                  className={[
                    "flex items-center gap-1 px-3 h-8 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed",
                    primary ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                      : danger ? "text-red-500 hover:bg-red-50 border border-red-200"
                        : "text-slate-600 hover:bg-slate-100 border border-slate-200",
                  ].join(" ")}>
                  <span className="w-3.5 h-3.5 flex">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
              {isDirty && <span className="text-[10px] text-amber-600 mr-auto flex items-center gap-1">● تعديلات غير محفوظة</span>}
            </div>
          </div>
        )}
      </div>

      {/* ══ Unsaved dialog ══ */}
      <Dialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-base">تعديلات غير محفوظة</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 text-right">يوجد تعديلات غير محفوظة، هل تريد الحفظ قبل المتابعة؟</p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setShowUnsaved(false); handleSave(); pendingAction?.(); setPendingAction(null); }}>
              حفظ
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setIsDirty(false); setShowUnsaved(false); pendingAction?.(); setPendingAction(null); }}>
              تجاهل
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setShowUnsaved(false); setPendingAction(null); }}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete dialog ══ */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-base">حذف الدفتر</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 text-right">
            هل تريد حذف دفتر <strong>{form.nameAr}</strong>؟ لا يمكن التراجع.
          </p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMut.isPending}>حذف</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Reset Numbering dialog ══ */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-orange-500" /> إعادة ضبط الترقيم
          </DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-slate-600 text-right">
              هل تريد إعادة ضبط ترقيم دفتر <strong>{form.nameAr}</strong>؟
            </p>
            <p className="text-[12px] text-slate-500 text-right">
              سيتم إعادة الرقم إلى البداية ({form.firstNum || "1"}) والرقم التالي الجديد سيكون:
            </p>
            <div className="text-center py-2">
              <span className="font-mono text-[18px] font-bold text-indigo-700 bg-indigo-50 px-4 py-1 rounded border border-indigo-200">
                {buildPreview(form.fixedPart, form.firstNum, form.digits)}
              </span>
            </div>
            <p className="text-[11px] text-orange-600 bg-orange-50 rounded p-2 text-right">
              ⚠ تأكد أن لا توجد فواتير مستخدمة بهذا الترقيم قبل إعادة الضبط
            </p>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={handleResetNumbering} disabled={resetMut.isPending}>
              <RefreshCw className="w-3.5 h-3.5 ml-1" /> إعادة الضبط
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowReset(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
