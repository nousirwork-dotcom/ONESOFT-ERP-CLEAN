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
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────── types ──────────────── */
type DoctypeForm = {
  docType: string;
  nameAr: string; nameEn: string; codeEn: string; codeAr: string;
  userGroup: string; user: string; warehouse: string; journal: string;
  systemOnly: boolean; entryType: string; entryJournal: string;
  stockDocType: string; stockJournal: string;
  printTemplate: string; printTemplate2: string;
  trackQty: boolean; noTax: boolean; sellerStats: boolean; itemStats: boolean; customerStats: boolean;
  noStockDispatch: boolean; requireNote: boolean; preventEditIfLinked: boolean;
  requireCustomerCode: boolean; requireEmployeeCode: boolean;
  acctDebit: string; acctCredit: string; acctDiscount: string;
  acctCash: string; acctTax: string;
};
type Doctype = { id: string; typeId: string } & DoctypeForm;

const EMPTY: DoctypeForm = {
  docType: "sales",
  nameAr: "", nameEn: "", codeEn: "", codeAr: "",
  userGroup: "", user: "", warehouse: "", journal: "", systemOnly: false,
  entryType: "", entryJournal: "", stockDocType: "", stockJournal: "",
  printTemplate: "", printTemplate2: "",
  trackQty: false, noTax: false, sellerStats: false, itemStats: false, customerStats: false,
  noStockDispatch: false, requireNote: false, preventEditIfLinked: false,
  requireCustomerCode: false, requireEmployeeCode: false,
  acctDebit: "", acctCredit: "", acctDiscount: "", acctCash: "", acctTax: "",
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
  { id: "transfer",       label: "سند تحويل مخزنى",  icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
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

/* ──────────────── AccountPicker ──────────────── */
function AccountPicker({
  value, onChange, placeholder = "— اختر حساب —",
}: { value: string; onChange: (id: string, name: string) => void; placeholder?: string }) {
  const [open, setOpen]       = useState(false);
  const [q,    setQ]          = useState("");
  const [label, setLabel]     = useState("");
  const ref                   = useRef<HTMLDivElement>(null);

  const { data: accounts = [] } = trpc.accounts.list.useQuery();

  useEffect(() => {
    if (value && accounts.length) {
      const found = (accounts as any[]).find((a: any) => String(a.id) === value);
      setLabel(found ? `${found.code} — ${found.name}` : value);
    } else if (!value) setLabel("");
  }, [value, accounts]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = (accounts as any[]).filter((a: any) =>
    !a.isParent && (
      a.code?.toLowerCase().includes(q.toLowerCase()) ||
      a.name?.toLowerCase().includes(q.toLowerCase())
    )
  ).slice(0, 60);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => { setOpen(v => !v); setQ(""); }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 28, padding: "0 8px", borderRadius: 6, cursor: "pointer",
          border: "1px solid #e2e8f0", background: value ? "#f0f9ff" : "#fff",
          fontSize: 11, color: value ? "#1d4ed8" : "#9ca3af",
          fontFamily: "'Cairo', Tahoma, sans-serif",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label || placeholder}
        </span>
        {value && (
          <X style={{ width: 12, height: 12, color: "#94a3b8", flexShrink: 0, marginRight: 4 }}
            onClick={e => { e.stopPropagation(); onChange("", ""); setLabel(""); }} />
        )}
        <Search style={{ width: 12, height: 12, color: "#94a3b8", flexShrink: 0 }} />
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 9999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 300,
        }}>
          <div style={{ padding: "8px 8px 4px" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#94a3b8" }} />
              <input
                autoFocus
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="بحث بالكود أو الاسم..."
                style={{
                  width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 6,
                  border: "1px solid #ddd", fontSize: 11, outline: "none",
                  fontFamily: "'Cairo', Tahoma, sans-serif", direction: "rtl",
                }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "12px 12px", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>لا توجد نتائج</div>
            )}
            {filtered.map((a: any) => (
              <div
                key={a.id}
                onClick={() => { onChange(String(a.id), `${a.code} — ${a.name}`); setLabel(`${a.code} — ${a.name}`); setOpen(false); }}
                style={{
                  padding: "6px 12px", cursor: "pointer", fontSize: 11,
                  background: String(a.id) === value ? "#eff6ff" : undefined,
                  color: String(a.id) === value ? "#1d4ed8" : "#374151",
                  display: "flex", alignItems: "center", gap: 8,
                  borderBottom: "1px solid #f8fafc",
                }}
                onMouseEnter={e => { if (String(a.id) !== value) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = String(a.id) === value ? "#eff6ff" : ""; }}
              >
                <span style={{ fontFamily: "monospace", color: "#6366f1", minWidth: 60, fontSize: 10 }}>{a.code}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              </div>
            ))}
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
  const [doctypes, setDoctypes]         = useState<Doctype[]>([]);
  const [view, setView]                 = useState<"list" | "form">("list");
  const [editId, setEditId]             = useState<string | null>(null);
  const [form, setForm]                 = useState<DoctypeForm>({ ...EMPTY });
  const [isDirty, setIsDirty]           = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.list.useQuery();

  const set = <K extends keyof DoctypeForm>(k: K, v: DoctypeForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const typeDoctypes   = doctypes.filter(d => d.typeId === selectedType);
  const currentIndex   = editId ? typeDoctypes.findIndex(d => d.id === editId) : -1;
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

  const openEdit = useCallback((d: Doctype) => {
    setEditId(d.id);
    setForm({
      docType: d.typeId,
      nameAr: d.nameAr, nameEn: d.nameEn, codeEn: d.codeEn, codeAr: d.codeAr,
      userGroup: d.userGroup, user: d.user, warehouse: d.warehouse,
      journal: d.journal, systemOnly: d.systemOnly,
      entryType: d.entryType, entryJournal: d.entryJournal,
      stockDocType: d.stockDocType, stockJournal: d.stockJournal,
      printTemplate: d.printTemplate, printTemplate2: d.printTemplate2,
      trackQty: d.trackQty, noTax: d.noTax, sellerStats: d.sellerStats,
      itemStats: d.itemStats, customerStats: d.customerStats,
      noStockDispatch: d.noStockDispatch, requireNote: d.requireNote,
      preventEditIfLinked: d.preventEditIfLinked,
      requireCustomerCode: d.requireCustomerCode, requireEmployeeCode: d.requireEmployeeCode,
      acctDebit: d.acctDebit, acctCredit: d.acctCredit, acctDiscount: d.acctDiscount,
      acctCash: d.acctCash, acctTax: d.acctTax,
    });
    setIsDirty(false);
    setView("form");
  }, []);

  const handleSave = () => {
    if (!form.nameAr.trim()) { toast.error("إسم نوع المستند مطلوب"); return; }
    const typeId = form.docType || selectedType;
    if (editId) {
      setDoctypes(prev => prev.map(d => d.id === editId ? { ...d, typeId, ...form } : d));
    } else {
      const id = newId();
      setDoctypes(prev => [...prev, { id, typeId, ...form }]);
      setEditId(id);
    }
    setIsDirty(false);
    toast.success("تم الحفظ بنجاح ✓");
  };

  const handleDelete = () => {
    setDoctypes(prev => prev.filter(d => d.id !== editId));
    setIsDirty(false);
    setView("list");
    setEditId(null);
    setShowDelete(false);
    toast.success("تم الحذف");
  };

  /* ── Toolbar ── */
  const toolbar = [
    { label: "حفظ",    icon: <Save className="w-3.5 h-3.5" />,         action: handleSave, primary: true },
    { label: "جديد",   icon: <Plus className="w-3.5 h-3.5" />,         action: () => safeNavigate(openCreate) },
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
                    <FI value={form.journal} onChange={v => set("journal", v)} placeholder="SAA" />
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

              <P title="الروابط المحاسبية">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  {([
                    ["acctDebit",    "مدين"],
                    ["acctCredit",   "دائن"],
                    ["acctDiscount", "تخفيض"],
                    ["acctCash",     "نقدى"],
                    ["acctTax",      "ضريبة"],
                  ] as [keyof DoctypeForm, string][]).map(([key, lbl]) => (
                    <R key={key} label={lbl}>
                      <AccountPicker
                        value={form[key] as string}
                        onChange={(id) => set(key, id as any)}
                      />
                    </R>
                  ))}
                </div>
              </P>

              <P title="خصائص السندات المصدرة">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نوع القيد">
                    <FS value={form.entryType} onValueChange={v => set("entryType", v)}>
                      <SelectItem value="sales">مبيعات</SelectItem>
                      <SelectItem value="purchase">مشتريات</SelectItem>
                      <SelectItem value="receipt">قبض</SelectItem>
                      <SelectItem value="payment">صرف</SelectItem>
                    </FS>
                  </R>
                  <R label="دفتر القيد">
                    <FI value={form.entryJournal} onChange={v => set("entryJournal", v)} placeholder="SJ3" />
                  </R>
                  <R label="نوع مستند المخزون">
                    <FS value={form.stockDocType} onValueChange={v => set("stockDocType", v)}>
                      <SelectItem value="sales">مبيعات</SelectItem>
                      <SelectItem value="purchase">مشتريات</SelectItem>
                      <SelectItem value="transfer">تحويل</SelectItem>
                    </FS>
                  </R>
                  <R label="دفتر مستند المخزون">
                    <FI value={form.stockJournal} onChange={v => set("stockJournal", v)} placeholder="SI3" />
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
              onClick={() => { setShowUnsaved(false); handleSave(); if (pendingAction) { pendingAction(); setPendingAction(null); } }}>
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
