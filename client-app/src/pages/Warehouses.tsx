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
  BookOpen, FileText, ChevronDown,
  RotateCcw, ClipboardList, ArrowLeftRight, Package, BookMarked, Tag,
  Minimize2, Maximize2,
} from "lucide-react";
import { useEffect, useState, useRef, useMemo, createContext, useContext } from "react";
import { toast } from "sonner";

/* ─────────────────────────── density context ─────────────────────── */
const Density = createContext<"compact" | "comfortable">("comfortable");

/* ─────────────────────────── constants ─────────────────────────── */
const DEFAULT_LINKS = [
  "حساب المخزون", "حساب تكلفة مبيعات 1", "حساب تكلفة مبيعات 2",
  "حساب الصندوق", "حساب البنك",
  "حساب مبيعات 1", "حساب مبيعات 2", "حساب مبيعات 3",
  "حساب مبيعات 4", "حساب مبيعات 5",
  "حساب مشتريات 1", "حساب مشتريات 2", "حساب مشتريات 3", "حساب مشتريات 4",
  "حساب أخرى 1",  "حساب أخرى 2",  "حساب أخرى 3",  "حساب أخرى 4",  "حساب أخرى 5",
  "حساب أخرى 6",  "حساب أخرى 7",  "حساب أخرى 8",  "حساب أخرى 9",  "حساب أخرى 10",
  "حساب أخرى 11", "حساب أخرى 12", "حساب أخرى 13", "حساب أخرى 14", "حساب أخرى 15",
  "مركز التكلفة 1", "مركز التكلفة 2", "مركز التكلفة 3", "مركز التكلفة 4", "مركز التكلفة 5",
].map((label, i) => ({ label, accountId: "" as string, sortOrder: i }));

type LinkRow = { label: string; accountId: string; sortOrder: number };

type JournalData = {
  nameAr: string; nameEn: string; docType: string; fixedPart: string;
  transferOwnership: boolean; userGroup: string; user: string; warehouse: string;
  systemOnly: boolean; autoSerial: boolean; firstNum: string; digits: string;
  lastNum: string; printTemplate: string; printTemplate2: string;
  printOnSave: boolean; status: string; postingMethod: string;
};
const EMPTY_JOURNAL: JournalData = {
  nameAr: "", nameEn: "", docType: "", fixedPart: "",
  transferOwnership: false, userGroup: "", user: "", warehouse: "",
  systemOnly: false, autoSerial: false, firstNum: "1", digits: "7",
  lastNum: "9999999", printTemplate: "", printTemplate2: "",
  printOnSave: false, status: "ready", postingMethod: "normal",
};

type DoctypeData = {
  nameAr: string; nameEn: string; docType: string; codeEn: string; codeAr: string;
  userGroup: string; user: string; warehouse: string; journal: string;
  systemOnly: boolean; entryType: string; entryJournal: string;
  stockDocType: string; stockJournal: string; printTemplate: string; printTemplate2: string;
  trackQty: boolean; noTax: boolean; sellerStats: boolean; itemStats: boolean; customerStats: boolean;
};
const EMPTY_DOCTYPE: DoctypeData = {
  nameAr: "", nameEn: "", docType: "", codeEn: "", codeAr: "",
  userGroup: "", user: "", warehouse: "", journal: "", systemOnly: false,
  entryType: "", entryJournal: "", stockDocType: "", stockJournal: "",
  printTemplate: "", printTemplate2: "", trackQty: false, noTax: false,
  sellerStats: false, itemStats: false, customerStats: false,
};

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
}: { title: string; children: React.ReactNode; action?: React.ReactNode }) => {
  const c = useContext(Density) === "compact";
  return (
    <div
      className="bg-white overflow-hidden"
      style={{ border: "1px solid #e2e8f0", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
    >
      <div
        className={`flex items-center justify-between ${c ? "px-2.5 py-0.5" : "px-4 py-2.5"}`}
        style={{ borderBottom: "1px solid #f1f5f9", background: c ? "#f8fafc" : undefined }}
      >
        <span className="font-semibold text-indigo-700" style={{ fontSize: c ? 11 : 14 }}>
          {title}
        </span>
        {action}
      </div>
      <div className={c ? "p-1.5" : "p-4"}>{children}</div>
    </div>
  );
};

/** Label + child stacked (kept for legacy/tabs) */
const Field = ({
  label, children, span = 1,
}: { label: string; children: React.ReactNode; span?: number }) => {
  const c = useContext(Density) === "compact";
  return (
    <div className={span === 4 ? "col-span-4" : span === 3 ? "col-span-3" : span === 2 ? "col-span-2" : ""}>
      <Label className={`block font-medium text-slate-500 ${c ? "text-[10px] mb-0.5" : "text-xs mb-1"}`}>
        {label}
      </Label>
      {children}
    </div>
  );
};

/** Horizontal field — label to the right, input to the left (RTL) */
const HF = ({
  label, children, full = false, lw,
}: { label: string; children: React.ReactNode; full?: boolean; lw?: number }) => {
  const c = useContext(Density) === "compact";
  const w = lw ?? (c ? 46 : 76);
  return (
    <div className={`flex items-center gap-1.5${full ? (c ? " col-span-3" : " col-span-2") : ""}`}>
      <span
        className={`shrink-0 text-right ${c ? "text-[10px]" : "text-xs"} text-slate-500 font-medium`}
        style={{ width: w }}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

/** Input — height adapts to density */
const FI = ({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const c = useContext(Density) === "compact";
  return (
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${c ? "h-5 text-[10px] px-1.5 py-0" : "h-9 text-sm"} border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded`}
    />
  );
};

/** Select — height adapts to density */
const FS = ({
  value, onValueChange, placeholder, children,
}: { value: string; onValueChange: (v: string) => void; placeholder?: string; children: React.ReactNode }) => {
  const c = useContext(Density) === "compact";
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`${c ? "h-5 text-[10px] px-1.5 py-0" : "h-9 text-sm"} border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded`}>
        <SelectValue placeholder={placeholder ?? "— اختر —"} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
};

/** ERP compact section panel — رأس رمادي + محتوى أبيض */
const P = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const c = useContext(Density) === "compact";
  return (
    <div className="overflow-hidden" style={{ border: "1px solid #d1d5db", borderRadius: 4 }}>
      <div className={`${c ? "px-1.5 py-px" : "px-2.5 py-1"}`} style={{ background: "#e8edf5", borderBottom: "1px solid #d1d5db" }}>
        <span className={`font-bold text-slate-700 ${c ? "text-[10px]" : "text-[11px]"}`}>{title}</span>
      </div>
      <div className={`${c ? "px-1.5 py-1" : "px-3 py-2"}`} style={{ background: "#fff" }}>{children}</div>
    </div>
  );
};

/** Inline label-right + input-left row (RTL) */
const R = ({ label, lw = 88, children }: { label: string; lw?: number; children: React.ReactNode }) => {
  const c = useContext(Density) === "compact";
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className={`${c ? "text-[10px]" : "text-[11px]"} text-slate-600 shrink-0`} style={{ width: c ? 64 : lw }}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

/** Compact checkbox */
const CB = ({ label, checked, onChange }: { label: string; checked?: boolean; onChange?: (v: boolean) => void }) => {
  const c = useContext(Density) === "compact";
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
      <input type="checkbox" className={`${c ? "w-3 h-3" : "w-3.5 h-3.5"} accent-indigo-600`}
        checked={checked} onChange={onChange ? e => onChange(e.target.checked) : undefined} />
      <span className={`${c ? "text-[10px]" : "text-[11px]"} text-slate-600`}>{label}</span>
    </label>
  );
};

/** Compact radio */
const RB = ({ name, label, checked, onChange }: { name: string; label: string; checked?: boolean; onChange?: () => void }) => {
  const c = useContext(Density) === "compact";
  return (
    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
      <input type="radio" name={name} className={`${c ? "w-3 h-3" : "w-3.5 h-3.5"} accent-indigo-600`}
        checked={checked} onChange={onChange} />
      <span className={`${c ? "text-[10px]" : "text-[11px]"} text-slate-600`}>{label}</span>
    </label>
  );
};

/* ─────────────────────────── account code input ─────────────────────── */
const normalizeAr = (s: string) =>
  (s ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

function AccountCodeInput({
  allAccounts, selectedId, onChange,
}: {
  allAccounts: any[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const postable = useMemo(
    () => (allAccounts ?? []).filter((a: any) => a.allowPosting === true && !a.isParent),
    [allAccounts],
  );
  const selected = useMemo(() => postable.find((a: any) => String(a.id) === selectedId), [postable, selectedId]);
  const [q, setQ]     = useState(selected?.code ?? "");
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(selected?.code ?? ""); }, [selected?.code]);

  const filtered = useMemo(() => {
    const sq = normalizeAr(q.trim());
    if (!sq) return postable.slice(0, 30);
    const codeFirst = postable.filter((a: any) => normalizeAr(a.code).startsWith(sq));
    const rest      = postable.filter((a: any) => !normalizeAr(a.code).startsWith(sq) &&
                        (normalizeAr(a.code).includes(sq) || normalizeAr(a.name).includes(sq)));
    return [...codeFirst, ...rest].slice(0, 30);
  }, [q, postable]);

  useEffect(() => { setHi(0); }, [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (a: any) => {
    onChange(String(a.id));
    setQ(a.code ?? "");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setQ(selected?.code ?? ""); }
    else if ((e.key === "Enter" || e.key === "Tab") && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        value={open || !selected ? q : selected.code}
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
            {filtered.length === 0 && <div className="text-[11px] text-center text-slate-400 py-3">لا نتائج</div>}
            {filtered.map((a: any, idx: number) => (
              <button key={a.id} onMouseDown={() => pick(a)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] transition-colors ${idx === hi ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <span className="font-mono text-[10px] text-slate-400 w-14 text-left shrink-0">{a.code}</span>
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

/* ─────────────────────────── main component ─────────────────────────── */
export default function Warehouses() {
  const [density, setDensity] = useState<"compact" | "comfortable">(() =>
    (localStorage.getItem("onesoft_density") as any) ?? "compact"
  );
  const toggleDensity = () => setDensity(d => {
    const next = d === "comfortable" ? "compact" : "comfortable";
    localStorage.setItem("onesoft_density", next);
    return next;
  });
  const c = density === "compact";

  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | null>(null);
  const [formTab, setFormTab] = useState<"basic">("basic");
  const [journalItem, setJournalItem] = useState("sales");
  const [doctypeItem, setDoctypeItem] = useState("sales");
  const [journalsOpen, setJournalsOpen] = useState(true);
  const [docTypesOpen, setDocTypesOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [links, setLinks] = useState<LinkRow[]>(DEFAULT_LINKS.map(l => ({ ...l })));

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [journalData, setJournalData] = useState<Record<string, JournalData>>({});
  const [doctypeData, setDoctypeData] = useState<Record<string, DoctypeData>>({});

  const getJournal = (id: string): JournalData => journalData[id] ?? { ...EMPTY_JOURNAL };
  const setJournal = (id: string, patch: Partial<JournalData>) =>
    setJournalData(p => ({ ...p, [id]: { ...(p[id] ?? EMPTY_JOURNAL), ...patch } }));
  const getDoctype = (id: string): DoctypeData => doctypeData[id] ?? { ...EMPTY_DOCTYPE };
  const setDoctype = (id: string, patch: Partial<DoctypeData>) =>
    setDoctypeData(p => ({ ...p, [id]: { ...(p[id] ?? EMPTY_DOCTYPE), ...patch } }));

  const utils = trpc.useUtils();
  const { data: warehouses, isLoading } = trpc.warehouses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const postableAccounts = (accounts as any[])?.filter((a: any) => a.allowPosting === true && !a.isParent) ?? [];
  const { data: users } = trpc.users.list.useQuery();
  const { data: userGroupsList } = trpc.userGroups.list.useQuery();
  const { data: loadedLinks } = trpc.warehouses.accountLinks.list.useQuery(
    { warehouseId: editId! }, { enabled: !!editId },
  );

  useEffect(() => {
    if (loadedLinks !== undefined) {
      const savedMap = new Map(loadedLinks.map((l: any) => [l.label, l]));
      const defaultLabels = new Set(DEFAULT_LINKS.map(d => d.label));
      const merged = DEFAULT_LINKS.map(def => {
        const saved = savedMap.get(def.label) as any;
        return { label: def.label, accountId: saved?.accountId ? String(saved.accountId) : "", sortOrder: def.sortOrder };
      });
      const extras = (loadedLinks as any[])
        .filter((l: any) => !defaultLabels.has(l.label))
        .map((l: any) => ({ label: l.label, accountId: l.accountId ? String(l.accountId) : "", sortOrder: l.sortOrder }));
      setLinks([...merged, ...extras]);
    }
  }, [loadedLinks]);

  const saveLinks = trpc.warehouses.accountLinks.save.useMutation();
  const deleteWarehouse = trpc.warehouses.delete.useMutation({
    onSuccess: () => { utils.warehouses.list.invalidate(); toast.success("تم حذف المخزن"); setDeleteError(null); setEditId(null); setShowDeleteDialog(false); setView("list"); },
    onError: (e) => { setDeleteError(e.message); toast.error(e.message); },
  });
  const create = trpc.warehouses.create.useMutation({ onError: (e) => toast.error(e.message) });
  const update = trpc.warehouses.update.useMutation({ onError: (e) => toast.error(e.message) });

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));
  const f = (v: string) => v || undefined;
  const fNum = (v: string) => (v && v !== "none" ? Number(v) : undefined);

  const openCreate = () => {
    setEditId(null); setForm(EMPTY_FORM);
    setLinks(DEFAULT_LINKS.map(l => ({ ...l }))); setFormTab("basic"); setView("form");
  };
  const openEdit = (w: any) => {
    setEditId(w.id); setFormTab("basic");
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

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("إسم 1 مطلوب"); return; }
    const payload = {
      name: form.name, code: f(form.code), name2: f(form.name2),
      fullName1: f(form.fullName1), fullName2: f(form.fullName2),
      branchId: fNum(form.branchId), description: f(form.description),
      allowedUserGroup: f(form.allowedUserGroup),
      allowedUserId: fNum(form.allowedUserId),
      copyFromWarehouseId: fNum(form.copyFromWarehouseId),
    };
    // التقط الروابط الحالية الآن (قبل أي re-render)
    const linksSnapshot = links.filter(l => l.label.trim()).map((l, i) => ({
      label: l.label,
      accountId: l.accountId && l.accountId !== "none" ? Number(l.accountId) : null,
      sortOrder: i,
    }));
    try {
      let warehouseId: number;
      if (editId) {
        await update.mutateAsync({ id: editId, ...payload });
        warehouseId = editId;
      } else {
        const w = await create.mutateAsync(payload);
        warehouseId = w.id;
      }
      await saveLinks.mutateAsync({ warehouseId, links: linksSnapshot });
      utils.warehouses.accountLinks.list.invalidate({ warehouseId });
      utils.warehouses.list.invalidate();
      toast.success(editId ? "تم تحديث المخزن" : "تم إنشاء المخزن");
      setEditId(null);
      setView("list");
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ أثناء الحفظ");
    }
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
      { label: "حذف",    icon: <Trash2 className="w-3.5 h-3.5" />,       action: () => { if (editId) { setDeleteError(null); setShowDeleteDialog(true); } }, danger: true },
      { label: "عرض",    icon: <Eye className="w-3.5 h-3.5" />,          action: () => {} },
      { label: "طباعة",  icon: <Printer className="w-3.5 h-3.5" />,      action: () => {} },
      { label: "خروج",   icon: <LogOut className="w-3.5 h-3.5" />,       action: () => setView("list") },
    ];

    return (
      <Density.Provider value={density}>
      <div
        className="flex flex-col min-h-full -mx-6 -mt-6 px-6 pt-4"
        style={{ background: "#f8f9fb" }}
        dir="rtl"
      >
        {/* ── Page title ── */}
        <div className={`flex items-center justify-between ${c ? "mb-1" : "mb-3"}`}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setView("list")}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
            >
              <ArrowLeft className="w-2.5 h-2.5" />
            </button>
            <div className={`${c ? "w-4 h-4" : "w-7 h-7"} rounded bg-indigo-50 flex items-center justify-center border border-indigo-100`}>
              <Warehouse className={`${c ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-indigo-600`} />
            </div>
            <h1 className={`${c ? "text-[12px]" : "text-[15px]"} font-bold text-slate-700 flex items-center gap-1.5`}>
              {editId ? "تعديل بيانات المخزن" : "إضافة مخزن جديد"}
              {editId && form.name && (
                <span className={`${c ? "text-[11px]" : "text-[13px]"} font-semibold text-indigo-600`}>
                  — {form.name}
                </span>
              )}
            </h1>
          </div>
          {/* ── Density toggle ── */}
          <button
            onClick={toggleDensity}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded px-1.5 py-0.5 bg-white transition-colors"
            title={c ? "تبديل للوضع المريح" : "تبديل للوضع المضغوط"}
          >
            {c
              ? <><Maximize2 className="w-2.5 h-2.5" /> مريح</>
              : <><Minimize2 className="w-2.5 h-2.5" /> مضغوط</>
            }
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div
          className={`flex items-center gap-0 shrink-0 ${c ? "mb-1" : "mb-3"}`}
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          {([
            { id: "basic", label: "البيانات الأساسية" },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFormTab(tab.id)}
              className={`${c ? "px-2.5 py-0.5 text-[10px]" : "px-5 py-2 text-[13px]"} font-medium transition-colors relative`}
              style={{
                color: formTab === tab.id ? "#4338ca" : "#64748b",
                borderBottom: formTab === tab.id ? "2px solid #4338ca" : "2px solid transparent",
                marginBottom: -1,
                background: "transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Sections ── */}
        <div className={`flex-1 ${c ? "space-y-1 pb-8" : "space-y-3 pb-16"}`}>

          {/* ══ TAB: البيانات الأساسية ══ */}
          {formTab === "basic" && <>
            {/* ── بيانات المخزن ── */}
            <Section title="بيانات المخزن">
              <div className={`grid ${c ? "grid-cols-3 gap-x-2 gap-y-0.5" : "grid-cols-2 gap-x-4 gap-y-1.5"}`}>
                <HF label="رقم">
                  <FI value={form.code} onChange={v => set("code", v)} placeholder="001" />
                </HF>
                <HF label="إسم 1 *">
                  <FI value={form.name} onChange={v => set("name", v)} placeholder="الاسم بالعربي" />
                </HF>
                <HF label="موقع">
                  <FS value={form.branchId} onValueChange={v => set("branchId", v)} placeholder="المقر الرئيسي">
                    <SelectItem value="none">المقر الرئيسي</SelectItem>
                    {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </FS>
                </HF>
                <HF label="إسم 2">
                  <FI value={form.name2} onChange={v => set("name2", v)} placeholder="Name in English" />
                </HF>
                <HF label="إسم كامل 1">
                  <FI value={form.fullName1} onChange={v => set("fullName1", v)} placeholder="الاسم الكامل بالعربي" />
                </HF>
                <HF label="إسم كامل 2">
                  <FI value={form.fullName2} onChange={v => set("fullName2", v)} placeholder="Full name in English" />
                </HF>
                <HF label="ملحوظة" full>
                  <FI value={form.description} onChange={v => set("description", v)} placeholder="ملاحظات إضافية..." />
                </HF>
              </div>
            </Section>

            {/* ── حدود الاستخدام ── */}
            <Section title="حدود الاستخدام">
              <div className={`grid ${c ? "grid-cols-2 gap-x-2 gap-y-0.5" : "grid-cols-2 gap-x-4 gap-y-1.5"} items-center`}>
                <HF label="مجموعة مستخدمين" lw={c ? 88 : 108}>
                  <FI value={form.allowedUserGroup} onChange={v => set("allowedUserGroup", v)} placeholder="— الكل —" />
                </HF>
                <HF label="مستخدم" lw={c ? 88 : 108}>
                  <FS value={form.allowedUserId} onValueChange={v => set("allowedUserId", v)} placeholder="— الكل —">
                    <SelectItem value="none">— الكل —</SelectItem>
                    {(users as any[])?.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </FS>
                </HF>
              </div>
            </Section>

            {/* ── جدول الروابط المحاسبية ── */}
            <Section title="الروابط المحاسبية">
              <table className="text-right" style={{ borderCollapse: "collapse", width: "100%", maxWidth: 400 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                    <th className="text-[9px] font-semibold text-slate-400 px-1 py-0.5 text-right" style={{ width: 20 }}>#</th>
                    <th className="text-[9px] font-semibold text-slate-400 px-1 py-0.5 text-right">بيان</th>
                    <th className="text-[9px] font-semibold text-slate-400 px-1 py-0.5 text-right" style={{ width: 90 }}>كود</th>
                    <th className="text-[9px] font-semibold text-slate-400 px-1 py-0.5 text-right">إسم الحساب</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((row, idx) => {
                    const acc = postableAccounts.find((a: any) => String(a.id) === row.accountId)
                             ?? (accounts as any[])?.find((a: any) => String(a.id) === row.accountId);
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td className="px-1 text-[9px] text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-1 text-[10px] text-slate-700 font-medium whitespace-nowrap">{row.label}</td>
                        <td className="py-0" style={{ borderRight: "1px solid #f1f5f9" }}>
                          <AccountCodeInput
                            allAccounts={(accounts as any[]) ?? []}
                            selectedId={row.accountId}
                            onChange={v => setLinks(prev => prev.map((l, i) => i === idx ? { ...l, accountId: v } : l))}
                          />
                        </td>
                        <td className="px-1 text-[10px] text-slate-500 truncate max-w-0" style={{ maxWidth: 160 }}>{acc?.name ?? <span className="text-slate-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          </>}

          {/* ══ TAB: دفاتر المستندات (انتقل إلى الإعدادات ← النظام) ══ */}
          {(false as any) && (() => {
            const ITEMS: any[] = [];
            const currentItem = ITEMS.find(i => i.id === journalItem);


            return (
              <div className="flex gap-2" style={{ height: "calc(100vh - 220px)" }}>
                {/* ── Sidebar ── */}
                <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: c ? 158 : 205, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <div className={`${c ? "px-2 py-0.5" : "px-3 pt-2.5 pb-2"} shrink-0`} style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <span className={`${c ? "text-[10px]" : "text-[11px]"} font-semibold text-slate-400 uppercase tracking-wide`}>الدفاتر</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {ITEMS.map(item => {
                      const active = journalItem === item.id;
                      return (
                        <button key={item.id} onClick={() => setJournalItem(item.id)}
                          className={`w-full flex items-center gap-1.5 ${c ? "px-2 py-0.5" : "px-3 py-1.5"} text-right transition-colors`}
                          style={{ background: active ? "#dbeafe" : "transparent", color: active ? "#1d4ed8" : "#64748b", borderRight: active ? "2px solid #3b82f6" : "2px solid transparent" }}
                        >
                          <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{item.icon}</span>
                          <span className={`${c ? "text-[10px]" : "text-[12px]"} truncate`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Content ── */}
                <div className={`flex-1 min-w-0 overflow-y-auto ${c ? "space-y-1" : "space-y-2"} pb-4`}>
                  {/* Title bar */}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[12px] font-bold text-indigo-700">{currentItem?.label}</span>
                    <span className="text-[11px] text-slate-400">دفتر:{journalItem.substring(0,3).toUpperCase()}</span>
                  </div>

                  {/* بيانات الدفتر */}
                  {(() => { const jd = getJournal(journalItem); return (
                  <P title="بيانات الدفتر">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <R label="نوع المستند">
                        <FS value={jd.docType} onValueChange={v => setJournal(journalItem, { docType: v })}>
                          <SelectItem value="sales">فاتورة مبيعات</SelectItem>
                          <SelectItem value="purchase">فاتورة مشتريات</SelectItem>
                          <SelectItem value="return">مردودات</SelectItem>
                          <SelectItem value="transfer">تحويل داخلي</SelectItem>
                          <SelectItem value="dispatch">صرف أصناف</SelectItem>
                        </FS>
                      </R>
                      <div className="flex items-center gap-2">
                        <R label="الجزء الثابت" lw={72}>
                          <FI value={jd.fixedPart} onChange={v => setJournal(journalItem, { fixedPart: v })} placeholder="S01-" />
                        </R>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                          <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                            checked={jd.transferOwnership}
                            onChange={e => setJournal(journalItem, { transferOwnership: e.target.checked })} />
                          <span className="text-[11px] text-slate-600">نقل الملكية أوتوماتيكي</span>
                        </label>
                      </div>
                      <R label="إسم عربي">
                        <FI value={jd.nameAr} onChange={v => setJournal(journalItem, { nameAr: v })} placeholder={currentItem?.label} />
                      </R>
                      <R label="إسم إنجليزي">
                        <FI value={jd.nameEn} onChange={v => setJournal(journalItem, { nameEn: v })} placeholder="Journal Name in English" />
                      </R>
                    </div>
                  </P>
                  ); })()}

                  {/* حدود الاستخدام */}
                  {(() => { const jd = getJournal(journalItem); return (
                  <P title="حدود الاستخدام">
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                      <R label="مجموعة مستخدمين">
                        <FS value={jd.userGroup} onValueChange={v => setJournal(journalItem, { userGroup: v })}>
                          <SelectItem value="all">الكل</SelectItem>
                          {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                        </FS>
                      </R>
                      <R label="مستخدم">
                        <FS value={jd.user} onValueChange={v => setJournal(journalItem, { user: v })}>
                          <SelectItem value="all">الكل</SelectItem>
                          {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                        </FS>
                      </R>
                      <R label="مخزن">
                        <FS value={jd.warehouse} onValueChange={v => setJournal(journalItem, { warehouse: v })}>
                          <SelectItem value="this">هذا المخزن</SelectItem>
                          {(warehouses as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </FS>
                      </R>
                    </div>
                    <div className="mt-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                          checked={jd.systemOnly}
                          onChange={e => setJournal(journalItem, { systemOnly: e.target.checked })} />
                        <span className="text-[11px] text-slate-600">للمستندات التي يصدرها النظام فقط</span>
                      </label>
                    </div>
                  </P>
                  ); })()}

                  {/* الأرقام */}
                  {(() => { const jd = getJournal(journalItem); return (
                  <P title="الأرقام">
                    <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 items-center">
                      <div className="col-span-1 flex items-center">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                            checked={jd.autoSerial}
                            onChange={e => setJournal(journalItem, { autoSerial: e.target.checked })} />
                          <span className="text-[11px] text-slate-600">تسلسل أرقام أوتوماتيكي</span>
                        </label>
                      </div>
                      <R label="أول رقم">
                        <FI value={jd.firstNum} onChange={v => setJournal(journalItem, { firstNum: v })} placeholder="1" />
                      </R>
                      <R label="عدد الخانات">
                        <FI value={jd.digits} onChange={v => setJournal(journalItem, { digits: v })} placeholder="7" />
                      </R>
                      <R label="آخر رقم">
                        <FI value={jd.lastNum} onChange={v => setJournal(journalItem, { lastNum: v })} placeholder="9999999" />
                      </R>
                    </div>
                  </P>
                  ); })()}

                  {/* خيارات الطباعة وأسلوب الترحيل */}
                  {(() => { const jd = getJournal(journalItem); return (
                  <div className="grid grid-cols-2 gap-2">
                    <P title="خيارات الطباعة">
                      <div className="space-y-1.5">
                        <R label="نموذج الطباعة">
                          <FI value={jd.printTemplate} onChange={v => setJournal(journalItem, { printTemplate: v })} placeholder="نموذج A4 رئيسي" />
                        </R>
                        <R label="نموذج طباعة حراري">
                          <FI value={jd.printTemplate2} onChange={v => setJournal(journalItem, { printTemplate2: v })} placeholder="نموذج حراري 80mm" />
                        </R>
                        <div className="flex items-center gap-4 mt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                              checked={jd.printOnSave}
                              onChange={e => setJournal(journalItem, { printOnSave: e.target.checked })} />
                            <span className="text-[11px] text-slate-600">طباعة مع الحفظ</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                              checked={jd.status === "ready"}
                              onChange={() => setJournal(journalItem, { status: "ready" })} />
                            <span className="text-[11px] text-slate-600">مستعد</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                              checked={jd.status === "pending"}
                              onChange={() => setJournal(journalItem, { status: "pending" })} />
                            <span className="text-[11px] text-slate-600">معلق</span>
                          </label>
                        </div>
                      </div>
                    </P>
                    <P title="أسلوب الترحيل">
                      <div className="space-y-1.5 mt-0.5">
                        {(["normal","onSave","immediate","daily"] as const).map((v, idx) => (
                          <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                              checked={jd.postingMethod === v}
                              onChange={() => setJournal(journalItem, { postingMethod: v })} />
                            <span className="text-[11px] text-slate-600">
                              {["ترحيل طبيعي (يدوي)","ترحيل مع الحفظ","ترحيل فوري","ترحيل يومي دفعة واحدة"][idx]}
                            </span>
                          </label>
                        ))}
                      </div>
                    </P>
                  </div>
                  ); })()}

                </div>
              </div>
            );
          })()}

          {/* ══ TAB: أنواع المستندات (انتقل إلى الإعدادات ← النظام) ══ */}
          {(false as any) && (() => {
            const DTYPE_ITEMS = [
              { id: "sales",            label: "أنواع مستند فاتورة المبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: "sales-return",     label: "أنواع مستند مردود المبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
              { id: "purchases",        label: "أنواع مستند فاتورة المشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
              { id: "purchases-return", label: "أنواع مستند مردود المشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
              { id: "sales-order",      label: "أنواع مستند أمر البيع",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
              { id: "sales-quote",      label: "أنواع مستند عرض أسعار مبيعات",  icon: <Tag className="w-3.5 h-3.5" /> },
              { id: "purch-quote",      label: "أنواع مستند عرض أسعار مشتريات", icon: <Tag className="w-3.5 h-3.5" /> },
              { id: "purchase-order",   label: "أنواع مستند أمر شراء",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
              { id: "transfer",         label: "أنواع مستند سند تحويل داخلي",    icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
            ];
            const currentLabel = DTYPE_ITEMS.find(i => i.id === doctypeItem)?.label ?? "";


            return (
              <div className="flex gap-2" style={{ height: "calc(100vh - 220px)" }}>
                {/* ── Sidebar ── */}
                <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: c ? 158 : 205, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <div className={`${c ? "px-2 py-0.5" : "px-3 pt-2.5 pb-2"} shrink-0`} style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <span className={`${c ? "text-[10px]" : "text-[11px]"} font-semibold text-slate-400 uppercase tracking-wide`}>الأنواع</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {DTYPE_ITEMS.map(item => {
                      const active = doctypeItem === item.id;
                      return (
                        <button key={item.id} onClick={() => setDoctypeItem(item.id)}
                          className={`w-full flex items-center gap-1.5 ${c ? "px-2 py-0.5" : "px-3 py-1.5"} text-right transition-colors`}
                          style={{ background: active ? "#dbeafe" : "transparent", color: active ? "#1d4ed8" : "#64748b", borderRight: active ? "2px solid #3b82f6" : "2px solid transparent" }}
                        >
                          <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{item.icon}</span>
                          <span className={`${c ? "text-[10px]" : "text-[12px]"} truncate flex-1`}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Content ── */}
                <div className={`flex-1 min-w-0 overflow-y-auto ${c ? "space-y-1" : "space-y-2"} pb-4`}>
                  <div className="flex items-center justify-between py-0.5">
                    <span className="text-[12px] font-bold text-indigo-700">{currentLabel}</span>
                  </div>

                  {/* بيانات نوع المستند */}
                  {(() => { const dd = getDoctype(doctypeItem); return (
                  <P title="بيانات نوع المستند">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <R label="نوع المستند">
                        <FS value={dd.docType} onValueChange={v => setDoctype(doctypeItem, { docType: v })}>
                          <SelectItem value="sales">فاتورة مبيعات</SelectItem>
                          <SelectItem value="purchase">فاتورة مشتريات</SelectItem>
                          <SelectItem value="return-s">مردود مبيعات</SelectItem>
                          <SelectItem value="return-p">مردود مشتريات</SelectItem>
                        </FS>
                      </R>
                      <div className="grid grid-cols-2 gap-x-2">
                        <R label="كود إنجليزي" lw={64}>
                          <FI value={dd.codeEn} onChange={v => setDoctype(doctypeItem, { codeEn: v })} placeholder="CASH" />
                        </R>
                        <R label="كود عربي" lw={56}>
                          <FI value={dd.codeAr} onChange={v => setDoctype(doctypeItem, { codeAr: v })} placeholder="نقدا" />
                        </R>
                      </div>
                      <R label="إسم عربي">
                        <FI value={dd.nameAr} onChange={v => setDoctype(doctypeItem, { nameAr: v })} placeholder="مبيعات نقدية فرع 1" />
                      </R>
                      <R label="إسم إنجليزي">
                        <FI value={dd.nameEn} onChange={v => setDoctype(doctypeItem, { nameEn: v })} placeholder="Cash Invoice Br. 1" />
                      </R>
                    </div>
                  </P>
                  ); })()}

                  {/* حدود الاستخدام */}
                  {(() => { const dd = getDoctype(doctypeItem); return (
                  <P title="حدود الاستخدام">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <R label="مجموعة مستخدمين">
                        <FS value={dd.userGroup} onValueChange={v => setDoctype(doctypeItem, { userGroup: v })}>
                          <SelectItem value="all">الكل</SelectItem>
                          {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                        </FS>
                      </R>
                      <R label="مستخدم">
                        <FS value={dd.user} onValueChange={v => setDoctype(doctypeItem, { user: v })}>
                          <SelectItem value="all">الكل</SelectItem>
                          {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                        </FS>
                      </R>
                      <R label="دفتر المستندات">
                        <FI value={dd.journal} onChange={v => setDoctype(doctypeItem, { journal: v })} placeholder="SAA" />
                      </R>
                      <R label="مخزن">
                        <FS value={dd.warehouse} onValueChange={v => setDoctype(doctypeItem, { warehouse: v })}>
                          <SelectItem value="this">هذا المخزن</SelectItem>
                          {(warehouses as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </FS>
                      </R>
                    </div>
                    <div className="mt-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                          checked={dd.systemOnly}
                          onChange={e => setDoctype(doctypeItem, { systemOnly: e.target.checked })} />
                        <span className="text-[11px] text-slate-600">للمستندات التي يصدرها النظام فقط</span>
                      </label>
                    </div>
                  </P>
                  ); })()}

                  {/* خصائص السندات المصدرة */}
                  {(() => { const dd = getDoctype(doctypeItem); return (
                  <P title="خصائص السندات المصدرة">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <R label="نوع القيد">
                        <FS value={dd.entryType} onValueChange={v => setDoctype(doctypeItem, { entryType: v })}>
                          <SelectItem value="sales">مبيعات</SelectItem>
                          <SelectItem value="purchase">مشتريات</SelectItem>
                          <SelectItem value="receipt">قبض</SelectItem>
                          <SelectItem value="payment">صرف</SelectItem>
                        </FS>
                      </R>
                      <R label="دفتر القيد">
                        <FI value={dd.entryJournal} onChange={v => setDoctype(doctypeItem, { entryJournal: v })} placeholder="SJ3" />
                      </R>
                      <R label="نوع مستند المخزون">
                        <FS value={dd.stockDocType} onValueChange={v => setDoctype(doctypeItem, { stockDocType: v })}>
                          <SelectItem value="sales">مبيعات 3</SelectItem>
                          <SelectItem value="purchase">مشتريات</SelectItem>
                          <SelectItem value="transfer">تحويل</SelectItem>
                        </FS>
                      </R>
                      <R label="دفتر مستند المخزون">
                        <FI value={dd.stockJournal} onChange={v => setDoctype(doctypeItem, { stockJournal: v })} placeholder="SI3" />
                      </R>
                    </div>
                  </P>
                  ); })()}

                  {/* الخيارات */}
                  {(() => { const dd = getDoctype(doctypeItem); return (
                  <P title="خيارات المستند">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                      <R label="نموذج الطباعة">
                        <FI value={dd.printTemplate} onChange={v => setDoctype(doctypeItem, { printTemplate: v })} placeholder="نموذج A4" />
                      </R>
                      <R label="نموذج طباعة حراري">
                        <FI value={dd.printTemplate2} onChange={v => setDoctype(doctypeItem, { printTemplate2: v })} placeholder="80mm" />
                      </R>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center pt-0.5">
                        {([
                          ["trackQty",      "متابعة الكميات بالفواتير"],
                          ["noTax",         "بدون ضريبة"],
                          ["sellerStats",   "إحصاءات للبائع"],
                          ["itemStats",     "إحصاءات للصنف"],
                          ["customerStats", "إحصاءات عميل/مورد"],
                        ] as [keyof DoctypeData, string][]).map(([key, lbl]) => (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                              checked={!!dd[key]}
                              onChange={e => setDoctype(doctypeItem, { [key]: e.target.checked })} />
                            <span className="text-[11px] text-slate-600">{lbl}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </P>
                  ); })()}

                </div>
              </div>
            );
          })()}

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
                `flex flex-col items-center justify-center gap-0 flex-1 ${c ? "py-0.5 text-[10px]" : "py-2 text-[11px]"} font-medium transition-colors`,
                "border-l border-slate-100 last:border-0",
                primary
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : danger
                    ? "text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    : "text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              <span className={c ? "w-3 h-3" : "w-3.5 h-3.5"} style={{ display: "flex" }}>{icon}</span>
              <span className="leading-none" style={{ marginTop: c ? 1 : 2 }}>
                {label === "حفظ" && isSaving ? "..." : label}
              </span>
            </button>
          ))}
        </div>

        {/* ══ نافذة تأكيد الحذف ══ */}
        <Dialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteError(null); }}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-base">هل تريد حذف هذا المخزن؟</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500 text-right">
              سيتم إلغاء تفعيل المخزن وإخفاؤه من القوائم. يمكن استعادته لاحقاً عند الحاجة.
            </p>
            {deleteError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 text-right">
                {deleteError}
              </div>
            )}
            <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => { setDeleteError(null); deleteWarehouse.mutate({ id: editId! }); }}
                disabled={deleteWarehouse.isPending}
              >
                {deleteWarehouse.isPending ? "جارٍ الحذف..." : "حذف"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteDialog(false); setDeleteError(null); }}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </Density.Provider>
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
        <div className="flex items-center gap-2">
          <Button
            onClick={openCreate}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-9 px-4 text-sm rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة مخزن
          </Button>
        </div>
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(w); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="تعديل"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditId(w.id); setDeleteError(null); setShowDeleteDialog(true); }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ══ نافذة تأكيد الحذف (list view) ══ */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteError(null); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">هل تريد حذف هذا المخزن؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-right">
            سيتم إلغاء تفعيل المخزن وإخفاؤه من القوائم. يمكن استعادته لاحقاً عند الحاجة.
          </p>
          {deleteError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 text-right">
              {deleteError}
            </div>
          )}
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => { setDeleteError(null); deleteWarehouse.mutate({ id: editId! }); }}
              disabled={deleteWarehouse.isPending}
            >
              {deleteWarehouse.isPending ? "جارٍ الحذف..." : "حذف"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowDeleteDialog(false); setDeleteError(null); }}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
