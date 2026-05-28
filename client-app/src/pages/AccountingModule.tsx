import { useState, useMemo, useRef, useCallback, useEffect, createContext, useContext } from "react";
import type { CSSProperties } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import type { KeyboardEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  buildTreeFlat, exportToExcel, exportToWord, openPrintPreview,
  type AccountForExport,
} from "@/utils/chartOfAccountsExport";
import {
  ChevronDown, ChevronRight, BookOpen, FileText, BarChart3,
  ClipboardList, Plus, Search, DollarSign, ArrowRight,
  TrendingUp, TrendingDown, Scale, Wallet, Building,
  Printer, Download, X, Check, RefreshCw, Edit2, Trash2,
  ArrowUpCircle, ArrowDownCircle, Upload, AlertCircle,
  Folder, FolderOpen, LayoutList, Network,
  FileDown, FileSpreadsheet, ChevronDown as ChevronDownIcon,
  Eye, Copy, PowerOff, PlusCircle, MoreVertical, AlertTriangle, Save,
  ExternalLink, Zap, PackageCheck, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

type MenuId = string;

// ─── Menu Structure ────────────────────────────────────────────────────────────
const menuSections = [
  {
    id: "journal",
    label: "اليومية العامة",
    icon: FileText,
    children: [
      { id: "journal-list",    label: "القيود اليومية",    icon: ClipboardList,   path: "/accounting/journal" },
      { id: "receipt-voucher", label: "سند قبض",           icon: ArrowDownCircle, path: "/accounting/receipt" },
      { id: "payment-voucher", label: "سند صرف",           icon: ArrowUpCircle,   path: "/accounting/payment" },
      { id: "new-journal",     label: "سند قيد",           icon: FileText,        path: "/accounting/new-journal" },
      { id: "opening-entry",   label: "سند قيد افتتاحي",  icon: Plus,            path: "/accounting/opening" },
    ],
  },
  {
    id: "chart-of-accounts",
    label: "دليل الحسابات",
    icon: BookOpen,
    children: [
      { id: "accounts-tree",  label: "شجرة الحسابات",    icon: BookOpen,  path: "/accounting/accounts" },
      { id: "account-ledger", label: "كشف حساب أستاذ",   icon: FileText,  path: "/accounting/ledger" },
    ],
  },
  {
    id: "cost-centers",
    label: "مراكز التكلفة",
    icon: Building,
    children: [
      { id: "cost-centers-list", label: "مراكز التكلفة",  icon: Building, path: "/accounting/cost-centers" },
      { id: "cost-allocation",   label: "توزيع التكاليف", icon: Scale,    path: "/accounting/cost-allocation" },
    ],
  },
  {
    id: "financial-reports",
    label: "التقارير المالية",
    icon: BarChart3,
    children: [
      { id: "trial-balance",    label: "ميزان مراجعة الأستاذ العام", icon: Scale,    path: "/accounting/trial-balance" },
      { id: "income-statement", label: "قائمة الأرباح والخسائر",     icon: TrendingUp,path: "/accounting/income-statement" },
      { id: "balance-sheet",    label: "الميزانية العمومية",          icon: BarChart3, path: "/accounting/balance-sheet" },
      { id: "cash-flow",        label: "قائمة التدفقات النقدية",      icon: Wallet,    path: "/accounting/cash-flow" },
    ],
  },
  {
    id: "posting-ops",
    label: "الترحيل المحاسبي والمخزني",
    icon: PackageCheck,
    children: [
      { id: "posting-operations", label: "عمليات الترحيل (المرحلة الثانية)", icon: Layers, path: "/accounting/posting-ops" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function AccountingMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    journal: true, "chart-of-accounts": true, "cost-centers": true, "financial-reports": true, "posting-ops": true,
  });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}>
          <BookOpen className="w-4 h-4 text-primary" />
          الحسابات العامة
        </button>
      </div>
      <div className="py-2 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
              <section.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right">{section.label}</span>
              {expanded[section.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expanded[section.id] && (
              <div className="mr-3 border-r border-border/40 mb-1">
                {section.children.map(child => (
                  <button key={child.id} onClick={() => { onSelect(child.id); openTab(child.path, child.label, child.icon); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                      activeId === child.id ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                    }`}>
                    <child.icon className="w-3 h-3 shrink-0" />
                    <span className="text-right leading-tight">{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function AccountingOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const stats = [
    { label: "إجمالي الإيرادات",  value: "328,000", color: "text-emerald-500", icon: TrendingUp },
    { label: "إجمالي المصروفات",  value: "215,000", color: "text-destructive",  icon: TrendingDown },
    { label: "صافي الربح",         value: "113,000", color: "text-primary",      icon: DollarSign },
    { label: "رصيد الخزينة",       value: "87,500",  color: "text-amber-500",    icon: Wallet },
  ];
  const monthlyData = [
    { month: "يناير",  revenue: 45000, expenses: 32000 },
    { month: "فبراير", revenue: 52000, expenses: 35000 },
    { month: "مارس",   revenue: 48000, expenses: 33000 },
    { month: "أبريل",  revenue: 61000, expenses: 40000 },
    { month: "مايو",   revenue: 55000, expenses: 38000 },
    { month: "يونيو",  revenue: 67000, expenses: 37000 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">الإيرادات والمصروفات الشهرية</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <Line type="monotone" dataKey="revenue"  stroke="#10b981" name="الإيرادات"  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="المصروفات" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {menuSections.map(group => (
          <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                <group.icon className="w-3.5 h-3.5 text-primary" />
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {group.children.map(item => (
                <button key={item.id} onClick={() => onSelect(item.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Smart Account Search ─────────────────────────────────────────────────────
type TJAcc = {
  id: number; code: string; name: string;
  nature: string | null; allowPosting: boolean | null;
  isParent: boolean | null; level: number | null;
  accountType: string | null;
};

const RECENT_KEY = "onesoft_recent_accs";
const getRecentIds = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; } };
const addRecentId  = (id: string) => { const ids = [id, ...getRecentIds().filter(x => x !== id)].slice(0, 10); localStorage.setItem(RECENT_KEY, JSON.stringify(ids)); };

const natBadge = (n: string | null) =>
  n === "debit"
    ? <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium shrink-0">مدين</span>
    : <span className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-600 font-medium shrink-0">دائن</span>;

const normalizeAr = (s: string) =>
  s.replace(/[أإآا]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();

const typeLabel = (t: string | null) =>
  ({ assets:"أصول", liabilities:"خصوم", equity:"حقوق ملكية", revenue:"إيرادات", expenses:"مصروفات" }[t ?? ""] ?? "");

// ── Date Mask Input (DD/MM/YYYY) ──────────────────────────────────────────────
function DateMaskInput({
  value, onChange, className, placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const mask  = (v: string) => {
    const d = v.replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
    return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  };
  const toISO = (v: string) => {
    const n = v.replace(/\D/g, "");
    if (n.length < 8) return "";
    const dd = n.slice(0,2), mm = n.slice(2,4), yy = n.slice(4,8);
    if (+dd<1||+dd>31||+mm<1||+mm>12||+yy<1000) return "";
    return `${yy}-${mm}-${dd}`;
  };
  const fromISO = (v: string) => {
    if (!v || v.length < 10) return "";
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  };

  const ref = useRef<HTMLInputElement>(null);
  const [disp, setDisp] = useState(() => fromISO(value));

  useEffect(() => {
    setDisp(prev => toISO(prev) === value ? prev : fromISO(value));
  }, [value]);

  const commit = (newDisp: string) => {
    setDisp(newDisp);
    onChange(toISO(newDisp));
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={disp}
      placeholder={placeholder ?? "DD/MM/YYYY"}
      dir="ltr"
      className={`text-left ${className ?? ""}`}
      onKeyDown={e => {
        const el = ref.current;
        if (!el) return;
        const pos = el.selectionStart ?? disp.length;

        if (e.key === "Backspace") {
          e.preventDefault();
          const realPos = pos > 0 && disp[pos-1] === "/" ? pos - 1 : pos;
          if (realPos === 0) { commit(""); return; }
          const digits = (disp.slice(0, realPos-1) + disp.slice(realPos)).replace(/\D/g, "");
          const nd = mask(digits);
          commit(nd);
          setTimeout(() => el.setSelectionRange(realPos-1, realPos-1), 0);
          return;
        }
        if (e.key === "Delete") {
          e.preventDefault();
          const realPos = disp[pos] === "/" ? pos + 1 : pos;
          if (realPos >= disp.length) return;
          const digits = (disp.slice(0, realPos) + disp.slice(realPos+1)).replace(/\D/g, "");
          commit(mask(digits));
          setTimeout(() => el.setSelectionRange(pos, pos), 0);
          return;
        }
        const key = e.key.replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
        if (!/^\d$/.test(key)) {
          if (!["Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Enter"].includes(e.key))
            e.preventDefault();
          return;
        }
        e.preventDefault();
        const digPos = pos <= 2 ? pos : pos <= 5 ? pos-1 : pos-2;
        const digits = disp.replace(/\D/g, "").padEnd(Math.max(digPos+1, disp.replace(/\D/g,"").length), "0");
        const newDigs = digits.slice(0,digPos) + key + digits.slice(digPos+1);
        const nd = mask(newDigs.slice(0,8));
        commit(nd);
        const ncp = digPos < 2 ? digPos+1 : digPos < 4 ? digPos+2 : digPos+3;
        setTimeout(() => el.setSelectionRange(Math.min(ncp, nd.length), Math.min(ncp, nd.length)), 0);
      }}
      onChange={e => {
        const nd = mask(e.target.value);
        commit(nd);
      }}
      onFocus={e => e.target.select()}
    />
  );
}

// ── Full-screen Account Picker Dialog (F2 / Ctrl+K) ──────────────────────────
function AccountPickerDialog({
  open, onClose, accounts, recentIds, onSelect,
}: {
  open: boolean; onClose: () => void;
  accounts: TJAcc[];
  recentIds: string[];
  onSelect: (id: string, name: string, nature: string) => void;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const postable = useMemo(() => accounts.filter(a => a.allowPosting === true && !a.isParent), [accounts]);

  const filtered = useMemo(() => {
    const sq = normalizeAr(q.trim());
    if (!sq) {
      const recent = recentIds.map(id => postable.find(a => a.id.toString() === id)).filter(Boolean) as TJAcc[];
      const rest   = postable.filter(a => !recentIds.includes(a.id.toString())).slice(0, 40);
      return [...recent, ...rest];
    }
    const codeMatches = postable.filter(a => normalizeAr(a.code).startsWith(sq));
    const nameMatches = postable.filter(a => !normalizeAr(a.code).startsWith(sq) && (normalizeAr(a.code).includes(sq) || normalizeAr(a.name).includes(sq)));
    return [...codeMatches, ...nameMatches].slice(0, 60);
  }, [q, postable, recentIds]);

  useEffect(() => { if (open) { setQ(""); setHi(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);
  useEffect(() => { setHi(0); }, [filtered]);
  useEffect(() => {
    const el = listRef.current?.children[hi] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const pick = (a: TJAcc) => {
    if (a.isParent) { toast.warning("لا يمكن التقييد على حساب رئيسي"); return; }
    addRecentId(a.id.toString());
    onSelect(a.id.toString(), a.name, a.nature ?? "debit");
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && filtered[hi]) pick(filtered[hi]);
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-[560px] max-h-[70vh] flex flex-col overflow-hidden" dir="rtl" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="ابحث بكود الحساب أو اسمه..." dir="rtl"
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">Esc</kbd>
        </div>
        {/* section label */}
        {!q.trim() && (
          <div className="px-4 py-1.5 text-[10px] text-muted-foreground bg-muted/20 border-b border-border flex items-center gap-1.5">
            <RefreshCw className="w-2.5 h-2.5" /> آخر الحسابات المستخدمة تظهر أولاً
          </div>
        )}
        {/* list */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <div className="text-xs text-center text-muted-foreground py-8">لا توجد نتائج مطابقة</div>
          )}
          {filtered.map((a, idx) => (
            <button key={a.id} onClick={() => pick(a)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs transition-colors border-b border-border/30
                ${idx === hi ? "bg-primary/10 text-primary" : "hover:bg-accent/50"}`}
            >
              <span className="font-mono w-20 shrink-0 text-right text-[11px] text-muted-foreground">{a.code}</span>
              <span className="flex-1 text-right truncate font-medium">{a.name}</span>
              {recentIds.includes(a.id.toString()) && !q && <RefreshCw className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />}
            </button>
          ))}
        </div>
        {/* footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>↑↓ تنقل</span><span>Enter اختيار</span><span>Esc إغلاق</span>
          <span className="mr-auto">{filtered.length} حساب</span>
        </div>
      </div>
    </div>
  );
}

// ── Inline Smart Account Input ────────────────────────────────────────────────
function SmartAccountInput({
  accounts, selectedId, onSelect, recentIds, onOpenPicker,
  externalKeyDown, onFocusCb,
  inputRef: externalInputRef,
}: {
  accounts: TJAcc[];
  selectedId: string;
  onSelect: (id: string, name: string, nature: string) => void;
  recentIds: string[];
  onOpenPicker?: () => void;
  externalKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocusCb?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const selected = useMemo(() => accounts.find(a => a.id.toString() === selectedId), [accounts, selectedId]);
  const [q, setQ]     = useState(selected?.code ?? "");
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(selected?.code ?? ""); }, [selected?.code]);

  const postable = useMemo(() => accounts.filter(a => a.allowPosting === true && !a.isParent), [accounts]);

  const filtered = useMemo(() => {
    const sq = normalizeAr(q.trim());
    if (!sq) {
      const recent = recentIds.map(id => postable.find(a => a.id.toString() === id)).filter(Boolean) as TJAcc[];
      const rest   = postable.filter(a => !recentIds.includes(a.id.toString())).slice(0, 20);
      return [...recent, ...rest];
    }
    const codeMatches = postable.filter(a => normalizeAr(a.code).startsWith(sq));
    const nameMatches = postable.filter(a => !normalizeAr(a.code).startsWith(sq) && (normalizeAr(a.code).includes(sq) || normalizeAr(a.name).includes(sq)));
    return [...codeMatches, ...nameMatches].slice(0, 30);
  }, [q, postable, recentIds]);

  useEffect(() => { setHi(0); }, [filtered]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (a: TJAcc) => {
    if (a.isParent || !a.allowPosting) { toast.warning("لا يمكن التقييد على حساب رئيسي أو عام"); return; }
    addRecentId(a.id.toString());
    onSelect(a.id.toString(), a.name ?? "", a.nature ?? "debit");
    setQ(a.code ?? "");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); return; }
    if (e.key === "Escape")    { setOpen(false); setQ(selected?.code ?? ""); return; }
    if (e.key === "F2")        { e.preventDefault(); onOpenPicker?.(); return; }
    if ((e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) && open && filtered[hi]) {
      e.preventDefault();
      pick(filtered[hi]);
      return;
    }
    externalKeyDown?.(e);
  };

  const displayText = open || !selected ? q : `${selected.code} — ${selected.name}`;

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        ref={el => { (inputRef as any).current = el; externalInputRef?.(el); }}
        value={displayText}
        dir="rtl"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); onFocusCb?.(); if (selected) setQ(""); }}
        onBlur={() => { setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); setQ(selected?.code ?? ""); } }, 120); }}
        onKeyDown={onKey}
        placeholder="كود أو اسم الحساب..."
        className={`h-7 w-full text-xs px-2 py-1 border border-input rounded-md bg-background
          focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/60
          ${selected ? "font-medium text-foreground" : "text-muted-foreground"}`}
      />
      {/* dropdown */}
      {open && (
        <div className="absolute top-full right-0 z-[9990] mt-0.5 w-80 bg-popover border border-border rounded-lg shadow-xl overflow-hidden" dir="rtl">
          {!q.trim() && recentIds.length > 0 && (
            <div className="px-3 py-1 text-[10px] text-muted-foreground bg-muted/30 border-b border-border flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" /> آخر المستخدمة
            </div>
          )}
          <div className="overflow-y-auto max-h-52">
            {filtered.length === 0 && <div className="text-xs text-center text-muted-foreground py-4">لا توجد نتائج</div>}
            {filtered.map((a, idx) => (
              <button key={a.id} onMouseDown={() => pick(a)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors
                  ${idx === hi ? "bg-primary/10" : "hover:bg-accent/50"}`}
              >
                <span className="font-mono text-[11px] text-muted-foreground w-16 text-right shrink-0">{a.code}</span>
                <span className="flex-1 text-right truncate">{a.name}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">↑↓ تنقل · Enter اختيار</span>
            {onOpenPicker && (
              <button onMouseDown={e => { e.preventDefault(); onOpenPicker(); }}
                className="text-[10px] text-primary hover:underline flex items-center gap-1">
                <Search className="w-2.5 h-2.5" /> F2 بحث موسّع
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Journal Entry (سند قيد) ──────────────────────────────────────────────────
// ─── Print styles (injected once) ────────────────────────────────────────────
const PRINT_STYLE_ID = "je-print-style";
if (!document.getElementById(PRINT_STYLE_ID)) {
  const s = document.createElement("style");
  s.id = PRINT_STYLE_ID;
  s.textContent = `@media print{body>*:not(#je-print-root){display:none!important}#je-print-root{display:block!important;position:fixed;inset:0;z-index:99999;background:#fff;padding:24px;font-family:Arial,sans-serif;direction:rtl}#je-print-root table{width:100%;border-collapse:collapse}#je-print-root th,#je-print-root td{border:1px solid #ccc;padding:4px 8px;font-size:11px}#je-print-root th{background:#f5f5f5}@page{margin:15mm}}`;
  document.head.appendChild(s);
}

const JE_DRAFT_PREFIX = "onesoft_je_draft_";

// ─── Source document metadata ─────────────────────────────────────────────────
const SOURCE_DOC_LABELS: Record<string, string> = {
  receipt_voucher:       "سند قبض",
  payment_voucher:       "سند صرف",
  purchase_invoice:      "فاتورة مشتريات",
  sales_invoice:         "فاتورة مبيعات",
  inventory_adjustment:  "تسوية مخزون",
  manufacturing:         "تصنيع",
  payroll:               "مرتبات",
};
const SOURCE_DOC_PAGE: Record<string, MenuId> = {
  receipt_voucher:  "receipt-voucher",
  payment_voucher:  "payment-voucher",
};

function JournalEntryPage({ voucherType = "journal", onNavigateTo }: { voucherType?: string; onNavigateTo?: (id: MenuId) => void }) {
  const DRAFT_KEY = JE_DRAFT_PREFIX + voucherType;
  const { setDirty, registerSave, confirmIfDirty } = useContext(DirtyCtx);
  const justLoadedRef  = useRef(true);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const handleSaveRef  = useRef<() => void>(() => {});

  const accountsQuery    = trpc.accounts.list.useQuery();
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const journalListQuery = trpc.journal.list.useQuery();
  const nextNumberQuery  = trpc.journal.nextNumber.useQuery();
  const jeBooksQuery     = trpc.documentJournals.list.useQuery({ docType: "journal_entry" });

  const createMutation = trpc.journal.create.useMutation({
    onSuccess: (data) => {
      toast.success("تم حفظ القيد بنجاح ✓");
      setSavedEntryId(data.id);
      setSavedEntryNumber(data.entryNumber);
      setEntryStatus("posted");
      localStorage.removeItem(DRAFT_KEY);
      journalListQuery.refetch();
      setDirty(false);
      saveResolveRef.current?.(true);
      saveResolveRef.current = null;
    },
    onError: (e) => {
      toast.error(e.message);
      saveResolveRef.current?.(false);
      saveResolveRef.current = null;
    },
  });
  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء القيد");
      setEntryStatus("cancelled");
      journalListQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const titleMap: Record<string, string> = {
    journal: "سند قيد", opening: "سند قيد افتتاحي", receipt: "سند قبض", payment: "سند صرف",
  };

  const emptyLine = () => ({ accountId: "", accountName: "", description: "", debit: "", credit: "", costCenterId: "", transferRelation: "", currency: "SAR", nature: "" });

  // ── Saved entry tracking ───────────────────────────────────────────────────
  const [savedEntryId,     setSavedEntryId]     = useState<number | null>(null);
  const [savedEntryNumber, setSavedEntryNumber] = useState<string>("");
  const [entryStatus,      setEntryStatus]      = useState<"new"|"draft"|"posted"|"cancelled">("new");

  // ── Form state ─────────────────────────────────────────────────────────────
  const [entryDate,     setEntryDate]     = useState(new Date().toISOString().split("T")[0]);
  const [description,   setDescription]   = useState("");
  const [analyticCode,  setAnalyticCode]  = useState(""); // kept for backward compat (not shown)
  const [basedOn,       setBasedOn]       = useState("");
  const [basedOnDocType, setBasedOnDocType] = useState("");
  const [jeJournalId,   setJeJournalId]   = useState<number | null>(null);
  const [sourceDocType,   setSourceDocType]   = useState("");
  const [sourceDocId,     setSourceDocId]     = useState<number | null>(null);
  const [sourceDocNumber, setSourceDocNumber] = useState("");
  const [entryType,       setEntryType]       = useState<"manual" | "auto">("manual");
  const [lines,         setLines]         = useState([emptyLine(), emptyLine()]);
  const [selectedLineIdx, setSelectedLineIdx] = useState(0);
  const [copiedLine,    setCopiedLine]    = useState<typeof lines[0] | null>(null);
  const cellRefs    = useRef<Map<string, HTMLInputElement>>(new Map());
  const accountRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const [recentIds,    setRecentIds]    = useState<string[]>(() => getRecentIds());
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickerTarget, setPickerTarget] = useState<number>(0);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navList = useMemo(() =>
    (journalListQuery.data ?? []).map(e => ({ id: e.id, entryNumber: e.entryNumber })).reverse(),
    [journalListQuery.data]);
  const [navIdx, setNavIdx] = useState(-1);

  const [loadEntryId, setLoadEntryId] = useState<number | null>(null);
  const loadedRef = useRef<number | null>(null);
  const entryQuery = trpc.journal.get.useQuery(
    { id: loadEntryId! },
    { enabled: !!loadEntryId }
  );
  useEffect(() => {
    if (!entryQuery.data || loadedRef.current === loadEntryId) return;
    justLoadedRef.current = true;
    loadedRef.current = loadEntryId;
    const e = entryQuery.data;
    setEntryDate(new Date(e.entryDate).toISOString().split("T")[0]);
    setDescription(e.description ?? "");
    setBasedOn(e.reference ?? "");
    setSourceDocType(e.sourceDocType ?? "");
    setSourceDocId(e.sourceDocId ?? null);
    setSourceDocNumber(e.sourceDocNumber ?? "");
    setEntryType((e.entryType as "manual" | "auto") ?? "manual");
    setSavedEntryId(e.id);
    setSavedEntryNumber(e.entryNumber);
    setEntryStatus(e.status as "posted"|"cancelled"|"draft");
    setLines(e.lines.length > 0
      ? e.lines.map(l => ({
          accountId: l.accountId?.toString() ?? "",
          accountName: l.accountName ?? "",
          description: l.description ?? "",
          debit: parseFloat(l.debit ?? "0") > 0 ? parseFloat(l.debit ?? "0").toFixed(3) : "",
          credit: parseFloat(l.credit ?? "0") > 0 ? parseFloat(l.credit ?? "0").toFixed(3) : "",
          costCenterId: l.costCenter ?? "",
          transferRelation: "",
          currency: "SAR",
          nature: "",
        }))
      : [emptyLine(), emptyLine()]);
  }, [entryQuery.data, loadEntryId]);

  const navigateTo = (idx: number) => {
    if (idx < 0 || idx >= navList.length) return;
    setNavIdx(idx);
    loadedRef.current = null;
    setLoadEntryId(navList[idx].id);
  };

  // ── Auto-draft ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const d = JSON.parse(draft);
        if (d.lines?.length) {
          setLines(d.lines);
          setDescription(d.description ?? "");
          setEntryDate(d.entryDate ?? new Date().toISOString().split("T")[0]);
          setBasedOn(d.basedOn ?? "");
          setEntryStatus("draft");
          toast.info("تم استرجاع مسودة القيد");
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (entryStatus !== "posted" && entryStatus !== "cancelled") {
      const hasDraft = lines.some(l => l.accountId || l.debit || l.credit);
      if (hasDraft) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ lines, description, entryDate, basedOn }));
      }
    }
  }, [lines, description, entryDate, basedOn, entryStatus, DRAFT_KEY]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff     = Math.abs(totalDebit - totalCredit);
  const balanced = diff < 0.001 && totalDebit > 0;

  // ── Mutations helpers ──────────────────────────────────────────────────────
  const updateLine = useCallback((i: number, field: string, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l)), []);

  const addLine = useCallback(() => setLines(prev => [...prev, emptyLine()]), []);

  const handleNew = useCallback(() => {
    justLoadedRef.current = true;
    setLines([emptyLine(), emptyLine()]);
    setDescription(""); setAnalyticCode(""); setBasedOn(""); setBasedOnDocType("");
    setJeJournalId(null);
    setSourceDocType(""); setSourceDocId(null); setSourceDocNumber(""); setEntryType("manual");
    setSelectedLineIdx(0);
    setSavedEntryId(null); setSavedEntryNumber(""); setEntryStatus("new");
    setNavIdx(-1); setLoadEntryId(null); loadedRef.current = null;
    localStorage.removeItem(DRAFT_KEY);
  }, [DRAFT_KEY]);

  const handleSave = useCallback(() => {
    if (!balanced) return toast.error("القيد غير متوازن — المدين ≠ الدائن");
    const badLines = lines.filter(l => {
      const hasAmount = parseFloat(l.debit || "0") > 0 || parseFloat(l.credit || "0") > 0;
      const hasText   = l.accountName.trim() !== "";
      if (!hasAmount && !hasText) return false;
      return !l.accountId || l.accountId === "0";
    });
    if (badLines.length > 0)
      return toast.error(`يوجد ${badLines.length > 1 ? badLines.length + " بنود" : "بند"} بحساب غير محدد — اختر من الدليل أو احذف البند`);
    const entryNumber = nextNumberQuery.data ?? `JE-${Date.now()}`;
    createMutation.mutate({
      entryNumber, entryDate, description,
      reference: basedOn || undefined,
      totalDebit: totalDebit.toFixed(3),
      totalCredit: totalCredit.toFixed(3),
      entryType: "manual",
      lines: lines
        .filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map((l, i) => ({
          sortOrder: i + 1,
          accountId: parseInt(l.accountId),
          accountName: l.accountName,
          description: l.description,
          debit: l.debit || "0",
          credit: l.credit || "0",
        })),
    });
  }, [balanced, nextNumberQuery.data, entryDate, description, basedOn, totalDebit, totalCredit, lines, createMutation]);

  const handleDuplicate = useCallback(() => {
    setSavedEntryId(null); setSavedEntryNumber(""); setEntryStatus("new");
    setNavIdx(-1); setLoadEntryId(null); loadedRef.current = null;
    setDescription(d => `نسخة من: ${d}`);
    setEntryDate(new Date().toISOString().split("T")[0]);
    toast.info("تم إنشاء نسخة — راجع البيانات ثم احفظ");
  }, []);

  const handleReverse = useCallback(() => {
    if (!savedEntryId) return toast.warning("احفظ القيد أولاً");
    setSavedEntryId(null); setSavedEntryNumber(""); setEntryStatus("new");
    setNavIdx(-1); setLoadEntryId(null); loadedRef.current = null;
    setLines(prev => prev.map(l => ({ ...l, debit: l.credit, credit: l.debit })));
    setDescription(d => `عكس القيد: ${savedEntryNumber} — ${d}`);
    setEntryDate(new Date().toISOString().split("T")[0]);
    toast.info("تم قلب المدين والدائن — راجع ثم احفظ");
  }, [savedEntryId, savedEntryNumber]);

  const handleDelete = useCallback(() => {
    if (!savedEntryId) return toast.warning("لا يوجد قيد محفوظ");
    if (!confirm(`هل تريد إلغاء القيد ${savedEntryNumber}؟`)) return;
    deleteMutation.mutate({ id: savedEntryId });
  }, [savedEntryId, savedEntryNumber, deleteMutation]);

  const handlePrint = useCallback(() => {
    const root = document.getElementById("je-print-root") ?? document.createElement("div");
    root.id = "je-print-root";
    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div><strong style="font-size:14px">${titleMap[voucherType] ?? "سند قيد"}</strong></div>
        <div style="font-size:11px;color:#555">
          ${savedEntryNumber ? `رقم القيد: <strong>${savedEntryNumber}</strong> &nbsp;&nbsp;` : ""}
          التاريخ: <strong>${entryDate}</strong>
        </div>
      </div>
      ${description ? `<div style="margin-bottom:8px;font-size:11px">البيان: <strong>${description}</strong></div>` : ""}
      <table>
        <thead><tr><th>#</th><th>الحساب</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>
          ${lines.filter(l => l.accountId).map((l, i) => `
            <tr>
              <td style="text-align:center">${i + 1}</td>
              <td>${l.accountName}</td>
              <td>${l.description}</td>
              <td style="text-align:center">${parseFloat(l.debit||"0")>0 ? parseFloat(l.debit||"0").toFixed(3) : ""}</td>
              <td style="text-align:center">${parseFloat(l.credit||"0")>0 ? parseFloat(l.credit||"0").toFixed(3) : ""}</td>
            </tr>`).join("")}
          <tr style="background:#f5f5f5;font-weight:bold">
            <td colspan="3" style="text-align:right">الإجمالي</td>
            <td style="text-align:center">${totalDebit.toFixed(3)}</td>
            <td style="text-align:center">${totalCredit.toFixed(3)}</td>
          </tr>
        </tbody>
      </table>`;
    if (!root.parentElement) document.body.appendChild(root);
    window.print();
    setTimeout(() => root.remove(), 500);
  }, [lines, description, entryDate, savedEntryNumber, totalDebit, totalCredit, voucherType, titleMap]);

  // ── F2 / Ctrl+K / Ctrl+S / Ctrl+D / Ctrl+P / F3 ──────────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "F2" || (e.ctrlKey && e.key === "k")) {
        e.preventDefault(); setPickerTarget(selectedLineIdx); setShowPicker(true);
      }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === "d") { e.preventDefault(); handleDuplicate(); }
      if (e.ctrlKey && e.key === "p") { e.preventDefault(); handlePrint(); }
      if (e.key === "F3") { e.preventDefault(); confirmIfDirty(handleNew); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedLineIdx, handleSave, handleDuplicate, handlePrint, handleNew, confirmIfDirty]);

  // ── Account select ─────────────────────────────────────────────────────────
  const handleAccountSelect = useCallback((lineIdx: number, id: string, name: string, nature: string) => {
    setLines(prev => prev.map((l, i) => i === lineIdx ? { ...l, accountId: id, accountName: name, nature } : l));
    setRecentIds(getRecentIds());
    setTimeout(() => cellRefs.current.get(`${lineIdx}-0`)?.focus(), 50);
  }, []);

  // ── Cell keyboard navigation ───────────────────────────────────────────────
  const JCOLS = 4;
  const handleCellKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault(); setCopiedLine({ ...lines[rowIdx] }); toast.info(`نسخ السطر ${rowIdx + 1}`); return;
    }
    if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      if (!copiedLine) { toast.warning("لا يوجد سطر منسوخ"); return; }
      setLines(prev => { const u = [...prev]; u.splice(rowIdx + 1, 0, { ...copiedLine }); return u; });
      setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50); return;
    }
    if (e.ctrlKey && e.key === "Delete") {
      e.preventDefault();
      if (lines.length > 2) { setLines(prev => prev.filter((_, i) => i !== rowIdx)); setSelectedLineIdx(Math.max(0, rowIdx - 1)); }
      return;
    }
    if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < JCOLS) {
        cellRefs.current.get(`${rowIdx}-${nextCol}`)?.focus();
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow < lines.length) {
          setSelectedLineIdx(nextRow); accountRefs.current.get(nextRow)?.focus();
        } else {
          addLine(); setTimeout(() => { setSelectedLineIdx(nextRow); accountRefs.current.get(nextRow)?.focus(); }, 50);
        }
      }
      return;
    }
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevCol = colIdx - 1;
      if (prevCol >= -1) {
        prevCol === -1 ? accountRefs.current.get(rowIdx)?.focus() : cellRefs.current.get(`${rowIdx}-${prevCol}`)?.focus();
      } else if (rowIdx > 0) {
        setSelectedLineIdx(rowIdx - 1); cellRefs.current.get(`${rowIdx - 1}-${JCOLS - 1}`)?.focus();
      }
    }
  }, [lines, copiedLine, addLine]);

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = useMemo(() => {
    const map: Record<string, { label: string; cls: string }> = {
      new:       { label: "جديد",      cls: "bg-sky-50 text-sky-600 border-sky-200" },
      draft:     { label: "مسودة",     cls: "bg-amber-50 text-amber-600 border-amber-200" },
      posted:    { label: "مرحّل",     cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
      cancelled: { label: "ملغي",      cls: "bg-rose-50 text-rose-600 border-rose-200" },
    };
    const s = map[entryStatus] ?? map.new;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>{s.label}</span>;
  }, [entryStatus]);

  // ── Dirty tracking + save registration ────────────────────────────────────
  handleSaveRef.current = handleSave;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (justLoadedRef.current) { justLoadedRef.current = false; return; }
    setDirty(true);
  }, [lines, description, entryDate, basedOn]);

  useEffect(() => {
    registerSave(() =>
      new Promise<boolean>(resolve => {
        saveResolveRef.current = resolve;
        handleSaveRef.current();
        setTimeout(() => {
          if (saveResolveRef.current) { saveResolveRef.current(false); saveResolveRef.current = null; }
        }, 10000);
      })
    );
    return () => registerSave(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSave]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2" dir="rtl">

      {/* ── Professional Toolbar ── */}
      <div className="flex items-center gap-0.5 bg-muted/40 border border-border/60 rounded-lg px-2 py-1.5 flex-wrap">

        {/* Group: New / Save */}
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-emerald-50 hover:text-emerald-700"
          onClick={() => confirmIfDirty(handleNew)} title="F3">
          <Plus className="w-3.5 h-3.5" /> جديد
        </Button>
        <Button variant="ghost" size="sm"
          className={`h-7 text-xs gap-1 px-2 ${balanced ? "hover:bg-emerald-50 hover:text-emerald-700" : "opacity-50"}`}
          disabled={!balanced || createMutation.isPending || entryStatus === "posted"}
          onClick={handleSave} title="Ctrl+S">
          <Check className="w-3.5 h-3.5" /> حفظ
        </Button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        {/* Group: Duplicate / Reverse */}
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-sky-50 hover:text-sky-700"
          onClick={handleDuplicate} title="Ctrl+D" disabled={!savedEntryId}>
          <Copy className="w-3.5 h-3.5" /> نسخة مماثلة
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-purple-50 hover:text-purple-700"
          onClick={handleReverse} title="Ctrl+R" disabled={!savedEntryId}>
          <RefreshCw className="w-3.5 h-3.5" /> عكس القيد
        </Button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        {/* Group: Print / PDF */}
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-slate-100"
          onClick={handlePrint} title="Ctrl+P">
          <Printer className="w-3.5 h-3.5" /> طباعة
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-slate-100"
          onClick={handlePrint}>
          <FileDown className="w-3.5 h-3.5" /> PDF
        </Button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        {/* Group: Delete */}
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2 hover:bg-rose-50 hover:text-rose-700"
          onClick={handleDelete} disabled={!savedEntryId || entryStatus === "cancelled"}>
          <Trash2 className="w-3.5 h-3.5" /> حذف
        </Button>

        <div className="w-px h-5 bg-border/60 mx-1" />

        {/* Group: Navigation */}
        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 hover:bg-muted"
          disabled={navList.length === 0} onClick={() => confirmIfDirty(() => navigateTo(0))} title="أول قيد">
          <span className="text-[10px] font-mono">|◀</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 hover:bg-muted"
          disabled={navIdx <= 0} onClick={() => confirmIfDirty(() => navigateTo(navIdx - 1))} title="السابق">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground px-1 min-w-[48px] text-center">
          {navIdx >= 0 ? `${navIdx + 1}/${navList.length}` : `—/${navList.length}`}
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 hover:bg-muted"
          disabled={navIdx >= navList.length - 1} onClick={() => confirmIfDirty(() => navigateTo(navIdx + 1))} title="التالي">
          <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 hover:bg-muted"
          disabled={navList.length === 0} onClick={() => confirmIfDirty(() => navigateTo(navList.length - 1))} title="آخر قيد">
          <span className="text-[10px] font-mono">▶|</span>
        </Button>

        {/* Status + Entry Number */}
        <div className="mr-auto flex items-center gap-2">
          {savedEntryNumber && (
            <span className="text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
              {savedEntryNumber}
            </span>
          )}
          {statusBadge}
        </div>
      </div>

      {/* ── Header Fields ── */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          {/* Row 1: قيد # (dropdown) | تاريخ التحرير */}
          {(() => {
            const selBook = (jeBooksQuery.data ?? []).find(j => j.id === jeJournalId);
            const nextSerial = selBook
              ? `${selBook.numberPrefix}-${String((selBook.currentSeq ?? 0) + 1).padStart(selBook.numDigits ?? 4, '0')}`
              : savedEntryNumber || nextNumberQuery.data || "...";
            return (
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">قيد #</Label>
                  <Select value={jeJournalId ? jeJournalId.toString() : "none"} onValueChange={v => setJeJournalId(v === "none" ? null : parseInt(v))} disabled={entryType === "auto"}>
                    <SelectTrigger className="h-7 text-xs w-full font-mono">
                      {jeJournalId && selBook
                        ? <span className="font-mono text-xs">{nextSerial} — {selBook.code} {selBook.name}</span>
                        : <span className="text-muted-foreground text-xs">اختر الدفتر...</span>
                      }
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— اختر الدفتر —</SelectItem>
                      {(jeBooksQuery.data ?? []).map(j => (
                        <SelectItem key={j.id} value={j.id.toString()}>
                          <span className="font-mono text-xs text-muted-foreground ml-2">{j.code}</span> {j.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">تاريخ التحرير</Label>
                  <DateMaskInput value={entryDate} onChange={setEntryDate} className="h-7 text-xs" disabled={entryType === "auto"} />
                </div>
              </div>
            );
          })()}

          {/* Row 2: شرح | بناءا على | رقم المستند */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">شرح</Label>
              {entryType === "auto"
                ? <Input value={description} readOnly className="h-7 text-xs bg-muted/20" />
                : <Input value={description} onChange={e => setDescription(e.target.value)} className="h-7 text-xs" placeholder="وصف القيد..." />
              }
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">بناءا على</Label>
              {entryType === "auto"
                ? <Input value={SOURCE_DOC_LABELS[sourceDocType] ?? sourceDocType} readOnly className="h-7 text-xs bg-amber-50/40 border-amber-200/60 text-amber-800" />
                : <Select value={basedOnDocType || "none"} onValueChange={v => setBasedOnDocType(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 text-xs w-full">
                      <SelectValue placeholder="نوع المستند..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— بدون —</SelectItem>
                      <SelectItem value="sales_invoice">فاتورة مبيعات</SelectItem>
                      <SelectItem value="purchase_invoice">فاتورة مشتريات</SelectItem>
                      <SelectItem value="receipt_voucher">سند قبض</SelectItem>
                      <SelectItem value="payment_voucher">سند صرف</SelectItem>
                      <SelectItem value="journal_entry">سند قيد</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
              }
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">رقم المستند</Label>
              {entryType === "auto"
                ? <button
                    onClick={() => {
                      const page = SOURCE_DOC_PAGE[sourceDocType];
                      if (page && onNavigateTo) { onNavigateTo(page); }
                      else toast.info(`المستند: ${sourceDocNumber}`);
                    }}
                    className="h-7 w-full flex items-center gap-1.5 text-xs px-2 bg-amber-50/40 border border-amber-200/60 rounded-md text-amber-700 hover:bg-amber-100 hover:text-amber-800 transition-colors font-mono"
                    title="انقر لفتح المستند الأصلي"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {sourceDocNumber || "—"}
                  </button>
                : <Input value={basedOn} onChange={e => setBasedOn(e.target.value)} className="h-7 text-xs font-mono" placeholder="رقم المستند..." />
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Lines Table ── */}
      <AccountPickerDialog
        open={showPicker}
        onClose={() => setShowPicker(false)}
        accounts={(accountsQuery.data ?? []) as TJAcc[]}
        recentIds={recentIds}
        onSelect={(id, name, nature) => { handleAccountSelect(pickerTarget, id, name, nature); setShowPicker(false); }}
      />

      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-8 text-center">#</TableHead>
                <TableHead className="text-xs min-w-[220px]">الحساب</TableHead>
                <TableHead className="text-xs">شرح</TableHead>
                <TableHead className="text-xs text-center w-28 text-sky-700">مدين</TableHead>
                <TableHead className="text-xs text-center w-28 text-rose-700">دائن</TableHead>
                <TableHead className="text-xs w-24">عملة</TableHead>
                <TableHead className="text-xs w-28">مركز التكلفة</TableHead>
                <TableHead className="text-xs w-28">علاقة التحويل</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => {
                const hasDebit  = parseFloat(line.debit  || "0") > 0;
                const hasCredit = parseFloat(line.credit || "0") > 0;
                const rowColor  = selectedLineIdx === i
                  ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                  : hasDebit  ? "bg-sky-50/40 hover:bg-sky-50/60"
                  : hasCredit ? "bg-rose-50/30 hover:bg-rose-50/50"
                  : "hover:bg-muted/10";
                return (
                  <TableRow key={i} className={rowColor} onClick={() => setSelectedLineIdx(i)}>
                    <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="min-w-[220px] py-1">
                      <SmartAccountInput
                        accounts={(accountsQuery.data ?? []) as TJAcc[]}
                        selectedId={line.accountId}
                        recentIds={recentIds}
                        onSelect={(id, name, nature) => handleAccountSelect(i, id, name, nature)}
                        onOpenPicker={() => { setPickerTarget(i); setShowPicker(true); }}
                        onFocusCb={() => setSelectedLineIdx(i)}
                        externalKeyDown={e => handleCellKeyDown(e as any, i, -1)}
                        inputRef={el => { if (el) accountRefs.current.set(i, el); else accountRefs.current.delete(i); }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={el => { if (el) cellRefs.current.set(`${i}-0`, el); }}
                        value={line.description}
                        onChange={e => updateLine(i, "description", e.target.value)}
                        onFocus={() => setSelectedLineIdx(i)}
                        onKeyDown={e => handleCellKeyDown(e, i, 0)}
                        className="h-7 text-xs" placeholder="البيان..."
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={el => { if (el) cellRefs.current.set(`${i}-1`, el); }}
                        type="number" value={line.debit} min={0}
                        onChange={e => { updateLine(i, "debit", e.target.value); if (e.target.value) updateLine(i, "credit", ""); }}
                        onFocus={e => { setSelectedLineIdx(i); e.target.select(); }}
                        onKeyDown={e => handleCellKeyDown(e, i, 1)}
                        className="h-7 text-xs text-center bg-sky-50/30 focus:bg-white"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={el => { if (el) cellRefs.current.set(`${i}-2`, el); }}
                        type="number" value={line.credit} min={0}
                        onChange={e => { updateLine(i, "credit", e.target.value); if (e.target.value) updateLine(i, "debit", ""); }}
                        onFocus={e => { setSelectedLineIdx(i); e.target.select(); }}
                        onKeyDown={e => handleCellKeyDown(e, i, 2)}
                        className="h-7 text-xs text-center bg-rose-50/30 focus:bg-white"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={line.currency} onValueChange={v => updateLine(i, "currency", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAR">SAR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={line.costCenterId} onValueChange={v => updateLine(i, "costCenterId", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="مركز..." /></SelectTrigger>
                        <SelectContent>
                          {costCentersQuery.data?.map(c => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        ref={el => { if (el) cellRefs.current.set(`${i}-3`, el); }}
                        value={line.transferRelation}
                        onChange={e => updateLine(i, "transferRelation", e.target.value)}
                        onFocus={() => setSelectedLineIdx(i)}
                        onKeyDown={e => handleCellKeyDown(e, i, 3)}
                        className="h-7 text-xs" placeholder="علاقة..."
                      />
                    </TableCell>
                    <TableCell>
                      {lines.length > 2 && (
                        <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive p-1"><X className="w-3 h-3" /></button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell colSpan={3} className="text-xs font-bold text-right pr-4">الإجمالي</TableCell>
                <TableCell className="text-center text-sm font-bold text-sky-700">{totalDebit.toFixed(3)}</TableCell>
                <TableCell className="text-center text-sm font-bold text-rose-700">{totalCredit.toFixed(3)}</TableCell>
                <TableCell colSpan={4}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="p-3 flex items-center justify-between border-t border-border bg-muted/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
              <Plus className="w-3 h-3" /> إضافة سطر
            </Button>
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Tab/Enter: التالي · F2: بحث موسّع · Ctrl+S: حفظ · Ctrl+D: نسخة · F3: جديد
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs flex items-center gap-1">
              <span className="text-muted-foreground">مدين:</span>
              <span className="font-bold text-sky-700">{totalDebit.toFixed(3)}</span>
            </div>
            <div className="text-xs flex items-center gap-1">
              <span className="text-muted-foreground">الفرق:</span>
              <span className={`font-bold ${diff < 0.001 ? "text-emerald-600" : "text-rose-600"}`}>{diff.toFixed(3)}</span>
            </div>
            <div className="text-xs flex items-center gap-1">
              <span className="text-muted-foreground">دائن:</span>
              <span className="font-bold text-rose-700">{totalCredit.toFixed(3)}</span>
            </div>
            <Button size="sm"
              className={`h-7 text-xs gap-1 ${balanced ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              disabled={!balanced || createMutation.isPending || entryStatus === "posted"}
              onClick={handleSave}>
              <Check className="w-3 h-3" />
              {createMutation.isPending ? "جاري الحفظ..." : "حفظ القيد"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Receipt Voucher (سند قبض) ────────────────────────────────────────────────
function ReceiptVoucherPage() {
  const { setDirty, registerSave } = useContext(DirtyCtx);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const handleSaveRef  = useRef<() => void>(() => {});

  const accountsQuery = trpc.accounts.list.useQuery();
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const listQuery = trpc.receiptVouchers.list.useQuery();
  const createMutation = trpc.receiptVouchers.create.useMutation({
    onSuccess: (data) => {
      if (data.journalEntryNumber)
        toast.success(`تم حفظ سند القبض وإنشاء القيد ${data.journalEntryNumber} تلقائياً ✓`);
      else
        toast.success("تم حفظ سند القبض");
      listQuery.refetch();
      setShowForm(false);
      setDirty(false);
      saveResolveRef.current?.(true);
      saveResolveRef.current = null;
    },
    onError: (e) => {
      toast.error(e.message);
      saveResolveRef.current?.(false);
      saveResolveRef.current = null;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    voucherDate: new Date().toISOString().split("T")[0],
    receivedFrom: "", amount: "", paymentMethod: "cash" as const,
    bankAccount: "", checkNumber: "", description: "",
    accountId: "", contraAccountId: "", costCenterId: "", notes: "",
  });

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("أدخل المبلغ");
    createMutation.mutate({
      voucherNumber: `RCV-${Date.now()}`,
      voucherDate: new Date(form.voucherDate),
      receivedFrom: form.receivedFrom,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      bankAccount: form.bankAccount || undefined,
      checkNumber: form.checkNumber || undefined,
      description: form.description,
      accountId: form.accountId ? parseInt(form.accountId) : undefined,
      contraAccountId: form.contraAccountId ? parseInt(form.contraAccountId) : undefined,
      costCenterId: form.costCenterId ? parseInt(form.costCenterId) : undefined,
      notes: form.notes,
    });
  };

  handleSaveRef.current = handleSave;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showForm) { setDirty(false); return; }
    const changed = form.receivedFrom.trim() !== "" || form.amount !== "" ||
      form.description.trim() !== "" || form.accountId !== "" || form.contraAccountId !== "";
    setDirty(changed);
  }, [showForm, form.receivedFrom, form.amount, form.description, form.accountId, form.contraAccountId]);

  useEffect(() => {
    if (!showForm) { registerSave(null); return; }
    registerSave(() =>
      new Promise<boolean>(resolve => {
        saveResolveRef.current = resolve;
        handleSaveRef.current();
        setTimeout(() => { if (saveResolveRef.current) { saveResolveRef.current(false); saveResolveRef.current = null; } }, 10000);
      })
    );
    return () => registerSave(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, registerSave]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <ArrowDownCircle className="w-4 h-4 text-emerald-500" /> سند قبض
        </h3>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> سند قبض جديد
        </Button>
      </div>

      {/* List */}
      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">رقم السند</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">المستلم من</TableHead>
              <TableHead className="text-xs">طريقة الدفع</TableHead>
              <TableHead className="text-xs text-center">المبلغ</TableHead>
              <TableHead className="text-xs">البيان</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data?.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">لا توجد سندات قبض</TableCell></TableRow>
            )}
            {listQuery.data?.map(v => (
              <TableRow key={v.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-mono">{v.voucherNumber}</TableCell>
                <TableCell className="text-xs">{new Date(v.voucherDate).toLocaleDateString("ar-SA")}</TableCell>
                <TableCell className="text-xs">{v.receivedFrom ?? "-"}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="text-xs">{(v.paymentMethod as string) === "cash" ? "نقدي" : (v.paymentMethod as string) === "check" ? "شيك" : (v.paymentMethod as string) === "transfer" ? "تحويل" : "بطاقة"}</Badge>
                </TableCell>
                <TableCell className="text-center text-sm font-bold text-emerald-600">{parseFloat(v.amount ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-xs">{v.description ?? "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Printer className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setDirty(false); setShowForm(v); }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-emerald-500" /> إضافة سند قبض
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">التاريخ</Label>
                <DateMaskInput value={form.voucherDate} onChange={v => setF("voucherDate", v)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">المستلم من</Label>
                <Input value={form.receivedFrom} onChange={e => setF("receivedFrom", e.target.value)} className="h-8 text-xs" placeholder="اسم العميل أو الجهة..." />
              </div>
              <div>
                <Label className="text-xs">المبلغ</Label>
                <Input type="number" value={form.amount} onChange={e => setF("amount", e.target.value)} className="h-8 text-xs" placeholder="0.000" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">طريقة الدفع</Label>
                <Select value={form.paymentMethod} onValueChange={v => setF("paymentMethod", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الحساب المدين</Label>
                <Select value={form.accountId} onValueChange={v => setF("accountId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب..." /></SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الحساب الدائن (المقابل)</Label>
                <Select value={form.contraAccountId} onValueChange={v => setF("contraAccountId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب..." /></SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.paymentMethod as string) === "check" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">رقم الشيك</Label>
                  <Input value={form.checkNumber} onChange={e => setF("checkNumber", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">البنك</Label>
                  <Input value={form.bankAccount} onChange={e => setF("bankAccount", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">البيان</Label>
              <Input value={form.description} onChange={e => setF("description", e.target.value)} className="h-8 text-xs" placeholder="وصف السند..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleSave} disabled={createMutation.isPending}>
                <Check className="w-3 h-3 ml-1" /> حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Payment Voucher (سند صرف) ────────────────────────────────────────────────
function PaymentVoucherPage() {
  const { setDirty, registerSave } = useContext(DirtyCtx);
  const saveResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const handleSaveRef  = useRef<() => void>(() => {});

  const accountsQuery = trpc.accounts.list.useQuery();
  const listQuery = trpc.paymentVouchers.list.useQuery();
  const createMutation = trpc.paymentVouchers.create.useMutation({
    onSuccess: (data) => {
      if (data.journalEntryNumber)
        toast.success(`تم حفظ سند الصرف وإنشاء القيد ${data.journalEntryNumber} تلقائياً ✓`);
      else
        toast.success("تم حفظ سند الصرف");
      listQuery.refetch();
      setShowForm(false);
      setDirty(false);
      saveResolveRef.current?.(true);
      saveResolveRef.current = null;
    },
    onError: (e) => {
      toast.error(e.message);
      saveResolveRef.current?.(false);
      saveResolveRef.current = null;
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    voucherDate: new Date().toISOString().split("T")[0],
    paidTo: "", amount: "", paymentMethod: "cash" as const,
    bankAccount: "", checkNumber: "", description: "",
    accountId: "", contraAccountId: "", notes: "",
  });
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error("أدخل المبلغ");
    createMutation.mutate({
      voucherNumber: `PAY-${Date.now()}`,
      voucherDate: new Date(form.voucherDate),
      paidTo: form.paidTo,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      bankAccount: form.bankAccount || undefined,
      checkNumber: form.checkNumber || undefined,
      description: form.description,
      accountId: form.accountId ? parseInt(form.accountId) : undefined,
      contraAccountId: form.contraAccountId ? parseInt(form.contraAccountId) : undefined,
      notes: form.notes,
    });
  };

  handleSaveRef.current = handleSave;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showForm) { setDirty(false); return; }
    const changed = form.paidTo.trim() !== "" || form.amount !== "" ||
      form.description.trim() !== "" || form.accountId !== "" || form.contraAccountId !== "";
    setDirty(changed);
  }, [showForm, form.paidTo, form.amount, form.description, form.accountId, form.contraAccountId]);

  useEffect(() => {
    if (!showForm) { registerSave(null); return; }
    registerSave(() =>
      new Promise<boolean>(resolve => {
        saveResolveRef.current = resolve;
        handleSaveRef.current();
        setTimeout(() => { if (saveResolveRef.current) { saveResolveRef.current(false); saveResolveRef.current = null; } }, 10000);
      })
    );
    return () => registerSave(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, registerSave]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4 text-destructive" /> سند صرف
        </h3>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> سند صرف جديد
        </Button>
      </div>

      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">رقم السند</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">المدفوع لـ</TableHead>
              <TableHead className="text-xs">طريقة الدفع</TableHead>
              <TableHead className="text-xs text-center">المبلغ</TableHead>
              <TableHead className="text-xs">البيان</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data?.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">لا توجد سندات صرف</TableCell></TableRow>
            )}
            {listQuery.data?.map(v => (
              <TableRow key={v.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-mono">{v.voucherNumber}</TableCell>
                <TableCell className="text-xs">{new Date(v.voucherDate).toLocaleDateString("ar-SA")}</TableCell>
                <TableCell className="text-xs">{v.paidTo ?? "-"}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="text-xs">{v.paymentMethod === "cash" ? "نقدي" : v.paymentMethod === "check" ? "شيك" : "تحويل"}</Badge>
                </TableCell>
                <TableCell className="text-center text-sm font-bold text-destructive">{parseFloat(v.amount ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-xs">{v.description ?? "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs"><Printer className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showForm} onOpenChange={v => { if (!v) setDirty(false); setShowForm(v); }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-destructive" /> إضافة سند صرف
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">التاريخ</Label>
                <DateMaskInput value={form.voucherDate} onChange={v => setF("voucherDate", v)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">المدفوع لـ</Label>
                <Input value={form.paidTo} onChange={e => setF("paidTo", e.target.value)} className="h-8 text-xs" placeholder="اسم المورد أو الجهة..." />
              </div>
              <div>
                <Label className="text-xs">المبلغ</Label>
                <Input type="number" value={form.amount} onChange={e => setF("amount", e.target.value)} className="h-8 text-xs" placeholder="0.000" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">طريقة الدفع</Label>
                <Select value={form.paymentMethod} onValueChange={v => setF("paymentMethod", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الحساب الدائن (الخزينة)</Label>
                <Select value={form.accountId} onValueChange={v => setF("accountId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب..." /></SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الحساب المدين (المقابل)</Label>
                <Select value={form.contraAccountId} onValueChange={v => setF("contraAccountId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب..." /></SelectTrigger>
                  <SelectContent>
                    {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">البيان</Label>
              <Input value={form.description} onChange={e => setF("description", e.target.value)} className="h-8 text-xs" placeholder="وصف السند..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleSave} disabled={createMutation.isPending}>
                <Check className="w-3 h-3 ml-1" /> حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Journal List (دفتر اليومية) ──────────────────────────────────────────────
function JournalListPage({ onOpenEntry }: { onOpenEntry?: (id: number) => void }) {
  const listQuery = trpc.journal.list.useQuery({});
  const [search, setSearch] = useState("");
  const filtered = listQuery.data?.filter(e =>
    !search || e.entryNumber?.includes(search) || e.description?.includes(search)
  ) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" /> القيود اليومية
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pr-7 w-48" placeholder="بحث..." />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => listQuery.refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">رقم القيد</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">نوع السند</TableHead>
              <TableHead className="text-xs">البيان</TableHead>
              <TableHead className="text-xs text-center">إجمالي مدين</TableHead>
              <TableHead className="text-xs text-center">إجمالي دائن</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">لا توجد قيود</TableCell></TableRow>
            )}
            {filtered.map(e => (
              <TableRow key={e.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => onOpenEntry?.(e.id)}>
                <TableCell className="text-xs font-mono text-primary">{e.entryNumber}</TableCell>
                <TableCell className="text-xs">{new Date(e.entryDate).toLocaleDateString("ar-SA")}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant="outline" className="text-xs">
                    {e.voucherType === "journal" ? "قيد يومي" : e.voucherType === "receipt" ? "سند قبض" : e.voucherType === "payment" ? "سند صرف" : e.voucherType === "opening" ? "قيد افتتاحي" : e.voucherType}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{e.description ?? "-"}</TableCell>
                <TableCell className="text-center text-xs font-semibold">{parseFloat(e.totalDebit ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-semibold">{parseFloat(e.totalCredit ?? "0").toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Printer className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Tree View Types & Components ────────────────────────────────────────────
type TAccount = {
  id: number;
  code: string | null;
  name: string | null;
  accountType: string | null;
  nature: string | null;
  level: number | null;
  isParent: boolean | null;
  allowPosting: boolean | null;
  parentId: number | null;
};

const TREE_INDENT = 18;

const lvlBg = (l: number) => [
  "", "bg-blue-50/70 border-b border-blue-100", "bg-slate-50/50 border-b border-slate-100",
  "border-b border-slate-100/70", "border-b border-slate-100/50", "border-b border-slate-100/30"
][Math.min(l, 5)] ?? "";

const lvlText = (l: number) => [
  "", "text-blue-900 font-black text-sm", "text-blue-700 font-bold text-xs",
  "text-slate-700 font-semibold text-xs", "text-slate-600 text-xs", "text-slate-500 text-[11px]"
][Math.min(l, 5)] ?? "text-xs";

const treeTypeLabel = (t: string | null) =>
  ({ assets:"أصول", liabilities:"خصوم", equity:"حقوق ملكية", revenue:"إيرادات", expenses:"مصروفات" }[t ?? ""] ?? (t ?? ""));

// ─── Tree Context Menu ────────────────────────────────────────────────────────
type CtxMenuState = { account: TAccount; x: number; y: number } | null;

function TreeContextMenu({
  state, onClose, onAddChild, onView, onCopy, onDelete,
}: {
  state: CtxMenuState;
  onClose: () => void;
  onAddChild: (a: TAccount) => void;
  onView: (a: TAccount) => void;
  onCopy: (a: TAccount) => void;
  onDelete: (id: number, name: string) => void;
}) {
  useEffect(() => {
    if (!state) return;
    const handleClick = () => onClose();
    const handleKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("click", handleClick, { once: true }), 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 210;
  const menuH = state.account.isParent ? 280 : 230;
  const x = state.x + menuW > vw ? state.x - menuW : state.x;
  const y = state.y + menuH > vh ? state.y - menuH : state.y;

  const sep = <div className="my-1 border-t border-border/60" />;

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    colorCls = "text-foreground hover:bg-accent",
  ) => (
    <button
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs rounded transition-colors ${colorCls}`}
      onClick={e => { e.stopPropagation(); onClick(); onClose(); }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div
      dir="rtl"
      className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-lg p-1.5 min-w-[210px]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {/* header */}
      <div className="px-3 py-1.5 mb-1 border-b border-border/60">
        <p className="text-[10px] text-muted-foreground">حساب</p>
        <p className="text-xs font-semibold truncate max-w-[180px]">{state.account.code} — {state.account.name}</p>
      </div>

      {/* إضافة حساب فرعي — only if parent */}
      {state.account.isParent && item(
        <PlusCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
        "إضافة حساب فرعي",
        () => onAddChild(state.account),
        "text-emerald-700 hover:bg-emerald-50",
      )}

      {item(<Eye className="w-3.5 h-3.5 shrink-0" />, "عرض الحساب", () => onView(state.account))}
      {item(<Edit2 className="w-3.5 h-3.5 shrink-0" />, "تعديل الحساب", () => {
        toast.info("قريباً — تعديل الحساب");
      })}
      {item(<Copy className="w-3.5 h-3.5 shrink-0" />, "نسخ الحساب", () => onCopy(state.account))}

      {sep}

      {item(
        <PowerOff className="w-3.5 h-3.5 shrink-0" />,
        "تعطيل الحساب",
        () => toast.info("قريباً — تعطيل الحساب"),
        "text-amber-700 hover:bg-amber-50",
      )}

      {sep}

      {item(
        <Trash2 className="w-3.5 h-3.5 shrink-0" />,
        "حذف الحساب",
        () => onDelete(state.account.id, state.account.name ?? ""),
        "text-red-600 hover:bg-red-50",
      )}
    </div>
  );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────
function AccountTreeNode({ account, depth, selectedId, onSelect, onDelete, onContextMenu }: {
  account: TAccount;
  depth: number;
  selectedId: number | null;
  onSelect: (a: TAccount) => void;
  onDelete: (id: number, name: string) => void;
  onContextMenu: (a: TAccount, e: React.MouseEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lvl = account.level ?? 1;

  const childrenQ = trpc.accounts.children.useQuery(
    { parentId: account.id },
    { enabled: expanded && !!account.isParent, staleTime: 30_000 }
  );

  const isSelected = selectedId === account.id;

  return (
    <>
      <div
        className={`flex items-center gap-1 py-1.5 cursor-pointer group transition-colors
          ${lvlBg(lvl)} ${isSelected ? "!bg-blue-100 ring-1 ring-inset ring-blue-400" : "hover:!bg-blue-50/60"}`}
        style={{ paddingRight: `${8 + depth * TREE_INDENT}px`, paddingLeft: "8px" }}
        onClick={() => onSelect(account)}
        onContextMenu={e => { e.preventDefault(); onContextMenu(account, e); }}
      >
        {/* toggle */}
        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
          {account.isParent ? (
            <button
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-blue-200/70 text-blue-500"
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : <span className="w-3.5" />}
        </span>

        {/* icon */}
        {account.isParent
          ? (expanded
              ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              : <Folder     className="w-3.5 h-3.5 text-amber-400 shrink-0" />)
          : <FileText className="w-3 h-3 text-slate-300 shrink-0" />}

        {/* code */}
        <span className={`font-mono shrink-0 w-24 ${lvlText(lvl)}`}>{account.code}</span>

        {/* name */}
        <span className={`flex-1 truncate ${lvlText(lvl)}`}>{account.name}</span>

        {/* meta — visible on hover */}
        <span className="hidden group-hover:flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400">{treeTypeLabel(account.accountType)}</span>
          <span className={`text-[10px] px-1 rounded font-medium ${account.nature === "debit" ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}`}>
            {account.nature === "debit" ? "مدين" : "دائن"}
          </span>
        </span>

        {/* level pill */}
        <span className="text-[10px] text-slate-300 w-4 text-center shrink-0">{account.level}</span>

        {/* context menu trigger (hover) */}
        <span className="opacity-0 group-hover:opacity-100 shrink-0 flex items-center gap-0.5">
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200/80 text-slate-400 hover:text-slate-600"
            onClick={e => { e.stopPropagation(); onContextMenu(account, e); }}
            title="خيارات"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
          {!account.isParent && (
            <button
              className="text-red-300 hover:text-red-500"
              onClick={e => { e.stopPropagation(); onDelete(account.id, account.name ?? ""); }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </span>
      </div>

      {/* children */}
      {expanded && (
        childrenQ.isLoading
          ? <div className="text-[10px] text-slate-400 py-1.5 border-b border-slate-100"
              style={{ paddingRight: `${8 + (depth + 1) * TREE_INDENT + 22}px` }}>
              جاري التحميل...
            </div>
          : childrenQ.data?.map(child => (
              <AccountTreeNode key={child.id} account={child} depth={depth + 1}
                selectedId={selectedId} onSelect={onSelect} onDelete={onDelete}
                onContextMenu={onContextMenu} />
            ))
      )}
    </>
  );
}

function AccountTreeRootView({ selectedId, onSelect, onDelete, onContextMenu }: {
  selectedId: number | null;
  onSelect: (a: TAccount) => void;
  onDelete: (id: number, name: string) => void;
  onContextMenu: (a: TAccount, e: React.MouseEvent) => void;
}) {
  const rootQ = trpc.accounts.children.useQuery({ parentId: null }, { staleTime: 30_000 });

  if (rootQ.isLoading) return (
    <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
      <RefreshCw className="w-3 h-3 animate-spin" /> جاري تحميل الشجرة...
    </div>
  );

  return (
    <div>
      {rootQ.data?.map(account => (
        <AccountTreeNode key={account.id} account={account} depth={0}
          selectedId={selectedId} onSelect={onSelect} onDelete={onDelete}
          onContextMenu={onContextMenu} />
      ))}
    </div>
  );
}

// ─── Export Options Dialog ────────────────────────────────────────────────────
type ExportFormat = "print" | "pdf" | "excel" | "word";

function ExportOptionsDialog({
  open, onClose, accounts, companyName, userName,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountForExport[];
  companyName: string;
  userName: string;
}) {
  const [activeOnly, setActiveOnly] = useState(true);
  const [maxLevel, setMaxLevel] = useState(0);

  const rows = useMemo(
    () => buildTreeFlat(accounts, { activeOnly, maxLevel }),
    [accounts, activeOnly, maxLevel],
  );

  const doExport = (fmt: ExportFormat) => {
    if (fmt === "print") openPrintPreview(rows, companyName, userName, false);
    else if (fmt === "pdf")   openPrintPreview(rows, companyName, userName, true);
    else if (fmt === "excel") exportToExcel(rows, companyName, userName);
    else if (fmt === "word")  exportToWord(rows, companyName, userName);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" /> خيارات التصدير والطباعة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Options ── */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border/50">
            <p className="text-xs font-semibold text-foreground/70 mb-1">نطاق التصدير</p>

            {/* active only */}
            <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={e => setActiveOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span>الحسابات النشطة فقط</span>
            </label>

            {/* max level */}
            <div className="flex items-center gap-2">
              <span className="text-xs shrink-0 w-32">الحد الأقصى للمستوى</span>
              <Select value={String(maxLevel)} onValueChange={v => setMaxLevel(Number(v))}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">جميع المستويات (1–5)</SelectItem>
                  <SelectItem value="1">المستوى 1 فقط (الجذور)</SelectItem>
                  <SelectItem value="2">حتى المستوى 2</SelectItem>
                  <SelectItem value="3">حتى المستوى 3</SelectItem>
                  <SelectItem value="4">حتى المستوى 4</SelectItem>
                  <SelectItem value="5">حتى المستوى 5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* count */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background rounded-md px-2.5 py-1.5 border border-border/50">
              <Check className="w-3 h-3 text-emerald-500" />
              عدد الحسابات المؤهلة للتصدير:
              <strong className="text-foreground">{rows.length}</strong> حساب
            </div>
          </div>

          {/* ── Format buttons ── */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground/70">صيغة التصدير</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline" size="sm"
                className="h-10 text-xs gap-2 justify-start border-slate-200 hover:bg-slate-50"
                onClick={() => doExport("print")}
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <div className="text-right">
                  <div className="font-semibold">طباعة</div>
                  <div className="text-[9px] text-muted-foreground">معاينة قبل الطباعة</div>
                </div>
              </Button>

              <Button
                variant="outline" size="sm"
                className="h-10 text-xs gap-2 justify-start border-red-200 hover:bg-red-50 text-red-700"
                onClick={() => doExport("pdf")}
              >
                <FileDown className="w-4 h-4 text-red-500" />
                <div className="text-right">
                  <div className="font-semibold">PDF</div>
                  <div className="text-[9px] text-muted-foreground">احفظ كـ PDF من الطابعة</div>
                </div>
              </Button>

              <Button
                variant="outline" size="sm"
                className="h-10 text-xs gap-2 justify-start border-green-200 hover:bg-green-50 text-green-700"
                onClick={() => doExport("excel")}
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <div className="text-right">
                  <div className="font-semibold">Excel</div>
                  <div className="text-[9px] text-muted-foreground">مع تجميع هرمي للمستويات</div>
                </div>
              </Button>

              <Button
                variant="outline" size="sm"
                className="h-10 text-xs gap-2 justify-start border-blue-200 hover:bg-blue-50 text-blue-700"
                onClick={() => doExport("word")}
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <div className="text-right">
                  <div className="font-semibold">Word</div>
                  <div className="text-[9px] text-muted-foreground">جاهز للطباعة المباشرة</div>
                </div>
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground flex items-start gap-1 bg-amber-50/60 rounded p-2 border border-amber-100">
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
              جميع الصيغ تدعم العربية RTL والتسلسل الهرمي الكامل للشجرة.
              يدعم Excel فتح وإغلاق المستويات (Grouping) بعد الفتح.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Chart of Accounts (شجرة الحسابات) ───────────────────────────────────────
function ChartOfAccountsPage() {
  const listQuery = trpc.accounts.list.useQuery();
  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة الحساب"); listQuery.refetch(); setShowForm(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الحساب"); listQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const importMutation = trpc.accounts.import.useMutation({
    onSuccess: (r) => {
      toast.success(`تم استيراد ${r.inserted} حساب${r.skipped > 0 ? ` (تم تجاهل ${r.skipped} مكرر)` : ""}`);
      listQuery.refetch();
      setShowImport(false);
      setImportRows([]);
      setImportError(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const { user } = useAuth();
  const orgQuery = trpc.orgs.currentOrg.useQuery();
  const companyName = orgQuery.data?.name ?? "OneSoft ERP";
  const userName = user?.name ?? user?.username ?? "—";

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [selectedAccount, setSelectedAccount] = useState<TAccount | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState>(null);

  const handleTreeContextMenu = useCallback((account: TAccount, e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ account, x: e.clientX, y: e.clientY });
  }, []);

  const handleCtxAddChild = useCallback((parent: TAccount) => {
    setCtxMenu(null);
    setForm({
      ...initForm(),
      parentId: String(parent.id),
      accountLevelType: "sub",
      accountType: (parent.accountType as any) ?? "assets",
      nature: (parent.nature as any) ?? "debit",
    });
    setFormErrors({});
    setShowForm(true);
  }, []);

  const handleCtxView = useCallback((account: TAccount) => {
    setCtxMenu(null);
    setSelectedAccount(account);
  }, []);

  const handleCtxCopy = useCallback((account: TAccount) => {
    setCtxMenu(null);
    const text = `${account.code} - ${account.name}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success(`تم نسخ: ${text}`),
      () => toast.error("فشل النسخ"),
    );
  }, []);

  const typeMap: Record<string, string> = {
    أصول: "assets", assets: "assets",
    خصوم: "liabilities", liabilities: "liabilities",
    "حقوق ملكية": "equity", equity: "equity",
    إيرادات: "revenue", revenue: "revenue",
    مصروفات: "expenses", expenses: "expenses",
  };
  const natureMap: Record<string, string> = { مدين: "debit", debit: "debit", دائن: "credit", credit: "credit" };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setImportError("الملف فارغ أو لا يحتوي على بيانات"); return; }
        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
        const rows = lines.slice(1).map(line => {
          const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
          return row;
        }).filter(r => r["code"] || r["كود"] || r["كود الحساب"]);
        const parsed = rows.map(r => ({
          code: (r["code"] || r["كود"] || r["كود الحساب"] || "").trim(),
          name: (r["name"] || r["اسم"] || r["اسم الحساب"] || "").trim(),
          nameEn: (r["name_en"] || r["الاسم بالانجليزية"] || "").trim() || undefined,
          accountType: typeMap[(r["account_type"] || r["نوع الحساب"] || r["النوع"] || "").trim()] ?? "assets",
          nature: natureMap[(r["nature"] || r["الطبيعة"] || "").trim()] ?? "debit",
          level: parseInt(r["level"] || r["المستوى"] || "1") || 1,
          isParent: ["true", "1", "نعم", "yes"].includes((r["is_parent"] || r["حساب رئيسي"] || "false").toLowerCase()),
          allowPosting: !["false", "0", "لا", "no"].includes((r["allow_posting"] || r["يقبل الترحيل"] || "true").toLowerCase()),
          openingBalance: (r["opening_balance"] || r["رصيد افتتاحي"] || "").trim() || undefined,
          openingBalanceType: natureMap[(r["opening_balance_type"] || r["نوع الرصيد"] || "").trim()] ?? "debit",
        })).filter(r => r.code && r.name);
        if (parsed.length === 0) { setImportError("لم يتم العثور على بيانات صالحة — تأكد من وجود أعمدة code و name"); return; }
        setImportRows(parsed);
      } catch {
        setImportError("خطأ في قراءة الملف");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const csv = "code,name,name_en,account_type,nature,level,is_parent,allow_posting,opening_balance,opening_balance_type\n1,الأصول,,assets,debit,1,true,false,,debit\n11,الأصول المتداولة,,assets,debit,2,true,false,,debit\n1101,الصندوق,Cash,assets,debit,3,false,true,,debit";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chart_of_accounts_template.csv"; a.click();
  };
  type AccountLevelType = "root" | "general" | "sub";
  type AccountFinType = "assets" | "liabilities" | "equity" | "revenue" | "expenses";
  type NatureType = "debit" | "credit";
  type CostCenterType = "not_allowed" | "optional" | "mandatory";

  const initForm = () => ({
    code: "", name: "", nameEn: "",
    parentId: "",
    accountLevelType: "sub" as AccountLevelType,
    accountType: "assets" as AccountFinType,
    nature: "debit" as NatureType,
    costCenterType: "optional" as CostCenterType,
    allowPosting: true,
    status: "active" as "active" | "suspended",
    openingDebit: "", openingCredit: "", openingDate: "", openingCostCenter: "",
    notes: "",
  });

  const [form, setForm] = useState(initForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const setF = (k: string, v: any) => {
    setForm(p => {
      const next = { ...p, [k]: v };
      // Business rules
      if (k === "accountLevelType") {
        if (v === "root") { next.parentId = ""; next.allowPosting = false; }
        if (v === "general") { next.allowPosting = false; }
        if (v === "sub") { next.allowPosting = true; }
      }
      if (k === "parentId" && v !== "" && v !== "none") {
        const parent = listQuery.data?.find(a => String(a.id) === v);
        if (parent) {
          const pLevel = parent.level ?? 1;
          (next as any).computedLevel = pLevel + 1;
        }
      }
      return next;
    });
    if (formErrors[k]) setFormErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const computedLevel = (() => {
    if (form.parentId && form.parentId !== "none") {
      const p = listQuery.data?.find(a => String(a.id) === form.parentId);
      return (p?.level ?? 1) + 1;
    }
    return 1;
  })();

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = "كود الحساب مطلوب";
    if (!form.name.trim()) errs.name = "اسم الحساب مطلوب";
    if (form.accountLevelType !== "root" && (!form.parentId || form.parentId === "none"))
      errs.parentId = "الحساب الأب مطلوب للحسابات غير الجذرية";
    if (listQuery.data?.some(a => a.code === form.code.trim()))
      errs.code = "كود الحساب مكرر — يرجى اختيار كود مختلف";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const filtered = listQuery.data?.filter(a =>
    !search || a.code?.includes(search) || a.name?.includes(search)
  ) ?? [];

  const typeLabel = (t: string) => ({ assets: "أصول", liabilities: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expenses: "مصروفات" }[t] ?? t);

  const handleTreeDelete = (id: number, name: string) => {
    if (confirm(`هل تريد حذف الحساب "${name}"؟`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> شجرة الحسابات
          <Badge variant="secondary" className="text-[10px] font-normal">
            {listQuery.data?.length ?? 0} حساب
          </Badge>
        </h3>
        <div className="flex gap-2 items-center">
          {/* view toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <Network className="w-3 h-3" /> شجري
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border-r border-border ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutList className="w-3 h-3" /> جدول
            </button>
          </div>
          {viewMode === "table" && (
            <div className="relative">
              <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pr-7 w-44" placeholder="بحث بالكود أو الاسم..." />
            </div>
          )}
          {/* ── طباعة مباشرة ── */}
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1 border-slate-200 hover:bg-slate-50"
            onClick={() => {
              const rows = buildTreeFlat((listQuery.data ?? []) as AccountForExport[], { activeOnly: true, maxLevel: 0 });
              openPrintPreview(rows, companyName, userName, false);
            }}
          >
            <Printer className="w-3 h-3" /> طباعة
          </Button>

          {/* ── تصدير Dropdown ── */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-primary/30 hover:bg-primary/5 text-primary hover:text-primary">
                <Download className="w-3 h-3" />
                تصدير
                <ChevronDownIcon className="w-3 h-3 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1.5" dir="rtl">
              {/* PDF */}
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md hover:bg-red-50 text-red-700 transition-colors"
                onClick={() => {
                  const rows = buildTreeFlat((listQuery.data ?? []) as AccountForExport[], { activeOnly: true, maxLevel: 0 });
                  openPrintPreview(rows, companyName, userName, true);
                }}
              >
                <FileDown className="w-3.5 h-3.5 shrink-0" />
                <div className="text-right">
                  <div className="font-semibold">تصدير PDF</div>
                  <div className="text-[10px] text-muted-foreground">احفظ كـ PDF من الطابعة</div>
                </div>
              </button>

              {/* Excel */}
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md hover:bg-green-50 text-green-700 transition-colors"
                onClick={() => {
                  const rows = buildTreeFlat((listQuery.data ?? []) as AccountForExport[], { activeOnly: true, maxLevel: 0 });
                  exportToExcel(rows, companyName, userName);
                }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <div className="text-right">
                  <div className="font-semibold">تصدير Excel</div>
                  <div className="text-[10px] text-muted-foreground">مع تجميع هرمي للمستويات</div>
                </div>
              </button>

              {/* Word */}
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md hover:bg-blue-50 text-blue-700 transition-colors"
                onClick={() => {
                  const rows = buildTreeFlat((listQuery.data ?? []) as AccountForExport[], { activeOnly: true, maxLevel: 0 });
                  exportToWord(rows, companyName, userName);
                }}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <div className="text-right">
                  <div className="font-semibold">تصدير Word</div>
                  <div className="text-[10px] text-muted-foreground">جاهز للطباعة المباشرة</div>
                </div>
              </button>

              <div className="border-t border-border/60 my-1" />

              {/* معاينة */}
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md hover:bg-slate-50 text-slate-700 transition-colors"
                onClick={() => {
                  const rows = buildTreeFlat((listQuery.data ?? []) as AccountForExport[], { activeOnly: true, maxLevel: 0 });
                  openPrintPreview(rows, companyName, userName, false);
                }}
              >
                <Printer className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <div className="text-right">
                  <div className="font-semibold">معاينة قبل الطباعة</div>
                  <div className="text-[10px] text-muted-foreground">نافذة معاينة كاملة</div>
                </div>
              </button>

              <div className="border-t border-border/60 my-1" />

              {/* خيارات متقدمة */}
              <button
                className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-md hover:bg-muted/60 text-muted-foreground transition-colors"
                onClick={() => setShowExport(true)}
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>خيارات تصدير متقدمة...</span>
              </button>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowImport(true)}>
            <Upload className="w-3 h-3" /> استيراد
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3" /> إضافة حساب
          </Button>
        </div>
      </div>

      {/* ── Tree View ── */}
      {viewMode === "tree" && (
        <div className="flex gap-3">
          {/* tree panel */}
          <Card className="border-border/60 flex-1 overflow-hidden">
            <div className="bg-muted/30 px-3 py-1.5 border-b flex items-center gap-2 text-[11px] text-muted-foreground">
              <Network className="w-3 h-3" />
              <span>اضغط على ▶ لفتح الحساب | اضغط على الاسم لعرض التفاصيل</span>
            </div>
            <div className="overflow-y-auto max-h-[65vh]">
              <AccountTreeRootView
                selectedId={selectedAccount?.id ?? null}
                onSelect={setSelectedAccount}
                onDelete={handleTreeDelete}
                onContextMenu={handleTreeContextMenu}
              />
            </div>
          </Card>

          {/* ── Context Menu ── */}
          <TreeContextMenu
            state={ctxMenu}
            onClose={() => setCtxMenu(null)}
            onAddChild={handleCtxAddChild}
            onView={handleCtxView}
            onCopy={handleCtxCopy}
            onDelete={(id, name) => { setCtxMenu(null); handleTreeDelete(id, name); }}
          />

          {/* detail panel */}
          {selectedAccount && (
            <Card className="border-border/60 w-64 shrink-0 self-start sticky top-3">
              <div className="bg-blue-600 text-white px-3 py-2 flex items-center justify-between rounded-t-lg">
                <span className="text-xs font-bold">تفاصيل الحساب</span>
                <button onClick={() => setSelectedAccount(null)} className="text-white/70 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 space-y-2 text-xs" dir="rtl">
                <div className="text-center">
                  <span className="font-mono text-2xl font-black text-blue-700">{selectedAccount.code}</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedAccount.name}</p>
                </div>
                <div className="border-t pt-2 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">النوع</span>
                    <Badge variant="outline" className="text-[10px]">{treeTypeLabel(selectedAccount.accountType)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">الطبيعة</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedAccount.nature === "debit" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
                      {selectedAccount.nature === "debit" ? "مدين" : "دائن"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المستوى</span>
                    <span className="font-bold text-slate-700">{selectedAccount.level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">نوع الحساب</span>
                    <span className={`text-[10px] font-medium ${selectedAccount.isParent ? "text-amber-600" : "text-emerald-600"}`}>
                      {selectedAccount.isParent ? "🗂 مجمّع" : "📄 فرعي نهائي"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">يقبل ترحيل</span>
                    <span className={selectedAccount.allowPosting ? "text-emerald-600" : "text-slate-400"}>
                      {selectedAccount.allowPosting ? "نعم" : "لا"}
                    </span>
                  </div>
                </div>
                {!selectedAccount.isParent && (
                  <Button
                    variant="destructive" size="sm"
                    className="w-full h-7 text-xs mt-2"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleTreeDelete(selectedAccount.id, selectedAccount.name ?? "")}
                  >
                    <Trash2 className="w-3 h-3 ml-1" /> حذف الحساب
                  </Button>
                )}
                {selectedAccount.isParent && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 rounded p-1.5 border border-amber-100">
                    <AlertCircle className="w-3 h-3 shrink-0" /> لا يمكن حذف هذا الحساب لأنه يحتوي على حسابات فرعية
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === "table" && (
      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-24">كود الحساب</TableHead>
              <TableHead className="text-xs">اسم الحساب</TableHead>
              <TableHead className="text-xs text-center">النوع</TableHead>
              <TableHead className="text-xs text-center">الطبيعة</TableHead>
              <TableHead className="text-xs text-center">المستوى</TableHead>
              <TableHead className="text-xs text-center">رصيد افتتاحي</TableHead>
              <TableHead className="text-xs text-center">ترحيل</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">لا توجد حسابات - أضف حسابات جديدة</TableCell></TableRow>
            )}
            {filtered.map(a => (
              <TableRow key={a.id} className={`hover:bg-muted/10 ${a.isParent ? "bg-muted/20 font-semibold" : ""}`}>
                <TableCell className="text-xs font-mono text-primary">{a.code}</TableCell>
                <TableCell>
                  <span className="text-xs" style={{ paddingRight: `${((a.level ?? 1) - 1) * 16}px` }}>
                    {(a.level ?? 1) > 1 && "└ "}{a.name}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">{typeLabel(a.accountType ?? "")}</Badge>
                </TableCell>
                <TableCell className="text-center text-xs">{a.nature === "debit" ? "مدين" : "دائن"}</TableCell>
                <TableCell className="text-center text-xs">{a.level}</TableCell>
                <TableCell className="text-center text-xs font-semibold">
                  {a.openingBalance && parseFloat(a.openingBalance) !== 0
                    ? `${parseFloat(a.openingBalance).toLocaleString()} ${a.openingBalanceType === "debit" ? "م" : "د"}`
                    : "-"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={a.allowPosting ? "default" : "secondary"} className="text-xs">
                    {a.allowPosting ? "نعم" : "لا"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.isParent ? (
                    <div title="لا يمكن الحذف — يحتوي على حسابات فرعية"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-amber-600 bg-amber-50 border border-amber-200 cursor-not-allowed select-none">
                      <AlertCircle className="w-3 h-3" /> له أبناء
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`هل تريد حذف الحساب "${a.name}" (${a.code})؟`)) {
                          deleteMutation.mutate({ id: a.id });
                        }
                      }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}

      {/* ── dialog الاستيراد ── */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
      <Dialog open={showImport} onOpenChange={v => { setShowImport(v); if (!v) { setImportRows([]); setImportError(null); } }}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> استيراد شجرة الحسابات من CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground space-y-1 border border-border/50">
              <p className="font-medium text-foreground">تنسيق الملف المطلوب (CSV):</p>
              <p>الأعمدة المطلوبة: <span className="font-mono text-primary">code, name</span></p>
              <p>الأعمدة الاختيارية: <span className="font-mono">name_en, account_type, nature, level, is_parent, allow_posting, opening_balance, opening_balance_type</span></p>
              <p>قيم account_type: assets / liabilities / equity / revenue / expenses</p>
              <p>قيم nature و opening_balance_type: debit / credit</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={downloadTemplate}>
                <Download className="w-3 h-3" /> تحميل نموذج CSV
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3" /> اختر ملف CSV
              </Button>
            </div>
            {importError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded p-2 border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {importError}
              </div>
            )}
            {importRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">معاينة — {importRows.length} حساب جاهز للاستيراد:</p>
                <div className="border border-border/50 rounded overflow-auto max-h-52">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {["الكود","الاسم","النوع","الطبيعة","المستوى","رئيسي","ترحيل"].map(h => (
                          <TableHead key={h} className="text-xs py-1 px-2">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono py-1 px-2">{r.code}</TableCell>
                          <TableCell className="text-xs py-1 px-2">{r.name}</TableCell>
                          <TableCell className="text-xs py-1 px-2">{typeLabel(r.accountType)}</TableCell>
                          <TableCell className="text-xs py-1 px-2">{r.nature === "debit" ? "مدين" : "دائن"}</TableCell>
                          <TableCell className="text-xs py-1 px-2 text-center">{r.level}</TableCell>
                          <TableCell className="text-xs py-1 px-2 text-center">{r.isParent ? "نعم" : "لا"}</TableCell>
                          <TableCell className="text-xs py-1 px-2 text-center">{r.allowPosting ? "نعم" : "لا"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {importRows.length > 50 && <p className="text-xs text-muted-foreground">... و {importRows.length - 50} حساب آخر</p>}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setImportRows([]); setImportError(null); }}>مسح</Button>
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={importMutation.isPending}
                    onClick={() => importMutation.mutate({ accounts: importRows, skipDuplicates: true })}>
                    <Check className="w-3 h-3" /> {importMutation.isPending ? "جارٍ الاستيراد..." : `استيراد ${importRows.length} حساب`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setForm(initForm()); setFormErrors({}); } }}>
        <DialogContent className="max-w-2xl p-0 gap-0 rounded-xl shadow-2xl flex flex-col max-h-[90vh]" dir="rtl">

          {/* ══ Header ══ */}
          <div className="bg-gradient-to-l from-blue-800 to-blue-600 px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white text-sm font-bold leading-none">إضافة حساب جديد</h2>
              <p className="text-blue-200 text-[10px] mt-0.5">شجرة الحسابات — دليل الحسابات</p>
            </div>
          </div>

          {/* ══ Tabs ══ */}
          <Tabs defaultValue="main" className="w-full flex flex-col flex-1 min-h-0">
            <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 h-9 px-4 gap-1 shrink-0">
              <TabsTrigger value="main" className="text-xs h-7 rounded px-4 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <FileText className="w-3 h-3" /> البيانات الرئيسية
              </TabsTrigger>
            </TabsList>

            {/* ══ Tab 1: البيانات الرئيسية ══ */}
            <TabsContent value="main" className="mt-0 overflow-y-auto flex-1" dir="rtl">
              <div className="p-4 space-y-4">

              {/* ── قسم: بيانات الحساب الأساسية ── */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 border-b border-blue-100">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="text-[11px] font-bold text-blue-800 tracking-wide">بيانات الحساب الأساسية</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3" dir="rtl">
                  {/* كود الحساب — يمين أولاً */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">كود الحساب <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.code} onChange={e => setF("code", e.target.value)}
                      className={`h-9 text-base font-mono font-bold tracking-widest border-2 text-blue-700 ${formErrors.code ? "border-red-400 bg-red-50" : "border-blue-200 bg-white focus:border-blue-500"}`}
                      placeholder="1101" dir="ltr" />
                    {formErrors.code && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.code}</p>}
                  </div>
                  {/* نوع الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">نوع الحساب <span className="text-red-500">*</span></Label>
                    <Select value={form.accountLevelType} onValueChange={v => setF("accountLevelType", v)}>
                      <SelectTrigger className="h-9 text-xs border-2 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="root">🔷 جذري — حساب رئيسي بلا أب</SelectItem>
                        <SelectItem value="general">🔶 عام — حساب تجميعي</SelectItem>
                        <SelectItem value="sub">🟢 فرعي — يقبل الحركات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* اسم الحساب العربي — عرض كامل */}
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">اسم الحساب (عربي) <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.name} onChange={e => setF("name", e.target.value)}
                      className={`h-9 text-sm border-2 ${formErrors.name ? "border-red-400 bg-red-50" : "border-slate-200 bg-white focus:border-blue-400"}`}
                      placeholder="اسم الحساب بالعربية" />
                    {formErrors.name && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.name}</p>}
                  </div>
                  {/* اسم الحساب الإنجليزي — عرض كامل */}
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">اسم الحساب (إنجليزي)</Label>
                    <Input
                      value={form.nameEn} onChange={e => setF("nameEn", e.target.value)}
                      className="h-9 text-sm border-2 border-slate-200 bg-white focus:border-blue-400"
                      placeholder="Account name in English" dir="ltr" />
                  </div>
                  {/* الحساب الأب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">
                      يصبّ في (الحساب الأب) {form.accountLevelType !== "root" && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={form.parentId || "none"}
                      onValueChange={v => setF("parentId", v === "none" ? "" : v)}
                      disabled={form.accountLevelType === "root"}>
                      <SelectTrigger className={`h-9 text-xs border-2 ${form.accountLevelType === "root" ? "opacity-40 bg-slate-50 border-slate-100" : formErrors.parentId ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}`}>
                        <SelectValue placeholder="اختر الحساب الأب..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="none">— بدون حساب أب —</SelectItem>
                        {listQuery.data?.filter(a => a.isParent === true).map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <span className="font-mono text-[10px] text-blue-600 ml-1">{a.code}</span> {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.accountLevelType === "root" && <p className="text-[10px] text-blue-500">الجذري لا يحتاج حساباً أباً</p>}
                    {formErrors.parentId && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.parentId}</p>}
                  </div>
                  {/* المستوى (auto) */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">المستوى (تلقائي)</Label>
                    <div className="h-9 rounded-lg border-2 border-slate-200 bg-slate-50 px-3 flex items-center gap-2">
                      <span className="text-xl font-black text-blue-600">{computedLevel}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {["","الأول","الثاني","الثالث","الرابع","الخامس"][computedLevel] ?? `المستوى ${computedLevel}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── قسم: الخصائص والإعدادات ── */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border-b border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="text-[11px] font-bold text-emerald-800 tracking-wide">الخصائص والإعدادات</span>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3" dir="rtl">
                  {/* طبيعة الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">طبيعة الحساب</Label>
                    <Select value={form.nature} onValueChange={v => setF("nature", v)}>
                      <SelectTrigger className="h-9 text-xs border-2 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="debit">🔵 مدين</SelectItem>
                        <SelectItem value="credit">🔴 دائن</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* التصنيف المالي */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">التصنيف المالي</Label>
                    <Select value={form.accountType} onValueChange={v => setF("accountType", v)}>
                      <SelectTrigger className="h-9 text-xs border-2 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="assets">أصول</SelectItem>
                        <SelectItem value="liabilities">خصوم</SelectItem>
                        <SelectItem value="equity">حقوق ملكية</SelectItem>
                        <SelectItem value="revenue">إيرادات</SelectItem>
                        <SelectItem value="expenses">مصروفات</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* مركز التكلفة */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">مركز التكلفة</Label>
                    <Select value={form.costCenterType} onValueChange={v => setF("costCenterType", v)}>
                      <SelectTrigger className="h-9 text-xs border-2 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="not_allowed">غير مسموح</SelectItem>
                        <SelectItem value="optional">اختياري</SelectItem>
                        <SelectItem value="mandatory">إجباري ⚠️</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.costCenterType === "mandatory" && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />يجب تحديد مركز تكلفة عند الترحيل</p>
                    )}
                  </div>
                  {/* حالة الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">حالة الحساب</Label>
                    <Select value={form.status} onValueChange={v => setF("status", v)}>
                      <SelectTrigger className={`h-9 text-xs border-2 bg-white ${form.status === "active" ? "border-emerald-300 text-emerald-700" : "border-red-200 text-red-600"}`}><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="active">✅ نشط</SelectItem>
                        <SelectItem value="suspended">🔴 موقوف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* يقبل الحركات اليومية */}
                <div className={`mx-4 mb-4 rounded-lg border-2 p-3 flex items-start gap-3 transition-all ${form.accountLevelType === "sub" ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-slate-50/60 opacity-50"}`}>
                  <input
                    id="allowPosting"
                    type="checkbox"
                    checked={form.allowPosting}
                    disabled={form.accountLevelType !== "sub"}
                    onChange={e => setF("allowPosting", e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-emerald-600 cursor-pointer shrink-0" />
                  <div>
                    <label htmlFor="allowPosting" className={`text-xs font-bold cursor-pointer ${form.accountLevelType !== "sub" ? "text-slate-400" : "text-slate-700"}`}>
                      يقبل الحركات اليومية (القيود المحاسبية)
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {form.accountLevelType === "root" ? "الجذري لا يقبل حركات مباشرة" : form.accountLevelType === "general" ? "العام للتجميع فقط — لا يقبل حركات مباشرة" : "الفرعي يقبل تسجيل القيود اليومية مباشرةً"}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── قسم: ملاحظات ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border-b border-slate-200">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-[11px] font-bold text-slate-600 tracking-wide">ملاحظات</span>
                </div>
                <div className="p-3">
                  <textarea
                    value={form.notes}
                    onChange={e => setF("notes", e.target.value)}
                    className="w-full h-14 text-xs rounded-lg border-2 border-slate-200 px-3 py-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                    placeholder="ملاحظات إضافية على الحساب (اختياري)..." dir="rtl" />
                </div>
              </div>

              </div>
            </TabsContent>

          </Tabs>

          {/* ══ Footer ══ */}
          <div className="border-t bg-slate-50 px-5 py-3 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="h-8 text-xs px-4"
              onClick={() => { setShowForm(false); setForm(initForm()); setFormErrors({}); }}>
              <X className="w-3 h-3 ml-1" /> إغلاق
            </Button>
            <div className="flex items-center gap-2">
              {Object.keys(formErrors).length > 0 && (
                <span className="text-[10px] text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {Object.keys(formErrors).length} خطأ في البيانات
                </span>
              )}
              <Button
                size="sm"
                className="h-8 text-xs px-6 gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
                disabled={createMutation.isPending}
                onClick={() => {
                  if (!validateForm()) return;
                  createMutation.mutate({
                    code: form.code.trim(),
                    name: form.name.trim(),
                    nameEn: form.nameEn.trim() || undefined,
                    accountType: form.accountType,
                    nature: form.nature,
                    level: computedLevel,
                    parentId: form.parentId && form.parentId !== "none" ? parseInt(form.parentId) : undefined,
                    isParent: form.accountLevelType !== "sub",
                    allowPosting: form.accountLevelType === "sub" ? form.allowPosting : false,
                    costCenterType: form.costCenterType,
                    isActive: form.status === "active",
                    notes: form.notes.trim() || undefined,
                  });
                }}>
                {createMutation.isPending
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> جارٍ الحفظ...</>
                  : <><Check className="w-3 h-3" /> حفظ الحساب</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Export Dialog ── */}
      <ExportOptionsDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        accounts={(listQuery.data ?? []) as AccountForExport[]}
        companyName={companyName}
        userName={userName}
      />
    </div>
  );
}
// ─── Account Statement (كشف حساب أستاذ) ───────────────────────────────────────
function AccountLedgerPage({
  initialAccountId, initialFromDate, initialToDate,
}: {
  initialAccountId?: number | null;
  initialFromDate?: string;
  initialToDate?: string;
} = {}) {
  const accountsQuery = trpc.accounts.list.useQuery();
  const leafAccounts  = accountsQuery.data?.filter(a => a.allowPosting) ?? [];

  // Filter state
  const [fromAccountId, setFromAccountId] = useState<number | null>(initialAccountId ?? null);
  const [toAccountId,   setToAccountId]   = useState<number | null>(null);
  const [fromDate,      setFromDate]      = useState(initialFromDate ?? "");
  const [toDate,        setToDate]        = useState(initialToDate   ?? "");
  const [subTitle,      setSubTitle]      = useState("");
  const [currency,      setCurrency]      = useState("SAR");
  const [showColors,    setShowColors]    = useState(true);
  const [fontSize,      setFontSize]      = useState<"sm"|"md"|"lg">("md");

  // View mode: "filters" | "results"
  const [view, setView] = useState<"filters"|"results">(
    initialAccountId ? "results" : "filters"
  );

  // Queried snapshot (what was actually run)
  const [queried, setQueried] = useState<{accountId:number;fromDate:string;toDate:string}|null>(
    initialAccountId ? { accountId: initialAccountId, fromDate: initialFromDate ?? "", toDate: initialToDate ?? "" } : null
  );

  const stmtQuery = trpc.accounting.accountStatement.useQuery(
    { accountId: queried?.accountId ?? 0, fromDate: queried?.fromDate ? new Date(queried.fromDate) : undefined, toDate: queried?.toDate ? new Date(queried.toDate) : undefined },
    { enabled: !!queried }
  );

  const queriedAccount = leafAccounts.find(a => a.id === queried?.accountId);

  let runningBalance = 0;
  const rows = (stmtQuery.data ?? []).map(l => {
    runningBalance += (parseFloat(l.debit ?? "0") - parseFloat(l.credit ?? "0"));
    return { ...l, runningBalance };
  });

  const handleRun = () => {
    if (!fromAccountId) return;
    setQueried({ accountId: fromAccountId, fromDate, toDate });
    setView("results");
  };

  const handleReset = () => {
    setFromAccountId(null);
    setToAccountId(null);
    setFromDate("");
    setToDate("");
    setSubTitle("");
    setQueried(null);
    setView("filters");
  };

  const D  = showColors ? "#C0392B" : "#374151";
  const C  = showColors ? "#1A7A4A" : "#374151";
  const fs = fontSize === "sm" ? 11 : fontSize === "lg" ? 14 : 12;

  const CURRENCIES = [
    { code: "SAR", name: "ريال سعودي" },
    { code: "USD", name: "دولار أمريكي" },
    { code: "EUR", name: "يورو" },
    { code: "GBP", name: "جنيه إسترليني" },
    { code: "AED", name: "درهم إماراتي" },
    { code: "KWD", name: "دينار كويتي" },
    { code: "BHD", name: "دينار بحريني" },
    { code: "OMR", name: "ريال عُماني" },
    { code: "QAR", name: "ريال قطري" },
    { code: "EGP", name: "جنيه مصري" },
    { code: "JOD", name: "دينار أردني" },
    { code: "TRY", name: "ليرة تركية" },
  ];

  const fieldRow:   CSSProperties = { display: "flex", alignItems: "center", marginBottom: 6 };
  const fieldLabel: CSSProperties = { width: 130, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#374151", paddingLeft: 10, flexShrink: 0 };
  const fieldInput: CSSProperties = { flex: 1, height: 26, fontSize: 12, border: "1px solid #9CA3AF", borderRadius: 2, padding: "0 6px", background: "#fff", fontFamily: "'Cairo',Tahoma,sans-serif", direction: "rtl" };
  const panelStyle: CSSProperties = { background: "#F9FAFB", border: "1px solid #D1D5DB", borderRadius: 4, padding: "14px 16px", marginBottom: 12 };
  const sTitle:     CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 10, borderBottom: "1px solid #E5E7EB", paddingBottom: 5 };
  const selStyle:   CSSProperties = { height: 26, fontSize: 12, direction: "rtl" as const };

  return (
    <div style={{ fontFamily: "'Cairo',Tahoma,sans-serif", direction: "rtl", padding: 8 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, borderBottom: "2px solid #2563EB", paddingBottom: 8 }}>
        <FileText style={{ width: 18, height: 18, color: "#2563EB" }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1E3A5F" }}>كشف حساب أستاذ</span>
        <span style={{ marginRight: "auto", fontSize: 11, color: "#9CA3AF" }}>accstat.sysrep</span>
        {view === "results" && (
          <button onClick={() => setView("filters")}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 12px", border: "1px solid #D1D5DB", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
            <Search style={{ width: 12, height: 12 }} /> تعديل الضوابط
          </button>
        )}
      </div>

      {/* ══ FILTER PANEL ══ */}
      {view === "filters" && (
        <>
          <div style={panelStyle}>
            <p style={sTitle}>ضوابط التقرير</p>

            {/* dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px", marginBottom: 6 }}>
              <div style={fieldRow}>
                <span style={fieldLabel}>تاريخ أول الفترة</span>
                <div style={{ flex: 1 }}><DateMaskInput value={fromDate} onChange={setFromDate} className="h-6 text-xs" /></div>
              </div>
              <div style={fieldRow}>
                <span style={fieldLabel}>تاريخ نهاية الفترة</span>
                <div style={{ flex: 1 }}><DateMaskInput value={toDate} onChange={setToDate} className="h-6 text-xs" /></div>
              </div>
            </div>

            {/* account range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px", marginBottom: 6 }}>
              <div style={fieldRow}>
                <span style={fieldLabel}>من حساب</span>
                <div style={{ flex: 1 }}>
                  <Select value={fromAccountId?.toString() ?? ""} onValueChange={v => setFromAccountId(v ? parseInt(v) : null)}>
                    <SelectTrigger style={selStyle}><SelectValue placeholder="من..." /></SelectTrigger>
                    <SelectContent>
                      {leafAccounts.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div style={fieldRow}>
                <span style={fieldLabel}>إلى حساب</span>
                <div style={{ flex: 1 }}>
                  <Select value={toAccountId?.toString() ?? ""} onValueChange={v => setToAccountId(v ? parseInt(v) : null)}>
                    <SelectTrigger style={selStyle}><SelectValue placeholder="إلى..." /></SelectTrigger>
                    <SelectContent>
                      {leafAccounts.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* cost center + currency */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 32px", marginBottom: 6 }}>
              <div style={fieldRow}>
                <span style={fieldLabel}>مركز التكلفة</span>
                <input style={fieldInput} disabled placeholder="الكل" />
              </div>
              <div style={fieldRow}>
                <span style={fieldLabel}>العملة</span>
                <div style={{ flex: 1 }}>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger style={selStyle}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* subtitle */}
            <div style={fieldRow}>
              <span style={fieldLabel}>عنوان فرعي</span>
              <input style={fieldInput} value={subTitle} onChange={e => setSubTitle(e.target.value)} placeholder="اختياري..." />
            </div>

            {/* style options */}
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 10, paddingTop: 8, borderTop: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>حجم الخط</span>
                <select value={fontSize} onChange={e => setFontSize(e.target.value as any)}
                  style={{ height: 24, fontSize: 11, border: "1px solid #9CA3AF", borderRadius: 2, padding: "0 4px", background: "#fff" }}>
                  <option value="sm">صغير</option>
                  <option value="md">طبيعي</option>
                  <option value="lg">كبير</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={showColors} onChange={e => setShowColors(e.target.checked)} />
                <span style={{ color: "#374151", fontWeight: 600 }}>إظهار الألوان</span>
              </label>
            </div>
          </div>

          {/* action buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={handleRun} disabled={!fromAccountId}
              style={{ padding: "7px 32px", background: fromAccountId ? "#2563EB" : "#9CA3AF", color: "#fff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: fromAccountId ? "pointer" : "not-allowed", fontFamily: "'Cairo',Tahoma,sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
              <Search style={{ width: 13, height: 13 }} /> تشغيل (F5)
            </button>
            <button onClick={handleReset}
              style={{ padding: "7px 20px", background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
              إلغاء الأمر
            </button>
          </div>
        </>
      )}

      {/* ══ RESULTS ══ */}
      {view === "results" && queried && queriedAccount && (
        <div style={{ border: "1px solid #D1D5DB", borderRadius: 4, overflow: "hidden" }}>
          {/* report header */}
          <div style={{ background: "#1E3A5F", color: "#fff", textAlign: "center", padding: "10px 16px" }}>
            <p style={{ fontSize: fs + 2, fontWeight: 700, margin: 0 }}>كشف حساب أستاذ</p>
            {subTitle && <p style={{ fontSize: fs, margin: "2px 0 0", opacity: 0.85 }}>{subTitle}</p>}
            <p style={{ fontSize: fs + 1, margin: "4px 0 0", opacity: 0.9 }}>{queriedAccount.code} — {queriedAccount.name}</p>
            {queried.fromDate && queried.toDate && (
              <p style={{ fontSize: fs - 1, margin: "2px 0 0", opacity: 0.7 }}>الفترة: من {queried.fromDate} إلى {queried.toDate}</p>
            )}
          </div>

          {/* table */}
          {stmtQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 12 }}>جاري تحميل البيانات...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs, direction: "rtl" }}>
                <thead>
                  <tr style={{ background: "#4B5563", color: "#fff" }}>
                    {["التاريخ","بناءً على","نوع المستند","الشرح","مدين","دائن","الرصيد"].map((h, i) => (
                      <th key={i} style={{ padding: "7px 10px", textAlign: i >= 4 ? "center" : "right", fontWeight: 600, whiteSpace: "nowrap",
                        color: showColors && i === 4 ? "#FCA5A5" : showColors && i === 5 ? "#6EE7B7" : "#fff" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF", fontSize: 12 }}>لا توجد حركات في هذه الفترة</td></tr>
                  ) : rows.map((r, i) => {
                    const d = parseFloat(r.debit ?? "0"), c = parseFloat(r.credit ?? "0");
                    const fmt = (n: number) => n > 0 ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F3F8FE", borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>{new Date(r.entryDate).toLocaleDateString("ar-EG")}</td>
                        <td style={{ padding: "5px 10px", fontFamily: "monospace", color: "#2563EB", whiteSpace: "nowrap" }}>{(r as any).reference ?? r.entryNumber}</td>
                        <td style={{ padding: "5px 10px" }}>{r.voucherType}</td>
                        <td style={{ padding: "5px 10px", color: "#374151", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? "—"}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", color: D, fontWeight: d > 0 ? 700 : 400 }}>{fmt(d)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", color: C, fontWeight: c > 0 ? 700 : 400 }}>{fmt(c)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700,
                          color: r.runningBalance === 0 ? "#9CA3AF" : r.runningBalance < 0 ? C : D }}>
                          {r.runningBalance === 0 ? "—"
                            : r.runningBalance < 0
                              ? `(${Math.abs(r.runningBalance).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})})`
                              : r.runningBalance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {rows.length > 0 && (() => {
                  const totD = rows.reduce((s,r) => s + parseFloat(r.debit ?? "0"), 0);
                  const totC = rows.reduce((s,r) => s + parseFloat(r.credit ?? "0"), 0);
                  const fmt2 = (n:number) => n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
                  return (
                    <tfoot>
                      <tr style={{ background: "#374151", color: "#fff", fontWeight: 700 }}>
                        <td colSpan={4} style={{ padding: "6px 10px", textAlign: "right" }}>الإجمالي</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: showColors ? "#FCA5A5" : "#fff" }}>{fmt2(totD)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: showColors ? "#6EE7B7" : "#fff" }}>{fmt2(totC)}</td>
                        <td style={{ padding: "6px 10px" }}></td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cost Centers (مراكز التكلفة) ─────────────────────────────────────────────
function CostCentersPage() {
  const listQuery = trpc.costCenters.list.useQuery();
  const createMutation = trpc.costCenters.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة مركز التكلفة"); listQuery.refetch(); setShowForm(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.costCenters.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); listQuery.refetch(); },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", name2: "",
    centerType: "branch" as "root" | "general" | "branch",
    parentId: "", level: 1, notes: "",
  });
  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Building className="w-4 h-4 text-primary" /> مراكز التكلفة
        </h3>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> إضافة مركز تكلفة
        </Button>
      </div>

      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-24">رقم</TableHead>
              <TableHead className="text-xs">إسم 1</TableHead>
              <TableHead className="text-xs">إسم 2</TableHead>
              <TableHead className="text-xs text-center">النوع</TableHead>
              <TableHead className="text-xs text-center">المستوى</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">لا توجد مراكز تكلفة</TableCell></TableRow>
            )}
            {listQuery.data?.map(c => (
              <TableRow key={c.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-mono text-primary">{c.code}</TableCell>
                <TableCell className="text-xs font-semibold">{c.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.name2 ?? "-"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={c.centerType === "root" ? "default" : c.centerType === "general" ? "secondary" : "outline"} className="text-xs">
                    {c.centerType === "root" ? "جذري" : c.centerType === "general" ? "عام" : "فرعي"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-xs">{c.level}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive"
                    onClick={() => deleteMutation.mutate({ id: c.id })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">إضافة مركز تكلفة</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="main">
            <TabsList className="w-full">
              <TabsTrigger value="main" className="flex-1 text-xs">نافذة رئيسية</TabsTrigger>
              <TabsTrigger value="extra" className="flex-1 text-xs">وصف إضافي</TabsTrigger>
              <TabsTrigger value="balances" className="flex-1 text-xs">أرصدة</TabsTrigger>
            </TabsList>
            <TabsContent value="main" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">رقم *</Label>
                  <Input value={form.code} onChange={e => setF("code", e.target.value)} className="h-8 text-xs" placeholder="كود مركز التكلفة" />
                </div>
                <div>
                  <Label className="text-xs">النوع</Label>
                  <div className="flex gap-3 mt-1">
                    {["root", "general", "branch"].map(t => (
                      <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="radio" name="centerType" value={t} checked={form.centerType === t} onChange={() => setF("centerType", t)} />
                        {t === "root" ? "جذري" : t === "general" ? "عام" : "فرعي"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs">إسم 1 *</Label>
                <Input value={form.name} onChange={e => setF("name", e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">إسم 2</Label>
                <Input value={form.name2} onChange={e => setF("name2", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">يصب في</Label>
                  <Select value={form.parentId} onValueChange={v => setF("parentId", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="مركز أعلى..." /></SelectTrigger>
                    <SelectContent>
                      {listQuery.data?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">المستوى</Label>
                  <Input type="number" value={form.level} onChange={e => setF("level", parseInt(e.target.value))} className="h-8 text-xs" min={1} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="extra" className="pt-3">
              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Input value={form.notes} onChange={e => setF("notes", e.target.value)} className="h-8 text-xs" />
              </div>
            </TabsContent>
            <TabsContent value="balances" className="pt-3">
              <p className="text-xs text-muted-foreground text-center py-4">الأرصدة تُحسب تلقائياً من القيود</p>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button size="sm" disabled={!form.code || !form.name || createMutation.isPending}
              onClick={() => createMutation.mutate({ ...form, parentId: form.parentId ? parseInt(form.parentId) : undefined })}>
              <Check className="w-3 h-3 ml-1" /> حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cost Allocation (توزيع التكاليف) ─────────────────────────────────────────
function CostAllocationPage() {
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const accountsQuery = trpc.accounts.list.useQuery();
  const [rows, setRows] = useState([
    { accountId: "", percent: "", amount: "", costCenterId: "" },
    { accountId: "", percent: "", amount: "", costCenterId: "" },
  ]);
  const totalPercent = rows.reduce((s, r) => s + (parseFloat(r.percent) || 0), 0);

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <Scale className="w-4 h-4 text-primary" /> توزيع التكاليف
      </h3>
      <Card className="border-border/60">
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">تاريخ التوزيع</Label>
              <DateMaskInput value={new Date().toISOString().split("T")[0]} onChange={() => {}} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">الحساب الأصلي</Label>
              <Select>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب التكلفة..." /></SelectTrigger>
                <SelectContent>
                  {accountsQuery.data?.filter(a => a.accountType === "expenses" && a.allowPosting).map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">إجمالي المبلغ</Label>
              <Input type="number" className="h-8 text-xs" placeholder="0.000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">مركز التكلفة</TableHead>
              <TableHead className="text-xs">الحساب المدين</TableHead>
              <TableHead className="text-xs text-center">نسبة %</TableHead>
              <TableHead className="text-xs text-center">المبلغ</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Select value={row.costCenterId} onValueChange={v => setRows(p => p.map((r, idx) => idx === i ? { ...r, costCenterId: v } : r))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="مركز..." /></SelectTrigger>
                    <SelectContent>
                      {costCentersQuery.data?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.accountId} onValueChange={v => setRows(p => p.map((r, idx) => idx === i ? { ...r, accountId: v } : r))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="حساب..." /></SelectTrigger>
                    <SelectContent>
                      {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                        <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input type="number" value={row.percent} min={0} max={100}
                    onChange={e => setRows(p => p.map((r, idx) => idx === i ? { ...r, percent: e.target.value } : r))}
                    className="h-7 text-xs text-center" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={row.amount}
                    onChange={e => setRows(p => p.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))}
                    className="h-7 text-xs text-center" />
                </TableCell>
                <TableCell>
                  {rows.length > 2 && (
                    <button onClick={() => setRows(p => p.filter((_, idx) => idx !== i))}
                      className="text-destructive text-xs"><X className="w-3 h-3" /></button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/20 font-bold">
              <TableCell colSpan={3} className="text-xs font-bold text-right">الإجمالي</TableCell>
              <TableCell className={`text-center text-sm font-bold ${Math.abs(totalPercent - 100) < 0.01 ? "text-emerald-500" : "text-destructive"}`}>
                {totalPercent.toFixed(1)}%
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="p-3 flex items-center justify-between border-t border-border">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            onClick={() => setRows(p => [...p, { accountId: "", percent: "", amount: "", costCenterId: "" }])}>
            <Plus className="w-3 h-3" /> إضافة سطر
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1"
            disabled={Math.abs(totalPercent - 100) > 0.01}
            onClick={() => toast.success("تم حفظ توزيع التكاليف")}>
            <Check className="w-3 h-3" /> حفظ التوزيع
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Trial Balance (ميزان مراجعة الأستاذ العام) ───────────────────────────────
type TBRow = {
  accountId: number; code: string; name: string; nature: string;
  isParent: boolean; level: number; parentId: number | null; accountType: string;
  openingBalance: number; openingBalanceType: string;
  movementDebit: number; movementCredit: number;
  closingBalance: number; closingBalanceType: string;
};

type TBNode = TBRow & {
  children: TBNode[];
  aggOpenD: number; aggOpenC: number;
  aggMoveD: number; aggMoveC: number;
  aggCloseD: number; aggCloseC: number;
};

function tbPeriodPreset(p: string): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  if (p === "today")  return { from: iso(now), to: iso(now) };
  if (p === "week")   { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: iso(d), to: iso(now) }; }
  if (p === "month")  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (p === "year")   return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return { from: "", to: iso(now) };
}

function buildTBTree(rows: TBRow[]): TBNode[] {
  const map = new Map<number, TBNode>();
  for (const r of rows) {
    map.set(r.accountId, { ...r, children: [], aggOpenD: 0, aggOpenC: 0, aggMoveD: 0, aggMoveC: 0, aggCloseD: 0, aggCloseC: 0 });
  }
  const roots: TBNode[] = [];
  for (const [, n] of map) {
    const par = n.parentId !== null ? map.get(n.parentId) : null;
    if (par) par.children.push(n); else roots.push(n);
  }
  const sortAll = (ns: TBNode[]) => { ns.sort((a, b) => a.code.localeCompare(b.code)); ns.forEach(n => sortAll(n.children)); };
  sortAll(roots);
  const computeAgg = (n: TBNode) => {
    n.aggOpenD = n.openingBalanceType === "debit"  ? n.openingBalance : 0;
    n.aggOpenC = n.openingBalanceType === "credit" ? n.openingBalance : 0;
    n.aggMoveD = n.movementDebit;
    n.aggMoveC = n.movementCredit;
    for (const c of n.children) {
      computeAgg(c);
      n.aggOpenD += c.aggOpenD; n.aggOpenC += c.aggOpenC;
      n.aggMoveD += c.aggMoveD; n.aggMoveC += c.aggMoveC;
    }
    const netC = (n.aggOpenD + n.aggMoveD) - (n.aggOpenC + n.aggMoveC);
    n.aggCloseD = netC > 0 ? netC : 0;
    n.aggCloseC = netC < 0 ? -netC : 0;
  };
  for (const r of roots) computeAgg(r);
  return roots;
}

type FlatTBRow = { node: TBNode; depth: number; hasChildren: boolean };

function flattenTBTree(roots: TBNode[], expanded: Set<number>, search: string, hideZero: boolean): FlatTBRow[] {
  const q = search.trim().toLowerCase();
  const selfMatch   = (n: TBNode) => !q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
  const anyMatch    = (n: TBNode): boolean => selfMatch(n) || n.children.some(c => anyMatch(c));
  const hasActivity = (n: TBNode): boolean =>
    n.aggMoveD > 0 || n.aggMoveC > 0 || n.aggOpenD > 0 || n.aggOpenC > 0 ||
    n.children.some(c => hasActivity(c));
  const result: FlatTBRow[] = [];
  const go = (nodes: TBNode[], depth: number) => {
    for (const n of nodes) {
      if (!anyMatch(n)) continue;
      if (hideZero && !hasActivity(n)) continue;
      result.push({ node: n, depth, hasChildren: n.children.length > 0 });
      if ((expanded.has(n.accountId) || !!q) && n.children.length > 0) go(n.children, depth + 1);
    }
  };
  go(roots, 0);
  return result;
}

function LedgerDialogBody({
  accountId: initAccountId, accountCode, accountName, fromDate: initFrom, toDate: initTo,
}: {
  accountId: number; accountCode: string; accountName: string;
  fromDate: string; toDate: string;
}) {
  const accountsQuery = trpc.accounts.list.useQuery();
  const [accountId, setAccountId] = useState<number>(initAccountId);
  const [fromDate, setFromDate] = useState(initFrom);
  const [toDate, setToDate] = useState(initTo);
  const [queried, setQueried] = useState({ accountId: initAccountId, fromDate: initFrom, toDate: initTo });

  const stmtQuery = trpc.accounting.accountStatement.useQuery(
    { accountId: queried.accountId, fromDate: queried.fromDate ? new Date(queried.fromDate) : undefined, toDate: queried.toDate ? new Date(queried.toDate) : undefined },
    { enabled: true }
  );

  const queriedAccount = accountsQuery.data?.find(a => a.id === queried.accountId);

  let runningBalance = 0;
  const rows = (stmtQuery.data ?? []).map(l => {
    runningBalance += parseFloat(l.debit ?? "0") - parseFloat(l.credit ?? "0");
    return { ...l, runningBalance };
  });

  return (
    <div className="space-y-3">
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">الحساب</Label>
              <Select value={accountId.toString()} onValueChange={v => setAccountId(parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر حساب..." /></SelectTrigger>
                <SelectContent>
                  {accountsQuery.data?.filter(a => a.allowPosting).map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <DateMaskInput value={fromDate} onChange={setFromDate} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <DateMaskInput value={toDate} onChange={setToDate} className="h-8 text-xs" />
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8 text-xs w-full gap-1"
                onClick={() => setQueried({ accountId, fromDate, toDate })}>
                <Search className="w-3 h-3" /> عرض الكشف
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {queriedAccount && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 border-b border-border">
            <div className="text-center">
              <p className="font-bold text-sm">كشف حساب: {queriedAccount.code} - {queriedAccount.name}</p>
              {queried.fromDate && queried.toDate && <p className="text-xs text-muted-foreground">من {queried.fromDate} إلى {queried.toDate}</p>}
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">التاريخ</TableHead>
                <TableHead className="text-xs">رقم القيد</TableHead>
                <TableHead className="text-xs">نوع السند</TableHead>
                <TableHead className="text-xs">البيان</TableHead>
                <TableHead className="text-xs text-center">مدين</TableHead>
                <TableHead className="text-xs text-center">دائن</TableHead>
                <TableHead className="text-xs text-center">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stmtQuery.isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">جاري تحميل البيانات...</TableCell></TableRow>
              )}
              {!stmtQuery.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">لا توجد حركات في هذه الفترة</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={i} className="hover:bg-muted/10">
                  <TableCell className="text-xs">{new Date(r.entryDate).toLocaleDateString("ar-SA")}</TableCell>
                  <TableCell className="text-xs font-mono text-primary">{(r as any).reference ?? r.entryNumber}</TableCell>
                  <TableCell className="text-xs">{r.voucherType}</TableCell>
                  <TableCell className="text-xs">{r.description ?? "-"}</TableCell>
                  <TableCell className="text-center text-xs">{parseFloat(r.debit ?? "0") > 0 ? parseFloat(r.debit ?? "0").toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-center text-xs">{parseFloat(r.credit ?? "0") > 0 ? parseFloat(r.credit ?? "0").toLocaleString() : "-"}</TableCell>
                  <TableCell className={`text-center text-xs font-bold ${r.runningBalance < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {r.runningBalance < 0 ? `(${Math.abs(r.runningBalance).toLocaleString()})` : r.runningBalance.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function TrialBalancePage({
  onDrillDown,
}: {
  onDrillDown?: (accountId: number, fromDate: string, toDate: string) => void;
}) {
  const initP = tbPeriodPreset("year");
  const [fromDate, setFromDate] = useState(initP.from);
  const [toDate,   setToDate]   = useState(initP.to);
  const [period,   setPeriod]   = useState("year");
  const [costCenterId, setCostCenterId] = useState<number | undefined>(undefined);
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [tbMode,   setTbMode]   = useState<"full" | "simple">("full");
  const [showZero, setShowZero] = useState(false);
  const [acctCard, setAcctCard] = useState<TBNode | null>(null);
  const [ledgerDlg, setLedgerDlg] = useState<{ accountId: number; code: string; name: string } | null>(null);
  const initDone = useRef(false);
  const costCentersQuery = trpc.costCenters.list.useQuery();

  const tbQuery = trpc.accounting.trialBalance.useQuery(
    { fromDate: fromDate ? new Date(fromDate) : undefined, toDate: toDate ? new Date(toDate) : undefined, costCenterId },
    { enabled: true }
  );

  const tree = useMemo(() => buildTBTree((tbQuery.data ?? []) as TBRow[]), [tbQuery.data]);

  useEffect(() => {
    if (!initDone.current && tree.length > 0) {
      initDone.current = true;
      setExpanded(new Set(tree.map(n => n.accountId)));
    }
  }, [tree]);

  const flatRows = useMemo(() => flattenTBTree(tree, expanded, search, !showZero), [tree, expanded, search, showZero]);

  const totals = useMemo(() =>
    tree.reduce((acc, n) => ({
      openD:  acc.openD  + n.aggOpenD,  openC:  acc.openC  + n.aggOpenC,
      moveD:  acc.moveD  + n.aggMoveD,  moveC:  acc.moveC  + n.aggMoveC,
      closeD: acc.closeD + n.aggCloseD, closeC: acc.closeC + n.aggCloseC,
    }), { openD: 0, openC: 0, moveD: 0, moveC: 0, closeD: 0, closeC: 0 }),
  [tree]);

  const applyPeriod = (p: string) => { setPeriod(p); const { from, to } = tbPeriodPreset(p); setFromDate(from); setToDate(to); };
  const toggle = (id: number) => setExpanded(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const expandAll   = () => { const s = new Set<number>(); const go = (ns: TBNode[]) => { for (const n of ns) { s.add(n.accountId); go(n.children); } }; go(tree); setExpanded(s); };
  const collapseAll = () => setExpanded(new Set());
  const drill = (n: TBNode) => onDrillDown?.(n.accountId, fromDate, toDate);

  const fmtN = (n: number) => n === 0 ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const D = "#C0392B";
  const C = "#1A7A4A";
  const PERIODS = [
    { id: "today", l: "اليوم" }, { id: "week",  l: "الأسبوع" },
    { id: "month", l: "الشهر" }, { id: "year",  l: "السنة"   },
  ];
  const NCOLS = tbMode === "full" ? 9 : 7;

  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Cairo', Tahoma, sans-serif", background: "#F9FAFB" }}>

      {/* ══ شريط العنوان ══ */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #E5E7EB", background: "#fff", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(64,107,147,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Scale style={{ width: 16, height: 16, color: "#406B93" }} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>ميزان مراجعة الأستاذ العام</div>
            <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>
              {tbQuery.isLoading ? "جاري التحميل..." : `${flatRows.length} حساب`}
              {fromDate ? ` · ${fromDate}` : ""}
              {toDate   ? ` — ${toDate}` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #D1D5DB" }}>
          {(["full","simple"] as const).map(m => (
            <button key={m} onClick={() => setTbMode(m)} style={{ padding: "3px 12px", fontSize: 11, cursor: "pointer", border: "none", background: tbMode === m ? "#406B93" : "#fff", color: tbMode === m ? "#fff" : "#6B7280", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
              {m === "full" ? "تفصيلي" : "مبسّط"}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #D1D5DB", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
          <Printer style={{ width: 12, height: 12 }} /> طباعة
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid #D1D5DB", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
          <Download style={{ width: 12, height: 12 }} /> تصدير
        </button>
      </div>

      {/* ══ شريط الفلاتر ══ */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #E5E7EB", background: "#F3F7FB", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#6B7280" }}>الفترة:</span>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => applyPeriod(p.id)} style={{ padding: "3px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", border: `1px solid ${period === p.id ? "#406B93" : "#D1D5DB"}`, background: period === p.id ? "#E8F0F8" : "#fff", color: period === p.id ? "#406B93" : "#6B7280", fontFamily: "'Cairo',Tahoma,sans-serif", fontWeight: 600 }}>
              {p.l}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>أو مخصص:</span>
          <span style={{ fontSize: 11, color: "#6B7280" }}>من</span>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPeriod("custom"); }} style={{ padding: "3px 7px", border: `1px solid ${period === "custom" ? "#406B93" : "#D1D5DB"}`, borderRadius: 6, fontSize: 11, background: "#fff", color: "#111827" }} />
          <span style={{ fontSize: 11, color: "#6B7280" }}>إلى</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPeriod("custom"); }} style={{ padding: "3px 7px", border: `1px solid ${period === "custom" ? "#406B93" : "#D1D5DB"}`, borderRadius: 6, fontSize: 11, background: "#fff", color: "#111827" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 280 }}>
            <Search style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#9CA3AF", pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود..." style={{ width: "100%", paddingRight: 26, paddingLeft: 8, paddingTop: 4, paddingBottom: 4, border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11, background: "#fff" }} />
          </div>
          <select value={costCenterId?.toString() ?? ""} onChange={e => setCostCenterId(e.target.value ? parseInt(e.target.value) : undefined)} style={{ padding: "4px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11, background: "#fff", color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>
            <option value="">كل مراكز التكلفة</option>
            {costCentersQuery.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={expandAll}   style={{ padding: "3px 9px", border: "1px solid #D1D5DB", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>+ فتح الكل</button>
            <button onClick={collapseAll} style={{ padding: "3px 9px", border: "1px solid #D1D5DB", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'Cairo',Tahoma,sans-serif" }}>− طي الكل</button>
            <button
              onClick={() => setShowZero(v => !v)}
              style={{ padding: "3px 9px", border: `1px solid ${showZero ? "#406B93" : "#D1D5DB"}`, borderRadius: 6, background: showZero ? "#E8F0F8" : "#fff", cursor: "pointer", fontSize: 11, color: showZero ? "#406B93" : "#6B7280", fontFamily: "'Cairo',Tahoma,sans-serif", fontWeight: showZero ? 600 : 400 }}
              title={showZero ? "الآن: تظهر الحسابات الصفرية — اضغط للإخفاء" : "الآن: الحسابات الصفرية مخفية — اضغط للإظهار"}
            >
              {showZero ? "✓ إظهار الصفرية" : "إظهار الصفرية"}
            </button>
          </div>
          <button onClick={() => tbQuery.refetch()} style={{ width: 28, height: 28, border: "1px solid #D1D5DB", borderRadius: 6, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280" }} title="تحديث">
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ══ الجدول ══ */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "#E8E4DA", color: "#1E2A1A", position: "sticky", top: 0, zIndex: 3, borderBottom: "1px solid #C8C3B8" }}>
              <th style={{ width: 28, padding: "7px 4px" }}></th>
              <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, width: 90, whiteSpace: "nowrap" }}>كود</th>
              <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>اسم الحساب</th>
              {tbMode === "full" ? (
                <>
                  <th colSpan={2} style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, borderRight: "1px solid #6B7280", borderLeft: "1px solid #6B7280" }}>رصيد أول المدة</th>
                  <th colSpan={2} style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, borderLeft: "1px solid #6B7280" }}>الحركة</th>
                  <th colSpan={2} style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5 }}>رصيد آخر المدة</th>
                </>
              ) : (
                <>
                  <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap" }}>رصيد أول المدة</th>
                  <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap" }}>حركة مدين</th>
                  <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap" }}>حركة دائن</th>
                  <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 10.5, whiteSpace: "nowrap" }}>رصيد آخر المدة</th>
                </>
              )}
            </tr>
            {tbMode === "full" && (
              <tr style={{ background: "#F0EDE6", color: "#3A3228", position: "sticky", top: 38, zIndex: 3, borderBottom: "1px solid #C8C3B8" }}>
                <th colSpan={3}></th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10 }}>مدين</th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10, borderLeft: "1px solid #9CA3AF" }}>دائن</th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10 }}>مدين</th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10, borderLeft: "1px solid #9CA3AF" }}>دائن</th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10 }}>مدين</th>
                <th style={{ padding: "3px 10px", textAlign: "center", fontSize: 10 }}>دائن</th>
              </tr>
            )}
          </thead>
          <tbody>
            {tbQuery.isLoading ? (
              <tr><td colSpan={NCOLS} style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 12 }}>جاري تحميل البيانات...</td></tr>
            ) : flatRows.length === 0 ? (
              <tr><td colSpan={NCOLS} style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 12 }}>
                {search ? "لا توجد حسابات تطابق البحث" : "لا توجد بيانات للفترة المحددة — أضف قيوداً مرحّلة"}
              </td></tr>
            ) : flatRows.map(({ node: n, depth, hasChildren }, rowIdx) => {
              const bg    = depth === 0 ? "#E8E4DA" : depth === 1 ? "#F0EDE6" : rowIdx % 2 === 0 ? "#fff" : "#E8E4DA";
              const fw    = depth === 0 ? 700 : depth === 1 ? 600 : 400;
              const fs    = depth === 0 ? 12.5 : 11.5;
              const indent = depth * 18;
              const hasData     = n.aggMoveD > 0 || n.aggMoveC > 0 || n.aggOpenD > 0 || n.aggOpenC > 0;
              const hasClose    = n.aggCloseD > 0 || n.aggCloseC > 0;
              const isLeaf      = !hasChildren;
              const canDrill    = isLeaf && hasData;
              const canDrillCl  = isLeaf && hasClose;
              const openDlg     = () => { if (isLeaf) setLedgerDlg({ accountId: n.accountId, code: n.code, name: n.name }); };
              const numCellStyle = (active: boolean, extra?: CSSProperties): CSSProperties => ({
                padding: "5px 10px", textAlign: "center",
                cursor: active ? "pointer" : "default",
                transition: "background 0.1s",
                ...extra,
              });
              const numSpan = (value: number, color: string, active: boolean, bold = false) =>
                value === 0 ? <span style={{ color: "#9CA3AF" }}>—</span> : (
                  <span style={{
                    color,
                    fontWeight: bold ? 700 : fw,
                    fontSize: fs,
                    textDecoration: active ? "underline dotted" : "none",
                    transition: "color 0.15s",
                  }}
                    onMouseEnter={e => { if (active) (e.currentTarget as HTMLElement).style.color = "#406B93"; }}
                    onMouseLeave={e => { if (active) (e.currentTarget as HTMLElement).style.color = color; }}
                  >{fmtN(value)}</span>
                );
              return (
                <tr key={n.accountId}
                  style={{ background: bg, borderBottom: `1px solid ${depth === 0 ? "#D1D5DB" : "#F3F4F6"}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#D8D4CA")}
                  onMouseLeave={e => (e.currentTarget.style.background = bg)}
                >
                  <td style={{ padding: "5px 4px", textAlign: "center" }}>
                    {hasChildren && (
                      <button onClick={() => toggle(n.accountId)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", padding: 2 }}>
                        {expanded.has(n.accountId) ? <ChevronDown style={{ width: 13, height: 13 }} /> : <ChevronRight style={{ width: 13, height: 13 }} />}
                      </button>
                    )}
                  </td>
                  <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: fw, fontSize: fs, paddingRight: 8 + indent }}>
                    <span onClick={() => setAcctCard(n)} style={{ color: "#406B93", cursor: "pointer" }} title="كارت الحساب">{n.code}</span>
                  </td>
                  <td style={{ padding: "5px 8px", fontWeight: fw, fontSize: fs, color: depth === 0 ? "#1E3A5F" : "#374151" }}>
                    <span onClick={() => setAcctCard(n)} style={{ cursor: "pointer" }} title="كارت الحساب">{n.name}</span>
                    {n.level === 1 && <span style={{ marginRight: 8, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "#D4E8F5", color: "#2D5F85", fontWeight: 700 }}>جذري</span>}
                    {n.level === 2 && <span style={{ marginRight: 8, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "#F3E8FF", color: "#7C3AED", fontWeight: 700 }}>رئيسي</span>}
                  </td>
                  {tbMode === "full" ? (
                    <>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill)} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggOpenD, D, canDrill)}</td>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill, { borderLeft: "1px solid #E5E7EB" })} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggOpenC, C, canDrill)}</td>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill)} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggMoveD, D, canDrill)}</td>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill, { borderLeft: "1px solid #E5E7EB" })} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggMoveC, C, canDrill)}</td>
                      <td onClick={canDrillCl ? openDlg : undefined} style={numCellStyle(canDrillCl)} title={canDrillCl ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggCloseD, D, canDrillCl, true)}</td>
                      <td onClick={canDrillCl ? openDlg : undefined} style={numCellStyle(canDrillCl)} title={canDrillCl ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggCloseC, C, canDrillCl, true)}</td>
                    </>
                  ) : (
                    <>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill)} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>
                        {n.aggOpenD > n.aggOpenC
                          ? <span style={{ color: D, fontWeight: fw, fontSize: fs, textDecoration: canDrill ? "underline dotted" : "none" }}>{fmtN(n.aggOpenD - n.aggOpenC)} <span style={{ fontSize: 9 }}>م</span></span>
                          : n.aggOpenC > n.aggOpenD
                            ? <span style={{ color: C, fontWeight: fw, fontSize: fs, textDecoration: canDrill ? "underline dotted" : "none" }}>({fmtN(n.aggOpenC - n.aggOpenD)}) <span style={{ fontSize: 9 }}>د</span></span>
                            : <span style={{ color: "#9CA3AF" }}>—</span>}
                      </td>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill)} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggMoveD, D, canDrill)}</td>
                      <td onClick={canDrill ? openDlg : undefined} style={numCellStyle(canDrill)} title={canDrill ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>{numSpan(n.aggMoveC, C, canDrill)}</td>
                      <td onClick={canDrillCl ? openDlg : undefined} style={numCellStyle(canDrillCl)} title={canDrillCl ? "انقر لفتح كشف الحساب" : !isLeaf ? "حساب تجميعي" : ""}>
                        {n.aggCloseD > 0
                          ? <span style={{ color: D, fontWeight: 700, fontSize: fs, textDecoration: canDrillCl ? "underline dotted" : "none" }}>{fmtN(n.aggCloseD)} <span style={{ fontSize: 9 }}>م</span></span>
                          : n.aggCloseC > 0
                            ? <span style={{ color: C, fontWeight: 700, fontSize: fs, textDecoration: canDrillCl ? "underline dotted" : "none" }}>({fmtN(n.aggCloseC)}) <span style={{ fontSize: 9 }}>د</span></span>
                            : <span style={{ color: "#9CA3AF" }}>—</span>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#E8E4DA", color: "#1E2A1A", position: "sticky", bottom: 0, zIndex: 2, borderTop: "1px solid #C8C3B8", fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: "7px 12px", fontWeight: 700, fontSize: 12 }}>الإجمالي الكلي</td>
              {tbMode === "full" ? (
                <>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#C0392B", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.openD)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#1A7A4A", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.openC)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#C0392B", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.moveD)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#1A7A4A", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.moveC)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#C0392B", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.closeD)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#1A7A4A", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.closeC)}</td>
                </>
              ) : (
                <>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#9CA3AF" }}>—</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#C0392B", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.moveD)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#1A7A4A", fontWeight: 700, fontSize: 12 }}>{fmtN(totals.moveC)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#9CA3AF" }}>—</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ══ كارت الحساب ══ */}
      <Dialog open={!!acctCard} onOpenChange={() => setAcctCard(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen style={{ width: 14, height: 14, color: "#406B93" }} />
              كارت الحساب — {acctCard?.code}
            </DialogTitle>
          </DialogHeader>
          {acctCard && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>كود الحساب</div><div style={{ fontFamily: "monospace", fontWeight: 700, color: "#406B93" }}>{acctCard.code}</div></div>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>اسم الحساب</div><div style={{ fontWeight: 600 }}>{acctCard.name}</div></div>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>النوع</div><div>{acctCard.isParent ? "حساب رئيسي" : "حساب تفصيلي"}</div></div>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>طبيعة الحساب</div><div style={{ color: acctCard.nature === "debit" ? D : C, fontWeight: 600 }}>{acctCard.nature === "debit" ? "مدينة" : "دائنة"}</div></div>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>التصنيف</div><div style={{ fontSize: 11 }}>{acctCard.accountType}</div></div>
                <div><div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 2 }}>المستوى</div><div style={{ fontSize: 11 }}>مستوى {acctCard.level}</div></div>
              </div>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#1E3A5F", color: "#fff" }}>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>البيان</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", color: "#93C5FD", fontWeight: 600 }}>مدين</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", color: "#FCD34D", fontWeight: 600 }}>دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "6px 10px", color: "#6B7280" }}>رصيد أول المدة</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: D, fontWeight: 600 }}>{fmtN(acctCard.aggOpenD)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: C, fontWeight: 600 }}>{fmtN(acctCard.aggOpenC)}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "6px 10px", color: "#6B7280" }}>الحركة خلال الفترة</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: D, fontWeight: 600 }}>{fmtN(acctCard.aggMoveD)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: C, fontWeight: 600 }}>{fmtN(acctCard.aggMoveC)}</td>
                    </tr>
                    <tr style={{ background: "#EFF6FF" }}>
                      <td style={{ padding: "6px 10px", fontWeight: 700 }}>رصيد آخر المدة</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: D, fontWeight: 700 }}>{fmtN(acctCard.aggCloseD)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: C, fontWeight: 700 }}>{fmtN(acctCard.aggCloseC)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { drill(acctCard); setAcctCard(null); }} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", background: "#2563EB", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Cairo',Tahoma,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <FileText style={{ width: 12, height: 12 }} /> كشف الحساب
                </button>
                <button onClick={() => setAcctCard(null)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "'Cairo',Tahoma,sans-serif" }}>
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── كشف حساب popup ── */}
      <Dialog open={!!ledgerDlg} onOpenChange={() => setLedgerDlg(null)}>
        <DialogContent className="!fixed !inset-0 !translate-x-0 !translate-y-0 !max-w-none !rounded-none !w-screen !h-screen !m-0 !p-0" dir="rtl" style={{ display: "flex", flexDirection: "column" }}>
          <DialogHeader style={{ borderBottom: "1px solid #E5E7EB", padding: "10px 16px", flexShrink: 0 }}>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(64,107,147,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText style={{ width: 14, height: 14, color: "#406B93" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>كشف حساب الأستاذ</div>
                {ledgerDlg && (
                  <div style={{ fontSize: 11, color: "#406B93", fontWeight: 600 }}>
                    {ledgerDlg.code} — {ledgerDlg.name}
                    <span style={{ color: "#9CA3AF", fontWeight: 400, marginRight: 8 }}>
                      {fromDate} : {toDate}
                    </span>
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {ledgerDlg && (
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 8 }}>
              <LedgerDialogBody
                accountId={ledgerDlg.accountId}
                accountCode={ledgerDlg.code}
                accountName={ledgerDlg.name}
                fromDate={fromDate}
                toDate={toDate}
              />
            </div>
          )}
          <div className="flex gap-2" style={{ borderTop: "1px solid #E5E7EB", flexShrink: 0, padding: "10px 16px" }}>
            {onDrillDown && (
              <Button size="sm" variant="outline" className="gap-1 text-xs h-8"
                onClick={() => { if (ledgerDlg) { onDrillDown(ledgerDlg.accountId, fromDate, toDate); setLedgerDlg(null); } }}
              >
                <FileText className="w-3 h-3" /> فتح في صفحة كشف الحساب
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setLedgerDlg(null)}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Income Statement ──────────────────────────────────────────────────────────
function IncomeStatementPage() {
  const revenue = 328000;
  const cogs = 215000;
  const grossProfit = revenue - cogs;
  const operatingExpenses = 18000;
  const netProfit = grossProfit - operatingExpenses;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">قائمة الأرباح والخسائر</h3>
        <Button variant="outline" className="h-8 text-xs" onClick={() => toast.info("جاري التصدير...")}>تصدير PDF</Button>
      </div>
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="text-center border-b border-border pb-4">
            <h2 className="font-bold text-lg">قائمة الأرباح والخسائر</h2>
            <p className="text-muted-foreground text-sm">للفترة المنتهية في 31 مايو 2026</p>
          </div>
          {[
            { label: "إيرادات المبيعات",           value: revenue,           bold: false, color: "" },
            { label: "تكلفة البضاعة المباعة",       value: -cogs,             bold: false, color: "text-destructive" },
            { label: "مجمل الربح",                  value: grossProfit,       bold: true,  color: grossProfit >= 0 ? "text-emerald-500" : "text-destructive" },
            { label: "المصروفات التشغيلية",         value: -operatingExpenses,bold: false, color: "text-destructive" },
            { label: "صافي الربح (الخسارة)",        value: netProfit,         bold: true,  color: netProfit >= 0 ? "text-emerald-500" : "text-destructive" },
          ].map((row, i) => (
            <div key={i} className={`flex justify-between items-center py-1.5 ${row.bold ? "border-t border-border font-bold" : ""}`}>
              <span className={`text-sm ${row.bold ? "font-bold" : "text-muted-foreground"}`}>{row.label}</span>
              <span className={`text-sm font-semibold ${row.color}`}>
                {row.value < 0 ? `(${Math.abs(row.value).toLocaleString()})` : row.value.toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Balance Sheet ─────────────────────────────────────────────────────────────
function BalanceSheetPage() {
  const assets = [
    { name: "الأصول المتداولة", items: [
      { name: "الصندوق والبنك", value: 102500 },
      { name: "الذمم المدينة",  value: 45000 },
      { name: "المخزون",        value: 78000 },
    ]},
    { name: "الأصول الثابتة", items: [
      { name: "الأصول الثابتة (صافي)", value: 150000 },
    ]},
  ];
  const liabilities = [
    { name: "الخصوم المتداولة", items: [
      { name: "الذمم الدائنة",    value: 23400 },
      { name: "قروض قصيرة الأجل", value: 15000 },
    ]},
    { name: "حقوق الملكية", items: [
      { name: "رأس المال",         value: 300000 },
      { name: "الأرباح المحتجزة",  value: 37100 },
    ]},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">الميزانية العمومية</h3>
        <Button variant="outline" className="h-8 text-xs" onClick={() => toast.info("جاري التصدير...")}>تصدير PDF</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-500">الأصول</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {assets.map(group => (
              <div key={group.name}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{group.name}</p>
                {group.items.map(item => (
                  <div key={item.name} className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border font-bold">
              <span>إجمالي الأصول</span>
              <span className="text-emerald-500">375,500</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-500">الخصوم وحقوق الملكية</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {liabilities.map(group => (
              <div key={group.name}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{group.name}</p>
                {group.items.map(item => (
                  <div key={item.name} className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border font-bold">
              <span>إجمالي الخصوم وحقوق الملكية</span>
              <span className="text-blue-500">375,500</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Cash Flow (قائمة التدفقات النقدية) ───────────────────────────────────────
function CashFlowPage() {
  const receiptQuery = trpc.receiptVouchers.list.useQuery();
  const paymentQuery = trpc.paymentVouchers.list.useQuery();

  const totalReceipts = receiptQuery.data?.reduce((s, v) => s + parseFloat(v.amount ?? "0"), 0) ?? 0;
  const totalPayments = paymentQuery.data?.reduce((s, v) => s + parseFloat(v.amount ?? "0"), 0) ?? 0;
  const netCashFlow = totalReceipts - totalPayments;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">قائمة التدفقات النقدية</h3>
        <Button variant="outline" className="h-8 text-xs" onClick={() => toast.info("جاري التصدير...")}>تصدير PDF</Button>
      </div>
      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div className="text-center border-b border-border pb-4">
            <h2 className="font-bold text-lg">قائمة التدفقات النقدية</h2>
            <p className="text-muted-foreground text-sm">للفترة المنتهية في 31 مايو 2026</p>
          </div>

          {/* Operating Activities */}
          <div>
            <h4 className="font-bold text-sm mb-3 text-primary">أولاً: التدفقات من الأنشطة التشغيلية</h4>
            <div className="space-y-2 mr-4">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-sm text-muted-foreground">المقبوضات من العملاء (سندات القبض)</span>
                <span className="text-sm font-semibold text-emerald-600">{totalReceipts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-sm text-muted-foreground">المدفوعات للموردين (سندات الصرف)</span>
                <span className="text-sm font-semibold text-destructive">({totalPayments.toLocaleString()})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-sm text-muted-foreground">المدفوعات للموظفين</span>
                <span className="text-sm font-semibold text-destructive">(0)</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 font-bold">
              <span className="text-sm">صافي التدفقات التشغيلية</span>
              <span className={`text-sm ${netCashFlow >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {netCashFlow < 0 ? `(${Math.abs(netCashFlow).toLocaleString()})` : netCashFlow.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Investing Activities */}
          <div>
            <h4 className="font-bold text-sm mb-3 text-primary">ثانياً: التدفقات من الأنشطة الاستثمارية</h4>
            <div className="space-y-2 mr-4">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-sm text-muted-foreground">شراء أصول ثابتة</span>
                <span className="text-sm font-semibold">-</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 font-bold">
              <span className="text-sm">صافي التدفقات الاستثمارية</span>
              <span className="text-sm">0</span>
            </div>
          </div>

          {/* Financing Activities */}
          <div>
            <h4 className="font-bold text-sm mb-3 text-primary">ثالثاً: التدفقات من الأنشطة التمويلية</h4>
            <div className="space-y-2 mr-4">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-sm text-muted-foreground">قروض بنكية</span>
                <span className="text-sm font-semibold">-</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 font-bold">
              <span className="text-sm">صافي التدفقات التمويلية</span>
              <span className="text-sm">0</span>
            </div>
          </div>

          {/* Net */}
          <div className="border-t-2 border-primary/30 pt-3">
            <div className="flex justify-between font-bold">
              <span className="text-base">صافي التغير في النقدية</span>
              <span className={`text-base ${netCashFlow >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {netCashFlow < 0 ? `(${Math.abs(netCashFlow).toLocaleString()})` : netCashFlow.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Dirty State Context ───────────────────────────────────────────────────────
const DirtyCtx = createContext<{
  isDirty: boolean;
  setDirty: (v: boolean) => void;
  registerSave: (fn: (() => Promise<boolean>) | null) => void;
  confirmIfDirty: (action: () => void) => void;
}>({ isDirty: false, setDirty: () => {}, registerSave: () => {}, confirmIfDirty: a => a() });

// ─── Content Router ────────────────────────────────────────────────────────────
function AccountingContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [ledgerCtx, setLedgerCtx] = useState<{ accountId: number; fromDate: string; toDate: string } | null>(null);
  const { setDirty, registerSave } = useContext(DirtyCtx);

  useEffect(() => {
    setDirty(false);
    registerSave(null);
  }, [activeId]);

  switch (activeId) {
    case "overview":           return <AccountingOverview onSelect={onSelect} />;
    case "journal-list":       return <JournalListPage onOpenEntry={() => {}} />;
    case "receipt-voucher":    return <ReceiptVoucherPage />;
    case "payment-voucher":    return <PaymentVoucherPage />;
    case "new-journal":        return <JournalEntryPage voucherType="journal" onNavigateTo={onSelect} />;
    case "opening-entry":      return <JournalEntryPage voucherType="opening" onNavigateTo={onSelect} />;
    case "accounts-tree":      return <ChartOfAccountsPage />;
    case "account-ledger":     return (
      <AccountLedgerPage
        initialAccountId={ledgerCtx?.accountId}
        initialFromDate={ledgerCtx?.fromDate}
        initialToDate={ledgerCtx?.toDate}
      />
    );
    case "cost-centers-list":  return <CostCentersPage />;
    case "cost-allocation":    return <CostAllocationPage />;
    case "trial-balance":      return (
      <TrialBalancePage
        onDrillDown={(id, fd, td) => {
          setLedgerCtx({ accountId: id, fromDate: fd, toDate: td });
          onSelect("account-ledger");
        }}
      />
    );
    case "income-statement":   return <IncomeStatementPage />;
    case "balance-sheet":      return <BalanceSheetPage />;
    case "cash-flow":          return <CashFlowPage />;
    default:                   return <AccountingOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function AccountingModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");

  // ── Dirty guard state ──────────────────────────────────────────────────────
  const [isDirty,      setIsDirtyState] = useState(false);
  const [showDirtyDlg, setShowDirtyDlg] = useState(false);
  const isDirtyRef       = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const saveFnRef        = useRef<(() => Promise<boolean>) | null>(null);

  const setDirty = useCallback((v: boolean) => {
    isDirtyRef.current = v;
    setIsDirtyState(v);
  }, []);

  const registerSave = useCallback((fn: (() => Promise<boolean>) | null) => {
    saveFnRef.current = fn;
  }, []);

  const confirmIfDirty = useCallback((action: () => void) => {
    if (!isDirtyRef.current) { action(); return; }
    pendingActionRef.current = action;
    setShowDirtyDlg(true);
  }, []);

  const navigate = useCallback((id: MenuId) => confirmIfDirty(() => setActiveId(id)), [confirmIfDirty]);

  const ctxVal = useMemo(() => ({ isDirty, setDirty, registerSave, confirmIfDirty }), [isDirty, setDirty, registerSave, confirmIfDirty]);

  const executePending = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDirty(false);
    setShowDirtyDlg(false);
    action?.();
  };

  return (
    <DirtyCtx.Provider value={ctxVal}>
      <div className="flex h-full" dir="rtl">
        <AccountingMenu activeId={activeId} onSelect={navigate} />
        <div className="flex-1 overflow-auto p-5">
          <AccountingContent activeId={activeId} onSelect={navigate} />
        </div>
      </div>

      {/* ── Unsaved Changes Dialog ── */}
      <Dialog open={showDirtyDlg} onOpenChange={open => { if (!open) { setShowDirtyDlg(false); pendingActionRef.current = null; } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              تغييرات غير محفوظة
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            يوجد تغييرات غير محفوظة، هل تريد حفظها؟
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              size="sm" className="h-8 text-xs gap-1"
              onClick={async () => {
                if (saveFnRef.current) {
                  const ok = await saveFnRef.current();
                  if (!ok) return;
                }
                executePending();
              }}
            >
              <Save className="w-3 h-3" /> نعم — احفظ وتابع
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 text-xs"
              onClick={executePending}
            >
              لا — تجاهل التعديلات
            </Button>
            <Button
              size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => { setShowDirtyDlg(false); pendingActionRef.current = null; }}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DirtyCtx.Provider>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function AccSubPage({ activeId }: { activeId: string }) {
  return <div className="h-full overflow-auto p-5" dir="rtl"><AccountingContent activeId={activeId} onSelect={() => {}} /></div>;
}
export function AccJournalTab()         { return <AccSubPage activeId="journal-list" />; }
export function AccReceiptTab()         { return <AccSubPage activeId="receipt-voucher" />; }
export function AccPaymentTab()         { return <AccSubPage activeId="payment-voucher" />; }
export function AccNewJournalTab()      { return <AccSubPage activeId="new-journal" />; }
export function AccOpeningTab()         { return <AccSubPage activeId="opening-entry" />; }
export function AccAccountsTab()        { return <AccSubPage activeId="accounts-tree" />; }
export function AccLedgerTab()          { return <AccSubPage activeId="account-ledger" />; }
export function AccCostCentersTab()     { return <AccSubPage activeId="cost-centers-list" />; }
export function AccCostAllocationTab()  { return <AccSubPage activeId="cost-allocation" />; }
export function AccTrialBalanceTab()    { return <AccSubPage activeId="trial-balance" />; }
export function AccIncomeTab()          { return <AccSubPage activeId="income-statement" />; }
export function AccBalanceSheetTab()    { return <AccSubPage activeId="balance-sheet" />; }
export function AccCashFlowTab()        { return <AccSubPage activeId="cash-flow" />; }
