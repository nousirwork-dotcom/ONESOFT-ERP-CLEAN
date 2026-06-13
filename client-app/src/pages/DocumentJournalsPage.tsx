import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
  salesAccountId: string; cashAccountId: string; creditAccountId: string;
  taxAccountId: string; discountAccountId: string;
  issuanceJournalType: string; issuanceJournalBookId: string;
  issuanceInventoryDocType: string; issuanceInventoryDocBookId: string;
  allowUnpost: boolean; allowEditAfterPost: boolean;
  printPageSize: string; thermalPrint: boolean; thermalWidth: string;
  trackQuantity: boolean; noTax: boolean; salesmanStats: boolean;
  itemStats: boolean; customerSupplierStats: boolean;
  preventNegativeInventory: boolean; requireNote: boolean;
  preventEditIfLinked: boolean; requireCustomerCode: boolean; requireEmployeeCode: boolean;
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
  salesAccountId: "", cashAccountId: "", creditAccountId: "",
  taxAccountId: "", discountAccountId: "",
  issuanceJournalType: "", issuanceJournalBookId: "",
  issuanceInventoryDocType: "", issuanceInventoryDocBookId: "",
  allowUnpost: true, allowEditAfterPost: false,
  printPageSize: "A4", thermalPrint: false, thermalWidth: "80mm",
  trackQuantity: false, noTax: false, salesmanStats: false,
  itemStats: false, customerSupplierStats: false,
  preventNegativeInventory: false, requireNote: false,
  preventEditIfLinked: false, requireCustomerCode: false, requireEmployeeCode: false,
};

/* ── أنواع السندات (sales journal only) ── */
type PaymentTypeRow = { id: string; nameAr: string; nameEn: string; codeAr: string; codeEn: string; };
type AccountLinkRow = { id: string; description: string; postingName: string; accountId: number | null; postingSide: string; };
type PTC = { types: PaymentTypeRow[]; accountLinks: AccountLinkRow[]; };
const DEFAULT_PTC: PTC = {
  types: [
    { id: "1", nameAr: "نقدا",  nameEn: "نقدا",  codeAr: "نقدا",  codeEn: "cash"  },
    { id: "2", nameAr: "آجل",   nameEn: "آجل",   codeAr: "آجل",   codeEn: "cridt" },
  ],
  accountLinks: [],
};
function normalizePtConfig(raw: any): PTC {
  if (!raw) return DEFAULT_PTC;
  if (Array.isArray(raw.types)) return raw as PTC;
  return DEFAULT_PTC;
}

/* ── مكوّن بحث الحساب (مثل المخازن) ── */
const normalizeArDJ = (s: string) =>
  (s ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

function AccCodeSearch({
  allAccounts,
  selectedId,
  onChange,
}: {
  allAccounts: any[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}) {
  const selected = useMemo(() => allAccounts.find((a: any) => a.id === selectedId) ?? null, [allAccounts, selectedId]);
  const [q, setQ]     = useState(selected?.code ?? "");
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(selected?.code ?? ""); }, [selected?.code]);

  const filtered = useMemo(() => {
    const sq = normalizeArDJ(q.trim());
    if (!sq) return allAccounts.slice(0, 30);
    const codeFirst = allAccounts.filter((a: any) => normalizeArDJ(a.code ?? "").startsWith(sq));
    const rest      = allAccounts.filter((a: any) =>
      !normalizeArDJ(a.code ?? "").startsWith(sq) &&
      (normalizeArDJ(a.code ?? "").includes(sq) || normalizeArDJ(a.name ?? "").includes(sq))
    );
    return [...codeFirst, ...rest].slice(0, 30);
  }, [q, allAccounts]);

  useEffect(() => { setHi(0); }, [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (a: any) => { onChange(a.id); setQ(a.code ?? ""); setOpen(false); };
  const clear = () => { onChange(null); setQ(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setQ(selected?.code ?? ""); }
    else if ((e.key === "Enter" || e.key === "Tab") && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        value={open || !selected ? q : (selected?.code ?? "")}
        dir="ltr"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); if (selected) setQ(""); }}
        onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); setQ(selected?.code ?? ""); } }, 120)}
        onKeyDown={onKey}
        placeholder="كود..."
        className="h-5 w-full text-[10px] px-1.5 border-0 bg-transparent outline-none focus:bg-indigo-50 font-mono text-slate-700 placeholder:text-slate-300"
      />
      {open && (
        <div className="absolute top-full right-0 z-[9990] mt-0.5 w-72 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden" dir="rtl">
          <div className="overflow-y-auto max-h-48">
            <button
              onMouseDown={clear}
              className="w-full flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 transition-colors"
            >
              — بدون حساب —
            </button>
            {filtered.length === 0 && <div className="text-[11px] text-center text-slate-400 py-3">لا نتائج</div>}
            {filtered.map((a: any, idx: number) => (
              <button key={a.id} onMouseDown={() => pick(a)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] transition-colors ${idx === hi ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <span className="font-mono text-[10px] text-slate-400 w-16 text-left shrink-0">{a.code}</span>
                <span className="flex-1 text-right truncate text-slate-700">{a.name}</span>
              </button>
            ))}
          </div>
          <div className="px-2 py-1 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400">↑↓ تنقل · Enter اختيار</div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── FieldCodeSearch ──────────────── */
function FieldCodeSearch({
  allFields,
  selectedCode,
  onChange,
}: {
  allFields: any[];
  selectedCode: string;
  onChange: (code: string) => void;
}) {
  const selected = useMemo(() => allFields.find((f: any) => f.code === selectedCode) ?? null, [allFields, selectedCode]);
  const [q, setQ]     = useState(selectedCode);
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!open) setQ(selectedCode); }, [selectedCode, open]);

  const filtered = useMemo(() => {
    const sq = normalizeArDJ(q.trim());
    if (!sq) return allFields.slice(0, 40);
    const codeFirst = allFields.filter((f: any) => normalizeArDJ(f.code ?? "").startsWith(sq));
    const rest      = allFields.filter((f: any) =>
      !normalizeArDJ(f.code ?? "").startsWith(sq) &&
      (normalizeArDJ(f.code ?? "").includes(sq) ||
       normalizeArDJ(f.nameAr ?? "").includes(sq) ||
       normalizeArDJ(f.nameEn ?? "").includes(sq))
    );
    return [...codeFirst, ...rest].slice(0, 40);
  }, [q, allFields]);

  useEffect(() => { setHi(0); }, [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (f: any) => { onChange(f.code); setQ(f.code); setOpen(false); };
  const clear = () => { onChange(""); setQ(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setQ(selectedCode); }
    else if ((e.key === "Enter" || e.key === "Tab") && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="px-1.5 py-0.5">
        <input
          value={q}
          dir="ltr"
          onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => { setOpen(true); setQ(""); }}
          onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); setQ(selectedCode); } }, 120)}
          onKeyDown={onKey}
          placeholder="كود الحقل..."
          className="h-5 w-full text-[10px] px-1 border-0 bg-transparent outline-none focus:bg-indigo-50 font-mono text-slate-700 placeholder:text-slate-300 rounded"
        />
        {selected && (
          <div className="text-[9px] text-indigo-600 truncate px-1 leading-tight">{selected.nameAr}</div>
        )}
      </div>
      {open && (
        <div className="absolute top-full right-0 z-[9990] mt-0.5 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden" dir="rtl">
          <div className="overflow-y-auto max-h-52">
            <button onMouseDown={clear}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50 border-b border-slate-100">
              — بدون حقل —
            </button>
            {filtered.length === 0 && <div className="text-[11px] text-center text-slate-400 py-3">لا نتائج</div>}
            {filtered.map((f: any, idx: number) => (
              <button key={f.id} onMouseDown={() => pick(f)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors ${idx === hi ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <span className="font-mono text-[10px] text-slate-500 w-24 text-left shrink-0">{f.code}</span>
                <span className="flex-1 text-right truncate text-slate-700">{f.nameAr}</span>
                <span className="text-[9px] text-slate-400 shrink-0">{f.fieldType}</span>
              </button>
            ))}
          </div>
          <div className="px-2 py-1 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400">↑↓ تنقل · Enter اختيار · بحث بالكود أو الاسم</div>
        </div>
      )}
    </div>
  );
}

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
  const ic = (j as any).issuanceConfig ?? {};
  const oc = (j as any).optionsConfig  ?? {};
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
    salesAccountId:    (j as any).salesAccountId != null ? String((j as any).salesAccountId) : "",
    cashAccountId:     (j as any).cashAccountId  != null ? String((j as any).cashAccountId)  : "",
    creditAccountId:   (j as any).creditAccountId != null ? String((j as any).creditAccountId) : "",
    taxAccountId:      (j as any).taxAccountId   != null ? String((j as any).taxAccountId)   : "",
    discountAccountId: (j as any).discountAccountId != null ? String((j as any).discountAccountId) : "",
    issuanceJournalType:       ic.journalEntryType      ?? "",
    issuanceJournalBookId:     ic.journalBookId          ?? "",
    issuanceInventoryDocType:  ic.inventoryDocType       ?? "",
    issuanceInventoryDocBookId:ic.inventoryDocBookId     ?? "",
    allowUnpost:         (j as any).allowUnpost         ?? true,
    allowEditAfterPost:  (j as any).allowEditAfterPost  ?? false,
    printPageSize:       oc.printPageSize       ?? "A4",
    thermalPrint:        oc.thermalPrint        ?? false,
    thermalWidth:        oc.thermalWidth        ?? "80mm",
    trackQuantity:       oc.trackQuantity       ?? false,
    noTax:               oc.noTax               ?? false,
    salesmanStats:       oc.salesmanStats       ?? false,
    itemStats:           oc.itemStats           ?? false,
    customerSupplierStats: oc.customerSupplierStats ?? false,
    preventNegativeInventory: oc.preventNegativeInventory ?? false,
    requireNote:         oc.requireNote         ?? false,
    preventEditIfLinked: oc.preventEditIfLinked ?? false,
    requireCustomerCode: oc.requireCustomerCode ?? false,
    requireEmployeeCode: oc.requireEmployeeCode ?? false,
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
  const [activeTab, setActiveTab]       = useState<"basic" | "payment-types" | "issuance" | "options">("basic");

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
  const { data: chartAccounts = [] }   = trpc.accounts.list.useQuery();
  const { data: fieldDictList = [] }   = trpc.fieldDictionary.list.useQuery();

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
    setActiveTab("basic");
    setView("form");
  }, [selectedType]);

  const openEdit = useCallback((j: DBJournal) => {
    setEditId(j.id);
    setForm(dbToForm(j));
    setPtConfig(normalizePtConfig((j as any).paymentTypesConfig));
    setIsDirty(false);
    setActiveTab("basic");
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
      salesAccountId:    form.salesAccountId    ? parseInt(form.salesAccountId)    : null,
      cashAccountId:     form.cashAccountId     ? parseInt(form.cashAccountId)     : null,
      creditAccountId:   form.creditAccountId   ? parseInt(form.creditAccountId)   : null,
      taxAccountId:      form.taxAccountId      ? parseInt(form.taxAccountId)      : null,
      discountAccountId: form.discountAccountId ? parseInt(form.discountAccountId) : null,
      allowUnpost:       form.allowUnpost,
      allowEditAfterPost:form.allowEditAfterPost,
      issuanceConfig:    (form.issuanceJournalType || form.issuanceJournalBookId || form.issuanceInventoryDocType || form.issuanceInventoryDocBookId) ? {
        journalEntryType: form.issuanceJournalType      || null,
        journalBookId:    form.issuanceJournalBookId    || null,
        inventoryDocType: form.issuanceInventoryDocType || null,
        inventoryDocBookId: form.issuanceInventoryDocBookId || null,
      } : null,
      optionsConfig: {
        printPageSize:            form.printPageSize,
        thermalPrint:             form.thermalPrint,
        thermalWidth:             form.thermalWidth,
        trackQuantity:            form.trackQuantity,
        noTax:                    form.noTax,
        salesmanStats:            form.salesmanStats,
        itemStats:                form.itemStats,
        customerSupplierStats:    form.customerSupplierStats,
        preventNegativeInventory: form.preventNegativeInventory,
        requireNote:              form.requireNote,
        preventEditIfLinked:      form.preventEditIfLinked,
        requireCustomerCode:      form.requireCustomerCode,
        requireEmployeeCode:      form.requireEmployeeCode,
      },
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

            {/* ── Tabs Bar ── */}
            <div className="shrink-0 flex items-center gap-0 border-b border-slate-200 bg-white px-3" dir="rtl">
              {[
                { id: "basic", label: "البيانات الأساسية" },
                ...(selectedType === "sales" ? [{ id: "payment-types", label: "أنواع السندات" }] : []),
                { id: "issuance", label: "خصائص السندات المصدرة" },
                { id: "options",  label: "خيارات" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="relative px-4 py-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap"
                  style={{
                    color: activeTab === tab.id ? "#406B93" : "#64748b",
                    borderBottom: activeTab === tab.id ? "2px solid #406B93" : "2px solid transparent",
                    background: "transparent",
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 overflow-hidden">

            {/* ── TAB: البيانات الأساسية ── */}
            {activeTab === "basic" && (
            <div className="h-full overflow-y-auto p-4 space-y-3">

              {/* ── بيانات الدفتر ── */}
              <P title="البيانات الأساسية">
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
            )}

            {/* ── TAB: أنواع السندات ── */}
            {activeTab === "payment-types" && selectedType === "sales" && (() => {
              const thCls = "text-[10px] font-semibold text-slate-500 px-2 py-1.5 text-right bg-slate-50 border-b border-slate-200";
              const tdCls = "px-1.5 py-1 border-b border-slate-100";
              const cellInput = (val: string, onChange: (v: string) => void) => (
                <input value={val} onChange={e => onChange(e.target.value)}
                  className="w-full h-6 text-[11px] px-1.5 border border-slate-200 rounded bg-white focus:outline-none focus:border-indigo-400" />
              );
              const addType = () => {
                const newId = String(Date.now());
                setPtConfig(p => ({ ...p, types: [...p.types, { id: newId, nameAr: "", nameEn: "", codeAr: "", codeEn: "" }] }));
                setIsDirty(true);
              };
              const removeType = (idx: number) => {
                setPtConfig(p => ({ ...p, types: p.types.filter((_, i) => i !== idx) }));
                setIsDirty(true);
              };
              const patchType = (idx: number, patch: Partial<PaymentTypeRow>) => {
                setPtConfig(p => { const t = [...p.types]; t[idx] = { ...t[idx], ...patch }; return { ...p, types: t }; });
                setIsDirty(true);
              };
              const addLink = () => {
                const newId = String(Date.now());
                setPtConfig(p => ({ ...p, accountLinks: [...p.accountLinks, { id: newId, description: "", postingName: "", accountId: null, postingSide: "" }] }));
                setIsDirty(true);
              };
              const removeLink = (idx: number) => {
                setPtConfig(p => ({ ...p, accountLinks: p.accountLinks.filter((_, i) => i !== idx) }));
                setIsDirty(true);
              };
              const patchLink = (idx: number, patch: Partial<AccountLinkRow>) => {
                setPtConfig(p => { const a = [...p.accountLinks]; a[idx] = { ...a[idx], ...patch }; return { ...p, accountLinks: a }; });
                setIsDirty(true);
              };
              return (
                <div className="h-full overflow-y-auto p-4 space-y-4" dir="rtl">

                  {/* ─── جدول 1: النوع ─── */}
                  <P title="النوع">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thCls}>الاسم العربي</th>
                          <th className={thCls}>الاسم الإنجليزي</th>
                          <th className={thCls}>كود عربي</th>
                          <th className={thCls}>كود إنجليزي</th>
                          <th className="w-6 bg-slate-50 border-b border-slate-200"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ptConfig.types.map((row, i) => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                            <td className={tdCls}>{cellInput(row.nameAr, v => patchType(i, { nameAr: v }))}</td>
                            <td className={tdCls}>{cellInput(row.nameEn, v => patchType(i, { nameEn: v }))}</td>
                            <td className={tdCls}>{cellInput(row.codeAr, v => patchType(i, { codeAr: v }))}</td>
                            <td className={tdCls}>{cellInput(row.codeEn, v => patchType(i, { codeEn: v }))}</td>
                            <td className={`${tdCls} text-center`}>
                              <button onClick={() => removeType(i)}
                                className="w-5 h-5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 text-[13px] leading-none flex items-center justify-center">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} className="px-2 py-1.5">
                            <button onClick={addType}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              <span className="text-[14px] leading-none">+</span> إضافة نوع آخر
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </P>

                  {/* ─── جدول 2: الروابط المحاسبية ─── */}
                  <P title="الروابط المحاسبية">
                    <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead>
                        <tr style={{ background: "linear-gradient(to left, #f1f5f9, #eef2f7)" }}>
                          <th className={thCls} style={{ width: 28 }}>#</th>
                          <th className={thCls} style={{ width: "23%" }}>بيان<br/><span className="font-normal text-[9px] text-slate-400">Description</span></th>
                          <th className={thCls} style={{ width: "18%" }}>حقل المصدر<br/><span className="font-normal text-[9px] text-slate-400">Source Field</span></th>
                          <th className={thCls} style={{ width: 110, borderRight: "1px solid #e8edf3" }}>كود الحساب<br/><span className="font-normal text-[9px] text-slate-400">Account Code</span></th>
                          <th className={thCls}>اسم الحساب<br/><span className="font-normal text-[9px] text-slate-400">Account Name</span></th>
                          <th className={thCls} style={{ width: 100 }}>اتجاه القيد<br/><span className="font-normal text-[9px] text-slate-400">Posting Side</span></th>
                          <th className="w-6 bg-slate-50 border-b border-slate-200"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ptConfig.accountLinks.map((row, i) => {
                          const acct = (chartAccounts as any[]).find((a: any) => a.id === row.accountId);
                          const even = i % 2 === 0;
                          return (
                            <tr key={row.id}
                              style={{ background: even ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #f0f4f8" }}
                              className="hover:bg-indigo-50/20"
                            >
                              <td className="px-2 py-1 text-[11px] text-slate-400 text-center">{i + 1}</td>
                              <td className={tdCls}>{cellInput(row.description, v => patchLink(i, { description: v }))}</td>
                              <td className="py-0" style={{ borderRight: "1px solid #eef2f7", borderLeft: "1px solid #eef2f7" }}>
                                <FieldCodeSearch
                                  allFields={fieldDictList as any[]}
                                  selectedCode={row.postingName}
                                  onChange={v => patchLink(i, { postingName: v })}
                                />
                              </td>
                              <td className="py-0" style={{ borderRight: "1px solid #eef2f7", borderLeft: "1px solid #eef2f7" }}>
                                <AccCodeSearch
                                  allAccounts={chartAccounts as any[]}
                                  selectedId={row.accountId}
                                  onChange={v => patchLink(i, { accountId: v })}
                                />
                              </td>
                              <td className="px-2 py-1 text-[11px] text-slate-600 truncate" style={{ maxWidth: 160 }}>
                                {acct?.name ?? <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-0 px-1">
                                <select
                                  value={row.postingSide}
                                  onChange={e => patchLink(i, { postingSide: e.target.value })}
                                  className="w-full h-7 text-[11px] bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 cursor-pointer"
                                  style={{ direction: "rtl" }}
                                >
                                  <option value="">— اختر —</option>
                                  <option value="debit">مدين (Debit)</option>
                                  <option value="credit">دائن (Credit)</option>
                                </select>
                              </td>
                              <td className={`${tdCls} text-center`}>
                                <button onClick={() => removeLink(i)}
                                  className="w-5 h-5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 text-[13px] leading-none flex items-center justify-center">×</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={7} className="px-2 py-1.5">
                            <button onClick={addLink}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              <span className="text-[14px] leading-none">+</span> إضافة حساب
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </P>

                </div>
              );
            })()}

            {/* ── TAB: خصائص السندات المصدرة ── */}
            {activeTab === "issuance" && (
            <div className="h-full overflow-y-auto p-4 space-y-3" dir="rtl">

              {/* قسم 1: الروابط المحاسبية */}
              <P title="الروابط المحاسبية لنوع السند">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                  {([
                    ["إيرادات المبيعات",        "salesAccountId"],
                    ["ذمم العملاء (آجل)",       "creditAccountId"],
                    ["الصندوق / النقد",          "cashAccountId"],
                    ["ضريبة القيمة المضافة",     "taxAccountId"],
                    ["الخصم المنوح",             "discountAccountId"],
                  ] as [string, keyof JournalForm][]).map(([label, field]) => (
                    <R key={field} label={label} lw={145}>
                      <Select
                        value={String(form[field]) || "__none__"}
                        onValueChange={v => set(field, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-7 text-[11px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
                          <SelectValue placeholder="— بدون —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— بدون —</SelectItem>
                          {chartAccounts.map((a: any) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.code} — {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </R>
                  ))}
                </div>
              </P>

              {/* قسم 2: خصائص السندات المصدرة */}
              <P title="خصائص السندات المصدرة">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                  <R label="نوع القيد" lw={145}>
                    <FS value={form.issuanceJournalType} onValueChange={v => set("issuanceJournalType", v)}>
                      <SelectItem value="__none__">— اختر —</SelectItem>
                      {DOC_TYPES.filter(dt => ["journal_entry","sales_invoice","purchase_invoice","receipt_voucher","payment_voucher"].includes(dt.id))
                        .map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="دفتر القيد" lw={145}>
                    <FS value={form.issuanceJournalBookId} onValueChange={v => set("issuanceJournalBookId", v)}>
                      <SelectItem value="__none__">— اختر —</SelectItem>
                      {allJournals
                        .filter(j => !form.issuanceJournalType || j.docType === form.issuanceJournalType)
                        .map(j => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                    </FS>
                  </R>
                  <R label="نوع مستند المخزون" lw={145}>
                    <FS value={form.issuanceInventoryDocType} onValueChange={v => { set("issuanceInventoryDocType", v); set("issuanceInventoryDocBookId", ""); }}>
                      <SelectItem value="__none__">— اختر —</SelectItem>
                      {DOC_TYPES.filter(dt => ["stock_issue_items","stock_receipt_items","stock_transfer","stock_receipt","stock_issue"].includes(dt.id))
                        .map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="دفتر مستند المخزون" lw={145}>
                    <FS value={form.issuanceInventoryDocBookId} onValueChange={v => set("issuanceInventoryDocBookId", v)}>
                      <SelectItem value="__none__">— اختر —</SelectItem>
                      {allJournals
                        .filter(j => !form.issuanceInventoryDocType || j.docType === form.issuanceInventoryDocType)
                        .map(j => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                    </FS>
                  </R>
                </div>
              </P>

              {/* قسم 3: خيارات المستند */}
              <P title="خيارات المستند">
                <div className="space-y-2">
                  <CB label="السماح بفك الترحيل"              checked={form.allowUnpost}        onChange={v => set("allowUnpost", v)} />
                  <CB label="السماح بالتعديل بعد الترحيل"     checked={form.allowEditAfterPost}  onChange={v => set("allowEditAfterPost", v)} />
                </div>
              </P>

            </div>
            )}

            {/* ── TAB: خيارات ── */}
            {activeTab === "options" && (
            <div className="h-full overflow-y-auto p-4 space-y-3" dir="rtl">
              <P title="خيارات المستند">

                {/* سطر الطباعة */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-[11px] text-slate-500 font-medium shrink-0" style={{ width: 100 }}>نموذج الطباعة</span>
                  <FS value={form.printPageSize} onValueChange={v => set("printPageSize", v)} placeholder="نموذج الطباعة">
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </FS>
                  <CB label="طباعة حرارية" checked={form.thermalPrint} onChange={v => set("thermalPrint", v)} />
                  <div className="flex items-center gap-1.5">
                    <FI value={form.thermalWidth} onChange={v => set("thermalWidth", v)} placeholder="80mm" mono />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginBottom: 4 }}>
                  {/* صف الخيارات الأول */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-2.5">
                    <CB label="متابعة الكميات بالفواتير"  checked={form.trackQuantity}           onChange={v => set("trackQuantity", v)} />
                    <CB label="بدون ضريبة"                checked={form.noTax}                   onChange={v => set("noTax", v)} />
                    <CB label="إحصاءات للبائع"            checked={form.salesmanStats}           onChange={v => set("salesmanStats", v)} />
                    <CB label="إحصاءات للصنف"             checked={form.itemStats}               onChange={v => set("itemStats", v)} />
                    <CB label="إحصاءات عميل/مورد"         checked={form.customerSupplierStats}   onChange={v => set("customerSupplierStats", v)} />
                  </div>
                  {/* صف الخيارات الثاني */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <CB label="إمنع الصرف بدون رصيد مخزني" checked={form.preventNegativeInventory} onChange={v => set("preventNegativeInventory", v)} />
                    <CB label="يجب إدخال الملاحظة"           checked={form.requireNote}             onChange={v => set("requireNote", v)} />
                    <CB label="منع التعديل إذا كانت مرتبطة"  checked={form.preventEditIfLinked}     onChange={v => set("preventEditIfLinked", v)} />
                    <CB label="يجب إدخال كود العميل أو المورد" checked={form.requireCustomerCode}   onChange={v => set("requireCustomerCode", v)} />
                    <CB label="يجب إدخال كود الموظف"          checked={form.requireEmployeeCode}    onChange={v => set("requireEmployeeCode", v)} />
                  </div>
                </div>

              </P>
            </div>
            )}

            </div>
            {/* end Tab Content */}

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
