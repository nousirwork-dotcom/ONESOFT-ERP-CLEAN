import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag,
  Plus, Save, Trash2, ChevronFirst, ChevronLast,
  ChevronLeft as CLeft, ChevronRight as CRight, ArrowLeft, FileText, Search, X, Link2,
  BookText, PackageMinus, PackagePlus, Copy,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────── types ──────────────── */
type DoctypeForm = {
  docType: string;
  nameAr: string; nameEn: string; codeEn: string; codeAr: string;
  userGroup: string; user: string; warehouse: string; journal: string;
  customersJournal: string; suppliersJournal: string;
  systemOnly: boolean; entryType: string; entryJournal: string;
  stockDocType: string; stockJournal: string;
  printTemplate: string; printTemplate2: string;
  trackQty: boolean; noTax: boolean; sellerStats: boolean; itemStats: boolean; customerStats: boolean;
  noStockDispatch: boolean; requireNote: boolean; preventEditIfLinked: boolean;
  requireCustomerCode: boolean; requireEmployeeCode: boolean;
  acctDebit: string; acctCredit: string; acctDiscount: string;
  acctCash: string; acctTax: string;
  salesAccountId: number | null;
  cashAccountId: number | null;
  creditAccountId: number | null;
  taxAccountId: number | null;
  discountAccountId: number | null;
  purchaseAccountId: number | null;
  supplierAccountId: number | null;
};
type Doctype = { id: string; typeId: string } & DoctypeForm;

const EMPTY: DoctypeForm = {
  docType: "sales",
  nameAr: "", nameEn: "", codeEn: "", codeAr: "",
  userGroup: "", user: "", warehouse: "", journal: "", customersJournal: "", suppliersJournal: "", systemOnly: false,
  entryType: "", entryJournal: "", stockDocType: "", stockJournal: "",
  printTemplate: "", printTemplate2: "",
  trackQty: false, noTax: false, sellerStats: false, itemStats: false, customerStats: false,
  noStockDispatch: false, requireNote: false, preventEditIfLinked: false,
  requireCustomerCode: false, requireEmployeeCode: false,
  acctDebit: "", acctCredit: "", acctDiscount: "", acctCash: "", acctTax: "",
  salesAccountId: null, cashAccountId: null, creditAccountId: null,
  taxAccountId: null, discountAccountId: null, purchaseAccountId: null, supplierAccountId: null,
};

/* ──────────────── document categories ──────────────── */
const DOC_TYPES = [
  { id: "sales",          label: "فاتورة مبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales-return",   label: "مردود مبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchases",      label: "فاتورة مشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purch-return",   label: "مردود مشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "sales-order",    label: "امر بيع",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales-quote",    label: "عرض سعر مبيعات",   icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase-order", label: "امر شراء",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "purch-quote",    label: "عرض سعر مشتريات",  icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "transfer",             label: "سند تحويل مخزنى",   icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "journal-entry",        label: "سند قيد",            icon: <BookText className="w-3.5 h-3.5" /> },
  { id: "stock-issue-items",    label: "سند صرف أصناف",      icon: <PackageMinus className="w-3.5 h-3.5" /> },
  { id: "stock-receipt-items",  label: "سند توريد أصناف",    icon: <PackagePlus className="w-3.5 h-3.5" /> },
];

/* ──────────────── small atoms ──────────────── */
const FI = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="h-7 text-[11px] px-2 border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded" />
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
  <div style={{ border: "1px solid #e8edf3", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "visible" }}>
    <div className="px-3 py-1.5" style={{ background: "linear-gradient(to left, #f8faff, #f3f6fb)", borderBottom: "1px solid #edf2f7", borderRadius: "6px 6px 0 0" }}>
      <span className="font-semibold text-indigo-800 text-[12px]">{title}</span>
    </div>
    <div className="px-3 py-2.5" style={{ background: "#fff", borderRadius: "0 0 6px 6px" }}>{children}</div>
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

/* ──────────────── AccSel — منتقي حساب من دليل الحسابات ──────────────── */
function AccSel({ value, onChange, accounts }: {
  value: number | null;
  onChange: (v: number | null) => void;
  accounts: any[];
}) {
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      style={{
        width: "100%", height: 28, fontSize: 11, paddingInline: 8,
        border: "1px solid #e2e8f0", borderRadius: 6,
        background: value ? "#f0f9ff" : "#fff",
        color: value ? "#1d4ed8" : "#6b7280",
        fontFamily: "'Cairo', Tahoma, sans-serif",
        direction: "rtl", textAlign: "right",
        outline: "none",
      }}
    >
      <option value="">— بدون —</option>
      {accounts.map((a: any) => (
        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
      ))}
    </select>
  );
}

/* ──────────────── AccountPicker — روابط المخزن المختار ──────────────── */
function AccountPicker({
  value, onChange, placeholder = "— اختر —",
  links = [], noWarehouse = false,
}: {
  value: string; onChange: (id: string) => void; placeholder?: string;
  links?: any[]; noWarehouse?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* ── إغلاق عند الضغط خارجه ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = links.find((l: any) => String(l.id) === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>

      {/* ── حقل الاختيار ── */}
      <div
        onClick={() => { if (!noWarehouse) setOpen(v => !v); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 28, padding: "0 8px", borderRadius: 6,
          cursor: noWarehouse ? "not-allowed" : "pointer",
          border: "1px solid #e2e8f0",
          background: noWarehouse ? "#f8fafc" : selected ? "#f0f9ff" : "#fff",
          fontSize: 11,
          fontFamily: "'Cairo', Tahoma, sans-serif",
          opacity: noWarehouse ? 0.55 : 1,
        }}
      >
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: selected ? "#1d4ed8" : "#9ca3af",
        }}>
          {noWarehouse
            ? "اختر مخزناً أولاً"
            : selected
              ? `${selected.label}${selected.accountCode ? `  (${selected.accountCode})` : ""}`
              : placeholder}
        </span>
        {selected && !noWarehouse && (
          <X
            style={{ width: 11, height: 11, color: "#94a3b8", flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); onChange(""); }}
          />
        )}
        {!noWarehouse && (
          <Link2 style={{ width: 11, height: 11, color: "#94a3b8", flexShrink: 0 }} />
        )}
      </div>

      {/* ── الـ dropdown ── */}
      {open && !noWarehouse && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 9999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
          boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
          minWidth: 380, maxWidth: 480,
          fontFamily: "'Cairo', Tahoma, sans-serif",
          direction: "rtl", overflow: "hidden",
        }}>
          {/* رأس */}
          <div style={{
            padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#64748b",
            borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
            display: "flex", gap: 12,
          }}>
            <span style={{ flex: 1 }}>البيان</span>
            <span style={{ width: 72, flexShrink: 0, textAlign: "center" }}>كود الحساب</span>
            <span style={{ width: 130, flexShrink: 0 }}>اسم الحساب</span>
          </div>
          {/* صفوف */}
          <div style={{ overflowY: "auto", maxHeight: 240 }}>
            {links.length === 0 && (
              <div style={{ padding: 14, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                لا توجد روابط محاسبية لهذا المخزن
              </div>
            )}
            {links.map((l: any) => {
              const isSel = String(l.id) === value;
              return (
                <div
                  key={l.id}
                  onClick={() => { onChange(String(l.id)); setOpen(false); }}
                  style={{
                    padding: "7px 12px", cursor: "pointer", fontSize: 11,
                    background: isSel ? "#eff6ff" : undefined,
                    borderBottom: "1px solid #f8fafc",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSel ? "#eff6ff" : ""; }}
                >
                  <span style={{
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: isSel ? "#1d4ed8" : "#1e293b", fontWeight: isSel ? 600 : 400,
                  }}>{l.label}</span>
                  <span style={{
                    width: 72, flexShrink: 0, textAlign: "center",
                    fontFamily: "monospace", fontSize: 10, color: "#6366f1", fontWeight: 600,
                  }}>{l.accountCode || "—"}</span>
                  <span style={{
                    width: 130, flexShrink: 0, fontSize: 10, color: "#64748b",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{l.accountName || "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

let _nextId = 1;
const newId = () => String(_nextId++);

/* ──────────────── main component ──────────────── */
export default function DocumentTypesPage() {
  const [selectedType, setSelectedType] = useState("sales");
  const [view, setView]                 = useState<"list" | "form">("list");
  const [editId, setEditId]             = useState<number | null>(null);
  const [form, setForm]                 = useState<DoctypeForm>({ ...EMPTY });
  const [isDirty, setIsDirty]           = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);

  const utils = trpc.useUtils();
  const { data: dbDoctypes = [] } = trpc.documentTypes.list.useQuery();
  const createMut  = trpc.documentTypes.create.useMutation({ onSuccess: () => utils.documentTypes.list.invalidate() });
  const updateMut  = trpc.documentTypes.update.useMutation({ onSuccess: () => utils.documentTypes.list.invalidate() });
  const deleteMut  = trpc.documentTypes.delete.useMutation({ onSuccess: () => utils.documentTypes.list.invalidate() });

  const { data: warehousesList }  = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.list.useQuery();
  const { data: acctLinks = [] }  = trpc.warehouses.accountLinks.listAll.useQuery();
  const { data: chartAccounts = [] } = trpc.accounts.list.useQuery();
  const { data: journalsList = [] } = trpc.documentJournals.list.useQuery();
  const { data: salesInvoiceJournals = [] }    = trpc.documentJournals.list.useQuery({ docType: "sales_invoice" });
  const { data: journalEntryJournals = [] }    = trpc.documentJournals.list.useQuery({ docType: "journal_entry" });
  const { data: stockIssueItemsJournals = [] } = trpc.documentJournals.list.useQuery({ docType: "stock_issue_items" });
  const { data: customersJournalsList = [] }   = trpc.documentJournals.list.useQuery({ docType: "customers_journal" });
  const { data: suppliersJournalsList = [] }   = trpc.documentJournals.list.useQuery({ docType: "suppliers_journal" });
  const { data: journalEntryTypes = [] }    = trpc.documentTypes.list.useQuery({ typeId: "journal-entry" });
  const { data: stockIssueItemsTypes = [] } = trpc.documentTypes.list.useQuery({ typeId: "stock-issue-items" });

  const doctypes = dbDoctypes as any[];

  const set = <K extends keyof DoctypeForm>(k: K, v: DoctypeForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const typeDoctypes   = doctypes.filter((d: any) => d.typeId === selectedType);
  const currentIndex   = editId ? typeDoctypes.findIndex((d: any) => d.id === editId) : -1;
  const currentType    = DOC_TYPES.find(t => t.id === selectedType);

  const safeNavigate = (action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  };

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm({ ...EMPTY, docType: selectedType });
    setIsDirty(false);
    setView("form");
  }, [selectedType]);

  const openEdit = useCallback((d: any) => {
    setEditId(d.id);
    setForm({
      docType: d.typeId,
      nameAr: d.nameAr ?? "", nameEn: d.nameEn ?? "", codeEn: d.codeEn ?? "", codeAr: d.codeAr ?? "",
      userGroup: d.userGroup ?? "", user: d.user_ ?? "", warehouse: d.warehouse ?? "",
      journal: d.journal ?? "", customersJournal: d.customersJournal ?? "", suppliersJournal: d.suppliersJournal ?? "", systemOnly: d.systemOnly ?? false,
      entryType: d.entryType ?? "", entryJournal: d.entryJournal ?? "",
      stockDocType: d.stockDocType ?? "", stockJournal: d.stockJournal ?? "",
      printTemplate: d.printTemplate ?? "", printTemplate2: d.printTemplate2 ?? "",
      trackQty: d.trackQty ?? false, noTax: d.noTax ?? false, sellerStats: d.sellerStats ?? false,
      itemStats: d.itemStats ?? false, customerStats: d.customerStats ?? false,
      noStockDispatch: d.noStockDispatch ?? false, requireNote: d.requireNote ?? false,
      preventEditIfLinked: d.preventEditIfLinked ?? false,
      requireCustomerCode: d.requireCustomerCode ?? false, requireEmployeeCode: d.requireEmployeeCode ?? false,
      acctDebit: d.acctDebit ?? "", acctCredit: d.acctCredit ?? "", acctDiscount: d.acctDiscount ?? "",
      acctCash: d.acctCash ?? "", acctTax: d.acctTax ?? "",
      salesAccountId: d.salesAccountId ?? null,
      cashAccountId: d.cashAccountId ?? null,
      creditAccountId: d.creditAccountId ?? null,
      taxAccountId: d.taxAccountId ?? null,
      discountAccountId: d.discountAccountId ?? null,
      purchaseAccountId: d.purchaseAccountId ?? null,
      supplierAccountId: d.supplierAccountId ?? null,
    });
    setIsDirty(false);
    setView("form");
  }, []);

  const handleSave = async () => {
    if (!form.nameAr.trim()) { toast.error("إسم نوع المستند مطلوب"); return; }
    const typeId = form.docType || selectedType;
    const payload = {
      typeId,
      nameAr: form.nameAr, nameEn: form.nameEn || undefined, codeEn: form.codeEn || undefined, codeAr: form.codeAr || undefined,
      docType: form.docType || undefined, userGroup: form.userGroup || undefined,
      user_: form.user || undefined, warehouse: form.warehouse || undefined,
      journal: form.journal || undefined, customersJournal: form.customersJournal || undefined, suppliersJournal: form.suppliersJournal || undefined, systemOnly: form.systemOnly,
      entryType: form.entryType || undefined, entryJournal: form.entryJournal || undefined,
      stockDocType: form.stockDocType || undefined, stockJournal: form.stockJournal || undefined,
      printTemplate: form.printTemplate || undefined, printTemplate2: form.printTemplate2 || undefined,
      trackQty: form.trackQty, noTax: form.noTax, sellerStats: form.sellerStats,
      itemStats: form.itemStats, customerStats: form.customerStats,
      noStockDispatch: form.noStockDispatch, requireNote: form.requireNote,
      preventEditIfLinked: form.preventEditIfLinked,
      requireCustomerCode: form.requireCustomerCode, requireEmployeeCode: form.requireEmployeeCode,
      acctDebit: form.acctDebit || undefined, acctCredit: form.acctCredit || undefined,
      acctDiscount: form.acctDiscount || undefined, acctCash: form.acctCash || undefined,
      acctTax: form.acctTax || undefined,
      salesAccountId: form.salesAccountId ?? undefined,
      cashAccountId: form.cashAccountId ?? undefined,
      creditAccountId: form.creditAccountId ?? undefined,
      taxAccountId: form.taxAccountId ?? undefined,
      discountAccountId: form.discountAccountId ?? undefined,
      purchaseAccountId: form.purchaseAccountId ?? undefined,
      supplierAccountId: form.supplierAccountId ?? undefined,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...payload });
        setIsDirty(false);
        toast.success("تم الحفظ بنجاح ✓");
      } else {
        const row = await createMut.mutateAsync(payload);
        setIsDirty(false);
        toast.success("تم الحفظ بنجاح ✓");
        setSelectedType(typeId);
        setEditId(null);
        setView("list");
      }
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    try {
      await deleteMut.mutateAsync({ id: editId });
    } catch {}
    setIsDirty(false);
    setView("list");
    setEditId(null);
    setShowDelete(false);
    toast.success("تم الحذف");
  };

  /* ── Toolbar ── */
  const handleDuplicate = useCallback(() => {
    if (!editId) { toast.warning("اختر نوعاً أولاً ثم اضغط نسخة مماثلة"); return; }
    setForm(prev => ({
      ...prev,
      nameAr: `نسخة من: ${prev.nameAr}`,
      nameEn: prev.nameEn ? `Copy of ${prev.nameEn}` : "",
      codeEn: prev.codeEn ? `${prev.codeEn}2` : "",
      codeAr: prev.codeAr ? `${prev.codeAr}2` : "",
    }));
    setEditId(null);
    setIsDirty(true);
    setView("form");
    toast.success("تم نسخ النوع — راجع البيانات ثم احفظ");
  }, [editId]);

  const toolbar = [
    { label: "حفظ",           icon: <Save className="w-3.5 h-3.5" />, action: handleSave,      primary: true },
    { label: "جديد",          icon: <Plus className="w-3.5 h-3.5" />, action: () => safeNavigate(openCreate) },
    { label: "نسخة مماثلة",   icon: <Copy className="w-3.5 h-3.5" />, action: handleDuplicate, disabled: !editId },
    { label: "الأخير", icon: <ChevronLast className="w-3.5 h-3.5" />,  action: () => typeDoctypes.at(-1) && safeNavigate(() => openEdit(typeDoctypes.at(-1)!)) },
    { label: "التالي", icon: <CLeft className="w-3.5 h-3.5" />,        action: () => currentIndex < typeDoctypes.length - 1 && safeNavigate(() => openEdit(typeDoctypes[currentIndex + 1])) },
    { label: "السابق", icon: <CRight className="w-3.5 h-3.5" />,       action: () => currentIndex > 0 && safeNavigate(() => openEdit(typeDoctypes[currentIndex - 1])) },
    { label: "الأول",  icon: <ChevronFirst className="w-3.5 h-3.5" />, action: () => typeDoctypes[0] && safeNavigate(() => openEdit(typeDoctypes[0])) },
    { label: "حذف",    icon: <Trash2 className="w-3.5 h-3.5" />,       action: () => editId && setShowDelete(true), danger: true },
    { label: "خروج",   icon: <ArrowLeft className="w-3.5 h-3.5" />,    action: () => safeNavigate(() => { setView("list"); setEditId(null); }) },
  ];

  /* ───────────────────── RENDER ───────────────────── */
  return (
    <div className="flex h-full gap-0 overflow-hidden" dir="rtl">

      {/* ══ Type Sidebar ══ */}
      <div
        className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: 180, background: "#fff", borderLeft: "1px solid #e8edf3", borderRadius: "6px 0 0 6px" }}
      >
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">نوع المستند</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DOC_TYPES.map(dt => {
            const active = selectedType === dt.id;
            const count  = doctypes.filter(d => d.typeId === dt.id).length;
            return (
              <button
                key={dt.id}
                onClick={() => safeNavigate(() => { setSelectedType(dt.id); setView("list"); setEditId(null); })}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-right transition-colors"
                style={{
                  background: active ? "#dbeafe" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  borderRight: active ? "2px solid #3b82f6" : "2px solid transparent",
                }}
              >
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{dt.icon}</span>
                <span className="text-[11px] truncate flex-1">{dt.label}</span>
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1 rounded-full shrink-0"
                    style={{ background: active ? "#bfdbfe" : "#f1f5f9", color: active ? "#1e40af" : "#64748b" }}
                  >{count}</span>
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
                  <h2 className="text-[14px] font-bold text-slate-700">
                    أنواع — {currentType?.label}
                  </h2>
                  <p className="text-[10px] text-slate-400">{typeDoctypes.length} نوع</p>
                </div>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                نوع جديد
              </button>
            </div>

            {typeDoctypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
                <p className="text-[13px] font-medium text-slate-400">لا توجد أنواع لـ {currentType?.label}</p>
                <p className="text-[11px] text-slate-300 mt-1">اضغط "نوع جديد" لإضافة أول نوع مستند</p>
                <button
                  onClick={openCreate}
                  className="mt-4 flex items-center gap-1.5 px-4 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> نوع جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {typeDoctypes.map((d, idx) => (
                  <button
                    key={d.id}
                    onClick={() => openEdit(d)}
                    className="group flex flex-col items-start gap-1 p-3 rounded-lg bg-white text-right transition-all hover:shadow-md hover:border-indigo-200"
                    style={{ border: "1px solid #e8edf3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9px] font-bold text-slate-300">#{String(idx + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate group-hover:text-indigo-700">
                        {d.nameAr || `نوع ${currentType?.label} ${idx + 1}`}
                      </span>
                      {d.codeEn && (
                        <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {d.codeEn}
                        </span>
                      )}
                    </div>
                    {d.nameEn && (
                      <span className="text-[10px] text-slate-400 truncate w-full" dir="ltr">{d.nameEn}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {d.trackQty && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">متابعة الكميات</span>}
                      {d.noTax    && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">بدون ضريبة</span>}
                      {d.sellerStats && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">إحصاءات بائع</span>}
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
            <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid #e8edf3", background: "#fff" }}>
              <button
                onClick={() => safeNavigate(() => { setView("list"); setEditId(null); })}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
              >
                <ArrowLeft className="w-2.5 h-2.5" />
              </button>
              <span className="text-[12px] font-bold text-slate-600">
                {editId
                  ? (form.nameAr || `نوع ${currentType?.label}`)
                  : `نوع جديد — ${currentType?.label}`}
              </span>
              {editId && (
                <span className="text-[10px] text-slate-400">
                  ({currentIndex + 1} / {typeDoctypes.length})
                </span>
              )}
              {isDirty && (
                <span className="text-[10px] text-amber-600 mr-auto">● تعديلات غير محفوظة</span>
              )}
            </div>

            {/* Form content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              <P title="بيانات نوع المستند">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نوع المستند *" lw={100}>
                    <FS value={form.docType} onValueChange={v => set("docType", v)}>
                      {DOC_TYPES.map(dt => (
                        <SelectItem key={dt.id} value={dt.id}>
                          <span className="flex items-center gap-1.5">{dt.icon}{dt.label}</span>
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                  <div />
                  <R label="إسم عربي *">
                    <FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder={`نوع ${currentType?.label}`} />
                  </R>
                  <R label="إسم إنجليزي">
                    <FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Document Type Name" />
                  </R>
                  <R label="كود إنجليزي">
                    <FI value={form.codeEn} onChange={v => set("codeEn", v)} placeholder="CASH" />
                  </R>
                  <R label="كود عربي">
                    <FI value={form.codeAr} onChange={v => set("codeAr", v)} placeholder="نقدا" />
                  </R>
                </div>
              </P>

              <P title="حدود الاستخدام">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="مجموعة مستخدمين" lw={120}>
                    <FS value={form.userGroup} onValueChange={v => set("userGroup", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="مستخدم">
                    <FS value={form.user} onValueChange={v => set("user", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="دفتر المستندات">
                    <FS value={form.journal} onValueChange={v => set("journal", v)}>
                      <SelectItem value="none">— بدون دفتر —</SelectItem>
                      {(salesInvoiceJournals as any[]).map((j: any) => (
                        <SelectItem key={j.id} value={String(j.id)}>
                          {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                  <R label="مخزن">
                    <FS value={form.warehouse} onValueChange={v => set("warehouse", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                    </FS>
                  </R>
                </div>
                <div className="mt-2">
                  <CB label="للمستندات التي يصدرها النظام فقط" checked={form.systemOnly} onChange={v => set("systemOnly", v)} />
                </div>
              </P>

              <P title="الروابط المحاسبية لنوع السند">
                {(() => {
                  const accs = (chartAccounts as any[]).filter((a: any) => !a.isParent && a.allowPosting !== false);
                  const isSales = ["sales","sales-return"].includes(form.docType);
                  const isPurch = ["purchases","purch-return"].includes(form.docType);
                  return (
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                      {(isSales || (!isSales && !isPurch)) && (
                        <R label="إيرادات المبيعات" lw={120}>
                          <AccSel value={form.salesAccountId} onChange={v => set("salesAccountId", v)} accounts={accs} />
                        </R>
                      )}
                      {(isSales || (!isSales && !isPurch)) && (
                        <R label="ذمم العملاء (آجل)" lw={120}>
                          <AccSel value={form.creditAccountId} onChange={v => set("creditAccountId", v)} accounts={accs} />
                        </R>
                      )}
                      {(isPurch || (!isSales && !isPurch)) && (
                        <R label="حساب المشتريات" lw={120}>
                          <AccSel value={form.purchaseAccountId} onChange={v => set("purchaseAccountId", v)} accounts={accs} />
                        </R>
                      )}
                      {(isPurch || (!isSales && !isPurch)) && (
                        <R label="ذمم الموردين (آجل)" lw={120}>
                          <AccSel value={form.supplierAccountId} onChange={v => set("supplierAccountId", v)} accounts={accs} />
                        </R>
                      )}
                      <R label="الصندوق / النقد" lw={120}>
                        <AccSel value={form.cashAccountId} onChange={v => set("cashAccountId", v)} accounts={accs} />
                      </R>
                      <R label="ضريبة القيمة المضافة" lw={120}>
                        <AccSel value={form.taxAccountId} onChange={v => set("taxAccountId", v)} accounts={accs} />
                      </R>
                      <R label="الخصم الممنوح" lw={120}>
                        <AccSel value={form.discountAccountId} onChange={v => set("discountAccountId", v)} accounts={accs} />
                      </R>
                    </div>
                  );
                })()}
              </P>

              <P title="خصائص السندات المصدرة">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نوع القيد">
                    <FS value={form.entryType} onValueChange={v => set("entryType", v)}>
                      <SelectItem value="__none__">— بدون —</SelectItem>
                      {(journalEntryTypes as any[]).map((dt: any) => (
                        <SelectItem key={dt.id} value={String(dt.id)}>
                          {dt.codeAr ? `${dt.codeAr} — ${dt.nameAr}` : dt.nameAr}
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                  <R label="دفتر القيد">
                    <FS value={form.entryJournal} onValueChange={v => set("entryJournal", v)}>
                      <SelectItem value="__none__">— بدون —</SelectItem>
                      {(journalEntryJournals as any[]).map((j: any) => (
                        <SelectItem key={j.id} value={String(j.id)}>
                          {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                  <R label="نوع مستند المخزون">
                    <FS value={form.stockDocType} onValueChange={v => set("stockDocType", v)}>
                      <SelectItem value="__none__">— بدون —</SelectItem>
                      {(stockIssueItemsTypes as any[]).map((dt: any) => (
                        <SelectItem key={dt.id} value={String(dt.id)}>
                          {dt.codeAr ? `${dt.codeAr} — ${dt.nameAr}` : dt.nameAr}
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                  <R label="دفتر مستند المخزون">
                    <FS value={form.stockJournal} onValueChange={v => set("stockJournal", v)}>
                      <SelectItem value="__none__">— بدون —</SelectItem>
                      {(stockIssueItemsJournals as any[]).map((j: any) => (
                        <SelectItem key={j.id} value={String(j.id)}>
                          {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                        </SelectItem>
                      ))}
                    </FS>
                  </R>
                </div>
              </P>

              <P title="خيارات المستند">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نموذج الطباعة">
                    <FI value={form.printTemplate} onChange={v => set("printTemplate", v)} placeholder="نموذج A4" />
                  </R>
                  <R label="طباعة حرارية">
                    <FI value={form.printTemplate2} onChange={v => set("printTemplate2", v)} placeholder="80mm" />
                  </R>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                  {([
                    ["trackQty",      "متابعة الكميات بالفواتير"],
                    ["noTax",         "بدون ضريبة"],
                    ["sellerStats",   "إحصاءات للبائع"],
                    ["itemStats",     "إحصاءات للصنف"],
                    ["customerStats", "إحصاءات عميل/مورد"],
                  ] as [keyof DoctypeForm, string][]).map(([key, lbl]) => (
                    <CB key={key} label={lbl} checked={!!form[key]} onChange={v => set(key, v as any)} />
                  ))}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #e2e8f0" }}>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {([
                      ["noStockDispatch",      "إمنع الصرف بدون رصيد مخزنى"],
                      ["requireNote",          "يجب ادخال الملحوظة"],
                      ["preventEditIfLinked",  "منع التعديل اذا كانت مرتبطة"],
                      ["requireCustomerCode",  "يجب ادخال كود العميل او المورد"],
                      ["requireEmployeeCode",  "يجب ادخال كود الموظف"],
                    ] as [keyof DoctypeForm, string][]).map(([key, lbl]) => (
                      <CB key={key} label={lbl} checked={!!form[key]} onChange={v => set(key, v as any)} />
                    ))}
                  </div>
                </div>
              </P>

            </div>

            {/* ══ Sticky Toolbar ══ */}
            <div
              className="shrink-0 flex items-center gap-1 px-3"
              style={{
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
                height: 44,
              }}
            >
              {toolbar.map(({ label, icon, action, primary, danger }: any) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={label === "حذف" && !editId}
                  className={[
                    "flex items-center gap-1 px-3 h-8 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed",
                    primary ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                      : danger ? "text-red-500 hover:bg-red-50 border border-red-200"
                        : "text-slate-600 hover:bg-slate-100 border border-slate-200",
                  ].join(" ")}
                >
                  <span className="w-3.5 h-3.5 flex">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
              {isDirty && (
                <span className="text-[10px] text-amber-600 mr-auto flex items-center gap-1">
                  ● تعديلات غير محفوظة
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ Unsaved dialog ══ */}
      <Dialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">تعديلات غير محفوظة</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-right">يوجد تعديلات غير محفوظة، هل تريد الحفظ قبل المتابعة؟</p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={async () => { setShowUnsaved(false); await handleSave(); if (pendingAction) { pendingAction(); setPendingAction(null); } }}>
              حفظ
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setIsDirty(false); setShowUnsaved(false); if (pendingAction) { pendingAction(); setPendingAction(null); } }}>
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
          <DialogHeader>
            <DialogTitle className="text-right text-base">حذف نوع المستند</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-right">
            هل تريد حذف <strong>{form.nameAr}</strong>؟ لا يمكن التراجع.
          </p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>حذف</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
