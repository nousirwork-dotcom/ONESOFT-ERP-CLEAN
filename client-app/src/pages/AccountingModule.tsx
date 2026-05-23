import { useState, useMemo, useRef, useCallback } from "react";
import { useTabManager } from "@/contexts/TabManagerContext";
import type { KeyboardEvent } from "react";
import {
  ChevronDown, ChevronRight, BookOpen, FileText, BarChart3,
  ClipboardList, Plus, Search, DollarSign, ArrowRight,
  TrendingUp, TrendingDown, Scale, Wallet, Building,
  Printer, Download, X, Check, RefreshCw, Edit2, Trash2,
  ArrowUpCircle, ArrowDownCircle, Upload, AlertCircle,
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
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function AccountingMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    journal: true, "chart-of-accounts": true, "cost-centers": true, "financial-reports": true,
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

// ─── Account Search Combobox ─────────────────────────────────────────────────
function AccountSearchCombobox({
  accounts,
  value,
  onChange,
}: {
  accounts: { id: number; code: string; name: string; allowPosting: boolean }[];
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return accounts.filter(a => a.allowPosting).slice(0, 50);
    const q = search.toLowerCase();
    return accounts.filter(a => a.allowPosting && (a.code.includes(q) || a.name.toLowerCase().includes(q))).slice(0, 50);
  }, [accounts, search]);
  const selected = accounts.find(a => a.id.toString() === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-7 text-xs w-full justify-between font-normal px-2">
          <span className="truncate">{selected ? `${selected.code} - ${selected.name}` : "اختر حساب..."}</span>
          <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="بحث بالكود أو الاسم..." value={search} onValueChange={setSearch} className="text-xs h-8" />
          <CommandList>
            <CommandEmpty className="text-xs py-3 text-center text-muted-foreground">لا توجد نتائج</CommandEmpty>
            <CommandGroup>
              {filtered.map(a => (
                <CommandItem key={a.id} value={`${a.code} ${a.name}`} onSelect={() => {
                  onChange(a.id.toString(), a.name);
                  setOpen(false);
                  setSearch("");
                }} className="text-xs cursor-pointer">
                  <span className="font-mono text-muted-foreground ml-2">{a.code}</span>
                  <span>{a.name}</span>
                  {value === a.id.toString() && <Check className="w-3 h-3 mr-auto text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Journal Entry (سند قيد) ──────────────────────────────────────────────────
function JournalEntryPage({ voucherType = "journal" }: { voucherType?: string }) {
  const accountsQuery = trpc.accounts.list.useQuery();
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const createMutation = trpc.journal.create.useMutation({
    onSuccess: () => { toast.success("تم حفظ القيد بنجاح"); handleNew(); },
    onError: (e) => toast.error(e.message),
  });

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [analyticCode, setAnalyticCode] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [selectedLineIdx, setSelectedLineIdx] = useState(0);
  const [copiedLine, setCopiedLine] = useState<typeof lines[0] | null>(null);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const emptyLine = () => ({ accountId: "", accountName: "", description: "", debit: "", credit: "", costCenterId: "", transferRelation: "", currency: "SAR" });
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const balanced = diff < 0.001 && totalDebit > 0;

  const updateLine = useCallback((i: number, field: string, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l)), []);

  const addLine = useCallback(() => {
    setLines(prev => [...prev, emptyLine()]);
  }, []);

  const handleNew = useCallback(() => {
    setLines([emptyLine(), emptyLine()]);
    setDescription("");
    setAnalyticCode("");
    setBasedOn("");
    setSelectedLineIdx(0);
  }, []);

  // أعمدة الجدول للتنقل بـ Tab
  // 0: accountName, 1: description, 2: debit, 3: credit, 4: transferRelation
  const JCOLS = 5;

  const handleCellKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    // Ctrl+C: نسخ السطر
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setCopiedLine({ ...lines[rowIdx] });
      toast.info(`تم نسخ السطر ${rowIdx + 1}`);
      return;
    }
    // Ctrl+V: لصق السطر
    if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      if (!copiedLine) { toast.warning("لا يوجد سطر منسوخ"); return; }
      setLines(prev => {
        const updated = [...prev];
        updated.splice(rowIdx + 1, 0, { ...copiedLine });
        return updated;
      });
      setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50);
      return;
    }
    // Ctrl+Delete: حذف السطر
    if (e.ctrlKey && e.key === "Delete") {
      e.preventDefault();
      if (lines.length > 2) {
        setLines(prev => prev.filter((_, i) => i !== rowIdx));
        setSelectedLineIdx(Math.max(0, rowIdx - 1));
      }
      return;
    }
    // Tab أو Enter
    if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < JCOLS) {
        cellRefs.current.get(`${rowIdx}-${nextCol}`)?.focus();
      } else {
        if (rowIdx + 1 < lines.length) {
          setSelectedLineIdx(rowIdx + 1);
          cellRefs.current.get(`${rowIdx + 1}-0`)?.focus();
        } else {
          addLine();
          setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50);
        }
      }
      return;
    }
    // Shift+Tab
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevCol = colIdx - 1;
      if (prevCol >= 0) {
        cellRefs.current.get(`${rowIdx}-${prevCol}`)?.focus();
      } else if (rowIdx > 0) {
        setSelectedLineIdx(rowIdx - 1);
        cellRefs.current.get(`${rowIdx - 1}-${JCOLS - 1}`)?.focus();
      }
    }
  }, [lines, copiedLine, addLine]);

  const titleMap: Record<string, string> = {
    journal: "سند قيد", opening: "سند قيد افتتاحي", receipt: "سند قبض", payment: "سند صرف",
  };

  const handleSave = () => {
    if (!balanced) return toast.error("القيد غير متوازن");
    const entryNumber = `${voucherType.toUpperCase()}-${Date.now()}`;
    createMutation.mutate({
      entry: {
        entryNumber,
        entryDate: new Date(entryDate),
        voucherType: voucherType as any,
        description,
        analyticCode,
        basedOn,
        totalDebit: totalDebit.toFixed(3),
        totalCredit: totalCredit.toFixed(3),
      },
      lines: lines
        .filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map((l, i) => ({
          lineNumber: i + 1,
          accountId: parseInt(l.accountId),
          accountName: l.accountName,
          description: l.description,
          debit: l.debit || "0",
          credit: l.credit || "0",
          currency: l.currency || "SAR",
          exchangeRate: "1",
          costCenterId: l.costCenterId ? parseInt(l.costCenterId) : undefined,
          transferRelation: l.transferRelation,
        })),
    });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          {titleMap[voucherType] ?? "سند قيد"}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleNew}><RefreshCw className="w-3 h-3" /> جديد</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Printer className="w-3 h-3" /> طباعة</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="w-3 h-3" /> تصدير</Button>
        </div>
      </div>

      {/* Header Fields */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <Label className="text-xs text-muted-foreground">قيد #</Label>
              <Input value={`${voucherType.toUpperCase()}-AUTO`} readOnly className="h-7 text-xs bg-muted/30" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">نوع السند</Label>
              <Input value={titleMap[voucherType] ?? "سند قيد"} readOnly className="h-7 text-xs bg-muted/30" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">تاريخ التحرير</Label>
              <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">بناء على</Label>
              <Input value={basedOn} onChange={e => setBasedOn(e.target.value)} className="h-7 text-xs" placeholder="رقم المستند..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">شرح</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="h-7 text-xs" placeholder="وصف القيد..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">الكود التحليلي</Label>
              <Input value={analyticCode} onChange={e => setAnalyticCode(e.target.value)} className="h-7 text-xs" placeholder="كود تحليلي..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines Table */}
      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-8 text-center">#</TableHead>
                <TableHead className="text-xs w-40">كود الحساب</TableHead>
                <TableHead className="text-xs">اسم الحساب</TableHead>
                <TableHead className="text-xs">شرح</TableHead>
                <TableHead className="text-xs text-center w-28">مدين</TableHead>
                <TableHead className="text-xs text-center w-28">دائن</TableHead>
                <TableHead className="text-xs w-24">عملة</TableHead>
                <TableHead className="text-xs w-28">مركز التكلفة</TableHead>
                <TableHead className="text-xs w-28">علاقة التحويل</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}
                  className={`${selectedLineIdx === i ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/10"}`}
                  onClick={() => setSelectedLineIdx(i)}
                >
                  <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="min-w-[160px]">
                    <AccountSearchCombobox
                      accounts={accountsQuery.data ?? []}
                      value={line.accountId}
                      onChange={(id, name) => {
                        updateLine(i, "accountId", id);
                        updateLine(i, "accountName", name);
                        // انتقل لحقل الاسم بعد الاختيار
                        setTimeout(() => cellRefs.current.get(`${i}-0`)?.focus(), 50);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={el => { if (el) cellRefs.current.set(`${i}-0`, el); }}
                      value={line.accountName}
                      onChange={e => updateLine(i, "accountName", e.target.value)}
                      onFocus={() => setSelectedLineIdx(i)}
                      onKeyDown={e => handleCellKeyDown(e, i, 0)}
                      className="h-7 text-xs" placeholder="اسم الحساب..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={el => { if (el) cellRefs.current.set(`${i}-1`, el); }}
                      value={line.description}
                      onChange={e => updateLine(i, "description", e.target.value)}
                      onFocus={() => setSelectedLineIdx(i)}
                      onKeyDown={e => handleCellKeyDown(e, i, 1)}
                      className="h-7 text-xs" placeholder="البيان..."
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={el => { if (el) cellRefs.current.set(`${i}-2`, el); }}
                      type="number" value={line.debit} min={0}
                      onChange={e => { updateLine(i, "debit", e.target.value); if (e.target.value) updateLine(i, "credit", ""); }}
                      onFocus={e => { setSelectedLineIdx(i); e.target.select(); }}
                      onKeyDown={e => handleCellKeyDown(e, i, 2)}
                      className="h-7 text-xs text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={el => { if (el) cellRefs.current.set(`${i}-3`, el); }}
                      type="number" value={line.credit} min={0}
                      onChange={e => { updateLine(i, "credit", e.target.value); if (e.target.value) updateLine(i, "debit", ""); }}
                      onFocus={e => { setSelectedLineIdx(i); e.target.select(); }}
                      onKeyDown={e => handleCellKeyDown(e, i, 3)}
                      className="h-7 text-xs text-center"
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
                      ref={el => { if (el) cellRefs.current.set(`${i}-4`, el); }}
                      value={line.transferRelation}
                      onChange={e => updateLine(i, "transferRelation", e.target.value)}
                      onFocus={() => setSelectedLineIdx(i)}
                      onKeyDown={e => handleCellKeyDown(e, i, 4)}
                      className="h-7 text-xs" placeholder="علاقة..."
                    />
                  </TableCell>
                  <TableCell>
                    {lines.length > 2 && (
                      <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-destructive hover:text-destructive/70 text-xs p-1"><X className="w-3 h-3" /></button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell colSpan={4} className="text-xs font-bold text-right">الإجمالي</TableCell>
                <TableCell className="text-center text-sm font-bold text-primary">{totalDebit.toFixed(3)}</TableCell>
                <TableCell className="text-center text-sm font-bold text-primary">{totalCredit.toFixed(3)}</TableCell>
                <TableCell colSpan={4}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="p-3 flex items-center justify-between border-t border-border bg-muted/10">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
              <Plus className="w-3 h-3" /> إضافة سطر
            </Button>
            <span className="text-[10px] text-muted-foreground">Tab/Enter: التالي | Ctrl+C: نسخ | Ctrl+V: لصق | Ctrl+Del: حذف</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs">
              <span className="text-muted-foreground ml-1">إجمالي مدين:</span>
              <span className="font-bold text-primary">{totalDebit.toFixed(3)}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground ml-1">الفرق:</span>
              <span className={`font-bold ${diff < 0.001 ? "text-emerald-500" : "text-destructive"}`}>{diff.toFixed(3)}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground ml-1">إجمالي دائن:</span>
              <span className="font-bold text-primary">{totalCredit.toFixed(3)}</span>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1" disabled={!balanced || createMutation.isPending}
              onClick={handleSave}>
              <Check className="w-3 h-3" /> حفظ القيد
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Receipt Voucher (سند قبض) ────────────────────────────────────────────────
function ReceiptVoucherPage() {
  const accountsQuery = trpc.accounts.list.useQuery();
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const listQuery = trpc.receiptVouchers.list.useQuery();
  const createMutation = trpc.receiptVouchers.create.useMutation({
    onSuccess: () => { toast.success("تم حفظ سند القبض"); listQuery.refetch(); setShowForm(false); },
    onError: (e) => toast.error(e.message),
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
      <Dialog open={showForm} onOpenChange={setShowForm}>
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
                <Input type="date" value={form.voucherDate} onChange={e => setF("voucherDate", e.target.value)} className="h-8 text-xs" />
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
  const accountsQuery = trpc.accounts.list.useQuery();
  const listQuery = trpc.paymentVouchers.list.useQuery();
  const createMutation = trpc.paymentVouchers.create.useMutation({
    onSuccess: () => { toast.success("تم حفظ سند الصرف"); listQuery.refetch(); setShowForm(false); },
    onError: (e) => toast.error(e.message),
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
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
                <Input type="date" value={form.voucherDate} onChange={e => setF("voucherDate", e.target.value)} className="h-8 text-xs" />
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

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> شجرة الحسابات
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pr-7 w-48" placeholder="بحث بالكود أو الاسم..." />
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowImport(true)}>
            <Upload className="w-3 h-3" /> استيراد
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3" /> إضافة حساب
          </Button>
        </div>
      </div>

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
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: a.id })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-xl shadow-2xl" dir="rtl">

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
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-slate-50 h-9 px-4 gap-1">
              <TabsTrigger value="main" className="text-xs h-7 rounded px-4 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <FileText className="w-3 h-3" /> البيانات الرئيسية
              </TabsTrigger>
              <TabsTrigger value="balances" className="text-xs h-7 rounded px-4 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                <Scale className="w-3 h-3" /> الأرصدة الافتتاحية
              </TabsTrigger>
            </TabsList>

            {/* ══ Tab 1: البيانات الرئيسية ══ */}
            <TabsContent value="main" className="mt-0 p-5 space-y-5">

              {/* ── قسم: بيانات الحساب الأساسية ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-blue-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">بيانات الحساب الأساسية</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* كود الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">كود الحساب <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.code} onChange={e => setF("code", e.target.value)}
                      className={`h-8 text-sm font-mono bg-blue-50/60 border-blue-200 focus:border-blue-500 focus:bg-white ${formErrors.code ? "border-red-400 bg-red-50" : ""}`}
                      placeholder="مثال: 1101" dir="ltr" />
                    {formErrors.code && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.code}</p>}
                  </div>
                  {/* نوع الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">نوع الحساب <span className="text-red-500">*</span></Label>
                    <div className="grid grid-cols-3 gap-1 h-8">
                      {([["root","جذري","bg-purple-100 border-purple-400 text-purple-800"],["general","عام","bg-amber-100 border-amber-400 text-amber-800"],["sub","فرعي","bg-emerald-100 border-emerald-400 text-emerald-800"]] as const).map(([val, lbl, cls]) => (
                        <button key={val} type="button"
                          onClick={() => setF("accountLevelType", val)}
                          className={`h-8 rounded text-[11px] font-semibold border-2 transition-all ${form.accountLevelType === val ? cls + " ring-2 ring-offset-1 ring-current" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* اسم 1 */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">اسم الحساب (عربي) <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.name} onChange={e => setF("name", e.target.value)}
                      className={`h-8 text-xs ${formErrors.name ? "border-red-400 bg-red-50" : ""}`}
                      placeholder="اسم الحساب بالعربي" />
                    {formErrors.name && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.name}</p>}
                  </div>
                  {/* اسم 2 */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">اسم الحساب (إنجليزي)</Label>
                    <Input
                      value={form.nameEn} onChange={e => setF("nameEn", e.target.value)}
                      className="h-8 text-xs" placeholder="Account name in English" dir="ltr" />
                  </div>
                  {/* الحساب الأب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">
                      الحساب الأب {form.accountLevelType !== "root" && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={form.parentId || "none"}
                      onValueChange={v => setF("parentId", v === "none" ? "" : v)}
                      disabled={form.accountLevelType === "root"}>
                      <SelectTrigger className={`h-8 text-xs ${form.accountLevelType === "root" ? "opacity-50 bg-slate-50" : ""} ${formErrors.parentId ? "border-red-400 bg-red-50" : ""}`}>
                        <SelectValue placeholder="اختر الحساب الأب..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— بدون حساب أب —</SelectItem>
                        {listQuery.data?.filter(a => a.isParent || a.accountType).map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            <span className="font-mono text-[10px] text-muted-foreground ml-1">{a.code}</span> {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.accountLevelType === "root" && <p className="text-[10px] text-purple-600">الحساب الجذري لا يحتاج حساباً أباً</p>}
                    {formErrors.parentId && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{formErrors.parentId}</p>}
                  </div>
                  {/* المستوى (auto) */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">المستوى (تلقائي)</Label>
                    <div className="h-8 rounded border border-slate-200 bg-slate-50 px-3 flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-700">{computedLevel}</span>
                      <span className="text-xs text-slate-400">
                        {computedLevel === 1 ? "المستوى الأول" : computedLevel === 2 ? "المستوى الثاني" : computedLevel === 3 ? "المستوى الثالث" : `المستوى ${computedLevel}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── قسم: الخصائص والإعدادات ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">الخصائص والإعدادات</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* طبيعة الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">طبيعة الحساب</Label>
                    <div className="grid grid-cols-2 gap-1 h-8">
                      {([["debit","مدين","bg-blue-100 border-blue-400 text-blue-800"],["credit","دائن","bg-rose-100 border-rose-400 text-rose-800"]] as const).map(([val,lbl,cls]) => (
                        <button key={val} type="button"
                          onClick={() => setF("nature", val)}
                          className={`h-8 rounded text-[11px] font-semibold border-2 transition-all ${form.nature === val ? cls + " ring-2 ring-offset-1 ring-current" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* نوع الحساب المالي */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">التصنيف المالي</Label>
                    <Select value={form.accountType} onValueChange={v => setF("accountType", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
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
                    <Label className="text-[11px] font-semibold text-slate-600">مركز التكلفة</Label>
                    <Select value={form.costCenterType} onValueChange={v => setF("costCenterType", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_allowed">غير مسموح</SelectItem>
                        <SelectItem value="optional">اختياري</SelectItem>
                        <SelectItem value="mandatory">إجباري</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.costCenterType === "mandatory" && (
                      <p className="text-[10px] text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />يجب تحديد مركز تكلفة عند الترحيل</p>
                    )}
                  </div>
                  {/* حالة الحساب */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">حالة الحساب</Label>
                    <div className="grid grid-cols-2 gap-1 h-8">
                      {([["active","نشط","bg-emerald-100 border-emerald-400 text-emerald-800"],["suspended","موقوف","bg-slate-100 border-slate-400 text-slate-600"]] as const).map(([val,lbl,cls]) => (
                        <button key={val} type="button"
                          onClick={() => setF("status", val)}
                          className={`h-8 rounded text-[11px] font-semibold border-2 transition-all ${form.status === val ? cls + " ring-2 ring-offset-1 ring-current" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* يقبل الحركات اليومية */}
                <div className={`mt-3 rounded-lg border-2 p-3 flex items-center gap-3 transition-all ${form.accountLevelType === "sub" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                  <input
                    id="allowPosting"
                    type="checkbox"
                    checked={form.allowPosting}
                    disabled={form.accountLevelType !== "sub"}
                    onChange={e => setF("allowPosting", e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                  <div>
                    <label htmlFor="allowPosting" className={`text-xs font-semibold cursor-pointer ${form.accountLevelType !== "sub" ? "text-slate-400" : "text-slate-700"}`}>
                      يقبل الحركات اليومية (القيود المحاسبية)
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {form.accountLevelType === "root" ? "الحساب الجذري لا يقبل حركات مباشرة" : form.accountLevelType === "general" ? "الحساب العام لا يقبل حركات مباشرة — يُستخدم للتجميع فقط" : "الحساب الفرعي يقبل تسجيل القيود اليومية"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ══ Tab 2: الأرصدة الافتتاحية ══ */}
            <TabsContent value="balances" className="mt-0 p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">الأرصدة الافتتاحية</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* رصيد مدين */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">الرصيد الافتتاحي مدين</Label>
                    <div className="relative">
                      <Input value={form.openingDebit} onChange={e => setF("openingDebit", e.target.value)}
                        type="number" min="0" step="0.001"
                        className="h-8 text-sm font-mono pe-10 border-blue-200 bg-blue-50/40 focus:bg-white"
                        placeholder="0.000" dir="ltr" />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-500">مدين</span>
                    </div>
                  </div>
                  {/* رصيد دائن */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">الرصيد الافتتاحي دائن</Label>
                    <div className="relative">
                      <Input value={form.openingCredit} onChange={e => setF("openingCredit", e.target.value)}
                        type="number" min="0" step="0.001"
                        className="h-8 text-sm font-mono pe-10 border-rose-200 bg-rose-50/40 focus:bg-white"
                        placeholder="0.000" dir="ltr" />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-500">دائن</span>
                    </div>
                  </div>
                  {/* تاريخ الرصيد */}
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">تاريخ الرصيد الافتتاحي</Label>
                    <Input value={form.openingDate} onChange={e => setF("openingDate", e.target.value)}
                      type="date" className="h-8 text-xs" dir="ltr" />
                  </div>
                  {/* مركز تكلفة الرصيد */}
                  {form.costCenterType !== "not_allowed" && (
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">
                        مركز تكلفة الرصيد {form.costCenterType === "mandatory" && <span className="text-red-500">*</span>}
                      </Label>
                      <Input value={form.openingCostCenter} onChange={e => setF("openingCostCenter", e.target.value)}
                        className="h-8 text-xs" placeholder="كود مركز التكلفة" />
                    </div>
                  )}
                </div>

                {/* ملخص الرصيد */}
                {(parseFloat(form.openingDebit || "0") > 0 || parseFloat(form.openingCredit || "0") > 0) && (
                  <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">إجمالي مدين:</span>
                      <span className="font-bold text-blue-700">{parseFloat(form.openingDebit || "0").toLocaleString("ar-SA", { minimumFractionDigits: 3 })} ر.س</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-500">إجمالي دائن:</span>
                      <span className="font-bold text-rose-600">{parseFloat(form.openingCredit || "0").toLocaleString("ar-SA", { minimumFractionDigits: 3 })} ر.س</span>
                    </div>
                    <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-xs">
                      <span className="text-slate-600 font-medium">الصافي:</span>
                      <span className={`font-bold ${parseFloat(form.openingDebit||"0") >= parseFloat(form.openingCredit||"0") ? "text-blue-700" : "text-rose-600"}`}>
                        {Math.abs(parseFloat(form.openingDebit||"0") - parseFloat(form.openingCredit||"0")).toLocaleString("ar-SA", { minimumFractionDigits: 3 })} ر.س
                        {" "}{parseFloat(form.openingDebit||"0") >= parseFloat(form.openingCredit||"0") ? "(مدين)" : "(دائن)"}
                      </span>
                    </div>
                  </div>
                )}

                {/* ملاحظات */}
                <div className="mt-4 space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-600">ملاحظات</Label>
                  <textarea value={form.notes} onChange={e => setF("notes", e.target.value)}
                    className="w-full h-20 text-xs rounded-lg border border-slate-200 px-3 py-2 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    placeholder="ملاحظات إضافية على الحساب..." dir="rtl" />
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
                    allowPosting: form.accountLevelType === "sub" && form.allowPosting,
                    openingBalance: form.openingDebit || form.openingCredit || undefined,
                    openingBalanceType: parseFloat(form.openingDebit || "0") >= parseFloat(form.openingCredit || "0") ? "debit" : "credit",
                    notes: form.notes || undefined,
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
    </div>
  );
}
// ─── Account Statement (كشف حساب أستاذ) ───────────────────────────────────────
function AccountLedgerPage() {
  const accountsQuery = trpc.accounts.list.useQuery();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const stmtQuery = trpc.accounting.accountStatement.useQuery(
    { accountId: accountId!, fromDate: fromDate ? new Date(fromDate) : undefined, toDate: toDate ? new Date(toDate) : undefined },
    { enabled: !!accountId }
  );

  const selectedAccount = accountsQuery.data?.find(a => a.id === accountId);
  let runningBalance = 0;
  const rows = stmtQuery.data?.map(l => {
    runningBalance += (parseFloat(l.debit ?? "0") - parseFloat(l.credit ?? "0"));
    return { ...l, runningBalance };
  }) ?? [];

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" /> كشف حساب أستاذ
      </h3>
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">الحساب</Label>
              <Select value={accountId?.toString() ?? ""} onValueChange={v => setAccountId(parseInt(v))}>
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
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8 text-xs w-full gap-1" onClick={() => stmtQuery.refetch()}>
                <Search className="w-3 h-3" /> عرض الكشف
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <Card className="border-border/60">
          <CardHeader className="pb-2 border-b border-border">
            <div className="text-center">
              <p className="font-bold text-sm">كشف حساب: {selectedAccount.code} - {selectedAccount.name}</p>
              {fromDate && toDate && <p className="text-xs text-muted-foreground">من {fromDate} إلى {toDate}</p>}
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
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">لا توجد حركات</TableCell></TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={i} className="hover:bg-muted/10">
                  <TableCell className="text-xs">{new Date(r.entryDate).toLocaleDateString("ar-SA")}</TableCell>
                  <TableCell className="text-xs font-mono text-primary">{r.entryNumber}</TableCell>
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
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-8 text-xs" />
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
function TrialBalancePage({ onOpenAccount }: { onOpenAccount?: (id: number) => void }) {
  const costCentersQuery = trpc.costCenters.list.useQuery();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [costCenterId, setCostCenterId] = useState<number | undefined>(undefined);

  const tbQuery = trpc.accounting.trialBalance.useQuery(
    { fromDate: fromDate ? new Date(fromDate) : undefined, toDate: toDate ? new Date(toDate) : undefined, costCenterId },
    { enabled: true }
  );

  const data = tbQuery.data ?? [];
  const totalOpeningDebit  = data.filter(r => r.openingBalanceType === "debit").reduce((s, r) => s + r.openingBalance, 0);
  const totalOpeningCredit = data.filter(r => r.openingBalanceType === "credit").reduce((s, r) => s + r.openingBalance, 0);
  const totalMoveDebit     = data.reduce((s, r) => s + r.movementDebit, 0);
  const totalMoveCredit    = data.reduce((s, r) => s + r.movementCredit, 0);
  const totalClosingDebit  = data.filter(r => r.closingBalanceType === "debit").reduce((s, r) => s + r.closingBalance, 0);
  const totalClosingCredit = data.filter(r => r.closingBalanceType === "credit").reduce((s, r) => s + r.closingBalance, 0);

  const fmt = (n: number) => n < 0 ? `(${Math.abs(n).toLocaleString()})` : n.toLocaleString();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> ميزان مراجعة الأستاذ العام
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Printer className="w-3 h-3" /> طباعة</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="w-3 h-3" /> تصدير</Button>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">مركز التكلفة</Label>
              <Select value={costCenterId?.toString() ?? "all"} onValueChange={v => setCostCenterId(v === "all" ? undefined : parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {costCentersQuery.data?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8 text-xs w-full gap-1" onClick={() => tbQuery.refetch()}>
                <RefreshCw className="w-3 h-3" /> تحديث
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-24">كود الحساب</TableHead>
                <TableHead className="text-xs">اسم الحساب</TableHead>
                <TableHead className="text-xs text-center" colSpan={2}>رصيد أول المدة</TableHead>
                <TableHead className="text-xs text-center" colSpan={2}>الحركة</TableHead>
                <TableHead className="text-xs text-center" colSpan={2}>رصيد آخر المدة</TableHead>
              </TableRow>
              <TableRow className="bg-muted/20">
                <TableHead className="text-xs"></TableHead>
                <TableHead className="text-xs"></TableHead>
                <TableHead className="text-xs text-center">مدين</TableHead>
                <TableHead className="text-xs text-center">دائن</TableHead>
                <TableHead className="text-xs text-center">مدين</TableHead>
                <TableHead className="text-xs text-center">دائن</TableHead>
                <TableHead className="text-xs text-center">مدين</TableHead>
                <TableHead className="text-xs text-center">دائن</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                  {tbQuery.isLoading ? "جاري التحميل..." : "لا توجد بيانات - أضف حسابات وقيود أولاً"}
                </TableCell></TableRow>
              )}
              {data.map(r => (
                <TableRow key={r.accountId} className="hover:bg-muted/10 cursor-pointer"
                  onClick={() => onOpenAccount?.(r.accountId)}>
                  <TableCell className="text-xs font-mono text-primary hover:underline">{r.code}</TableCell>
                  <TableCell className="text-xs hover:underline">{r.name}</TableCell>
                  <TableCell className={`text-center text-xs ${r.openingBalanceType === "debit" && r.openingBalance < 0 ? "text-destructive" : ""}`}>
                    {r.openingBalanceType === "debit" ? (r.openingBalance < 0 ? `(${Math.abs(r.openingBalance).toLocaleString()})` : r.openingBalance.toLocaleString()) : "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {r.openingBalanceType === "credit" ? r.openingBalance.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs">{r.movementDebit > 0 ? r.movementDebit.toLocaleString() : "-"}</TableCell>
                  <TableCell className="text-center text-xs">{r.movementCredit > 0 ? r.movementCredit.toLocaleString() : "-"}</TableCell>
                  <TableCell className={`text-center text-xs font-semibold ${r.closingBalanceType === "debit" ? "text-primary" : ""}`}>
                    {r.closingBalanceType === "debit" ? (r.closingBalance < 0 ? `(${Math.abs(r.closingBalance).toLocaleString()})` : r.closingBalance.toLocaleString()) : "-"}
                  </TableCell>
                  <TableCell className={`text-center text-xs font-semibold ${r.closingBalanceType === "credit" ? "text-amber-600" : ""}`}>
                    {r.closingBalanceType === "credit" ? r.closingBalance.toLocaleString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals */}
              <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                <TableCell colSpan={2} className="text-xs font-bold">الإجمالي</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalOpeningDebit.toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalOpeningCredit.toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalMoveDebit.toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalMoveCredit.toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalClosingDebit.toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{totalClosingCredit.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
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

// ─── Content Router ────────────────────────────────────────────────────────────
function AccountingContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":           return <AccountingOverview onSelect={onSelect} />;
    case "journal-list":       return <JournalListPage onOpenEntry={() => {}} />;
    case "receipt-voucher":    return <ReceiptVoucherPage />;
    case "payment-voucher":    return <PaymentVoucherPage />;
    case "new-journal":        return <JournalEntryPage voucherType="journal" />;
    case "opening-entry":      return <JournalEntryPage voucherType="opening" />;
    case "accounts-tree":      return <ChartOfAccountsPage />;
    case "account-ledger":     return <AccountLedgerPage />;
    case "cost-centers-list":  return <CostCentersPage />;
    case "cost-allocation":    return <CostAllocationPage />;
    case "trial-balance":      return <TrialBalancePage onOpenAccount={(id) => onSelect("account-ledger")} />;
    case "income-statement":   return <IncomeStatementPage />;
    case "balance-sheet":      return <BalanceSheetPage />;
    case "cash-flow":          return <CashFlowPage />;
    default:                   return <AccountingOverview onSelect={onSelect} />;
  }
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function AccountingModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <AccountingMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <AccountingContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
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
