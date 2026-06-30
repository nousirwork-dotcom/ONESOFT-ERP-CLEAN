import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { fmtDate } from "@/shared/utils/dateUtils";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { Textarea } from "@/core/ui/textarea";
import { toast } from "sonner";
import {
  Tag, Plus, Trash2, Search, Eye, Printer, ChevronRight,
  ChevronFirst, ChevronLast, ChevronLeft, Save, FileText,
  CheckCircle, XCircle, Clock, RotateCcw, Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuoteLine {
  id: string;
  productCode: string;
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  discountAmt: string;
  taxPct: string;
  taxAmt: string;
  total: string;
  productId?: number;
}

type ViewMode = "list" | "new" | "view";

const EMPTY_LINE = (): QuoteLine => ({
  id: crypto.randomUUID(),
  productCode: "",
  productName: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
  discountPct: "0",
  discountAmt: "0",
  taxPct: "0",
  taxAmt: "0",
  total: "0",
});

const COL_FIELDS: (keyof QuoteLine)[] = [
  "productCode", "productName", "quantity", "unit", "unitPrice",
  "discountPct", "discountAmt", "taxPct", "taxAmt",
];

function calcLineTotal(line: QuoteLine): string {
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.unitPrice) || 0;
  const discPct = parseFloat(line.discountPct) || 0;
  const taxPct = parseFloat(line.taxPct) || 0;
  const base = qty * price;
  const discAmt = base * (discPct / 100);
  const afterDisc = base - discAmt;
  const taxAmt = afterDisc * (taxPct / 100);
  return (afterDisc + taxAmt).toFixed(3);
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: "مسودة",   color: "bg-gray-100 text-gray-600 border-gray-200",        icon: Clock },
  confirmed: { label: "مرسل",    color: "bg-blue-100 text-blue-700 border-blue-200",         icon: CheckCircle },
  cancelled: { label: "ملغي",    color: "bg-red-100 text-red-700 border-red-200",            icon: XCircle },
  paid:      { label: "معتمد",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
};

// ─── List View ────────────────────────────────────────────────────────────────
function QuotationList({
  onNew, onView,
}: {
  onNew: () => void;
  onView: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: quotations = [], isLoading, refetch } = trpc.salesInvoices.list.useQuery({
    invoiceType: "quote",
    limit: 100,
  });

  const deleteMutation = trpc.salesInvoices.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف عرض السعر"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (quotations as any[]).filter(q =>
    !search ||
    q.invoiceNumber?.includes(search) ||
    q.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: any) => Number(n || 0).toFixed(2);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-bold">عروض أسعار المبيعات</h2>
            <p className="text-xs text-muted-foreground">إدارة عروض الأسعار وتحويلها إلى فواتير</p>
          </div>
        </div>
        <Button onClick={onNew} className="gap-1.5 h-9 text-sm">
          <Plus className="w-4 h-4" /> عرض سعر جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي العروض",  value: (quotations as any[]).length,                                                  color: "text-primary",       bg: "bg-primary/5" },
          { label: "مسودة",          value: (quotations as any[]).filter((q: any) => q.status === "draft").length,     color: "text-gray-600",      bg: "bg-gray-50" },
          { label: "مرسلة",          value: (quotations as any[]).filter((q: any) => q.status === "confirmed").length,  color: "text-blue-600",      bg: "bg-blue-50" },
          { label: "معتمدة",         value: (quotations as any[]).filter((q: any) => q.status === "paid").length,      color: "text-emerald-600",   bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border border-border ${s.bg}`}>
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم العرض أو اسم العميل..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right text-xs">رقم العرض</TableHead>
              <TableHead className="text-right text-xs">التاريخ</TableHead>
              <TableHead className="text-right text-xs">العميل</TableHead>
              <TableHead className="text-right text-xs">الإجمالي</TableHead>
              <TableHead className="text-center text-xs">الحالة</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Tag className="w-12 h-12 mx-auto mb-3 opacity-10" />
                  <p className="font-medium">لا توجد عروض أسعار</p>
                  <p className="text-sm mt-1">ابدأ بإنشاء عرض سعر جديد</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((q: any) => {
                const st = STATUS_MAP[q.status] || STATUS_MAP.draft;
                const Icon = st.icon;
                return (
                  <TableRow key={q.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => onView(q.id)}>
                    <TableCell className="font-mono text-sm font-semibold text-primary">{q.invoiceNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(q.invoiceDate)}
                    </TableCell>
                    <TableCell className="text-sm">{q.customerName || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold">{fmt(q.total)} {q.currency}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.color}`}>
                        <Icon className="w-3 h-3" />
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onView(q.id)}>
                          <Eye className="w-3 h-3 ml-1" /> عرض
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("هل تريد حذف هذا العرض؟")) deleteMutation.mutate({ id: q.id });
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Form View (New / Edit) ───────────────────────────────────────────────────
function QuotationForm({
  existingId,
  onBack,
  onSaved,
}: {
  existingId?: number;
  onBack: () => void;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();

  // Header
  const [quoteNumber, setQuoteNumber]   = useState("");
  const [quoteDate, setQuoteDate]       = useState(() => new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil]     = useState("");
  const [customerId, setCustomerId]     = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [currency, setCurrency]         = useState("SAR");
  const [notes, setNotes]               = useState("");
  const [status, setStatus]             = useState<"draft" | "confirmed" | "cancelled" | "paid">("draft");

  // Lines
  const [lines, setLines]               = useState<QuoteLine[]>([EMPTY_LINE()]);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [copiedLine, setCopiedLine]     = useState<QuoteLine | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [searchForRow, setSearchForRow] = useState<number | null>(null);

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Queries
  const nextNum    = trpc.salesInvoices.nextNumber.useQuery({ prefix: "QT" });
  const customers  = trpc.customers.list.useQuery({});
  const productsQ  = trpc.products.list.useQuery({});
  const existing   = trpc.salesInvoices.get.useQuery({ id: existingId! }, { enabled: !!existingId });

  useEffect(() => {
    if (nextNum.data && !quoteNumber && !existingId) {
      setQuoteNumber(nextNum.data);
    }
  }, [nextNum.data]);

  useEffect(() => {
    if (existing.data && existingId) {
      const d = existing.data as any;
      setQuoteNumber(d.invoiceNumber || "");
      setQuoteDate(d.invoiceDate ? new Date(d.invoiceDate).toISOString().split("T")[0] : "");
      setCustomerId(d.customerId || null);
      setCustomerSearch(d.customerName || "");
      setCurrency(d.currency || "SAR");
      setNotes(d.notes || "");
      setStatus(d.status || "draft");
      if (d.items?.length) {
        setLines(d.items.map((it: any) => ({
          id: crypto.randomUUID(),
          productCode: it.productCode || "",
          productName: it.productName || "",
          quantity: it.quantity || "1",
          unit: it.unit || "",
          unitPrice: it.unitPrice || "",
          discountPct: it.discountPercent || "0",
          discountAmt: it.discountAmount || "0",
          taxPct: it.taxPercent || "0",
          taxAmt: it.taxAmount || "0",
          total: it.total || "0",
          productId: it.productId,
        })));
      }
    }
  }, [existing.data]);

  const createMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ عرض السعر بنجاح");
      utils.salesInvoices.list.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const updateMutation = trpc.salesInvoices.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث عرض السعر");
      utils.salesInvoices.list.invalidate();
      onSaved();
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  // Calculations
  const subtotal      = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  const totalDiscount = lines.reduce((s, l) => {
    const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
    return s + base * ((parseFloat(l.discountPct) || 0) / 100);
  }, 0);
  const totalTax = lines.reduce((s, l) => {
    const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
    const afterDisc = base - base * ((parseFloat(l.discountPct) || 0) / 100);
    return s + afterDisc * ((parseFloat(l.taxPct) || 0) / 100);
  }, 0);
  const netTotal = subtotal - totalDiscount + totalTax;

  // Line ops
  const updateLine = useCallback((idx: number, field: keyof QuoteLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      if (["discountPct", "quantity", "unitPrice"].includes(field)) {
        const qty = parseFloat(field === "quantity" ? value : line.quantity) || 0;
        const price = parseFloat(field === "unitPrice" ? value : line.unitPrice) || 0;
        const discPct = parseFloat(field === "discountPct" ? value : line.discountPct) || 0;
        line.discountAmt = (qty * price * discPct / 100).toFixed(3);
      }
      if (["taxPct", "quantity", "unitPrice", "discountPct"].includes(field)) {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.unitPrice) || 0;
        const discPct = parseFloat(line.discountPct) || 0;
        const taxPct = parseFloat(field === "taxPct" ? value : line.taxPct) || 0;
        const base = qty * price;
        const afterDisc = base - base * (discPct / 100);
        line.taxAmt = (afterDisc * taxPct / 100).toFixed(3);
      }
      line.total = calcLineTotal(line);
      updated[idx] = line;
      return updated;
    });
  }, []);

  const addLine = () => {
    setLines(prev => [...prev, EMPTY_LINE()]);
    setSelectedIdx(prev => prev + 1);
  };

  const deleteLine = (idx: number) => {
    setLines(prev => {
      if (prev.length === 1) return [EMPTY_LINE()];
      return prev.filter((_, i) => i !== idx);
    });
    setSelectedIdx(prev => Math.max(0, prev - 1));
  };

  // Keyboard nav
  const focusCell = (row: number, col: number) => {
    if (row < 0 || row >= lines.length) return;
    const field = COL_FIELDS[col];
    if (!field) return;
    const key = `${lines[row].id}-${field}`;
    setTimeout(() => cellRefs.current.get(key)?.focus(), 30);
  };

  const handleCellKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        if (colIdx > 0) focusCell(rowIdx, colIdx - 1);
        else if (rowIdx > 0) focusCell(rowIdx - 1, COL_FIELDS.length - 1);
      } else {
        if (colIdx < COL_FIELDS.length - 1) focusCell(rowIdx, colIdx + 1);
        else {
          if (rowIdx === lines.length - 1) addLine();
          setTimeout(() => focusCell(rowIdx + 1, 0), 50);
        }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (rowIdx === lines.length - 1) addLine();
      setTimeout(() => focusCell(rowIdx + 1, colIdx), 50);
    }
    if (e.key === "ArrowUp") { e.preventDefault(); focusCell(rowIdx - 1, colIdx); }
    if (e.key === "ArrowDown") { e.preventDefault(); focusCell(rowIdx + 1, colIdx); }
    if (e.ctrlKey && e.key === "c") { setCopiedLine({ ...lines[rowIdx] }); toast.info("تم نسخ السطر"); }
    if (e.ctrlKey && e.key === "v" && copiedLine) {
      setLines(prev => {
        const updated = [...prev];
        updated.splice(rowIdx + 1, 0, { ...copiedLine, id: crypto.randomUUID() });
        return updated;
      });
    }
    if (e.key === "Delete" && e.ctrlKey) deleteLine(rowIdx);
    if (e.key === "Insert") { addLine(); }
  };

  const pickProduct = (product: any, rowIdx: number) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[rowIdx] };
      line.productId = product.id;
      line.productCode = product.code || product.sku || "";
      line.productName = product.name;
      line.unitPrice = String(product.salePrice || 0);
      line.unit = product.unit || "";
      line.total = calcLineTotal({ ...line, unitPrice: String(product.salePrice || 0) });
      updated[rowIdx] = line;
      return updated;
    });
    setProductSearch("");
    setShowProdDropdown(false);
    setSearchForRow(null);
    setTimeout(() => focusCell(rowIdx, 2), 50);
  };

  const filteredCustomers = (customers.data as any[] || []).filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 8);

  const filteredProducts = (productsQ.data as any[] || []).filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code || "").includes(productSearch)
  ).slice(0, 10);

  const handleSave = (saveStatus: typeof status) => {
    const validLines = lines.filter(l => l.productName && parseFloat(l.unitPrice) > 0);
    if (validLines.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل بسعر");
      return;
    }
    const payload = {
      invoiceNumber: quoteNumber,
      invoiceType: "quote" as const,
      invoiceDate: quoteDate,
      customerId: customerId || undefined,
      customerName: customerSearch || undefined,
      currency,
      subtotal: subtotal.toFixed(3),
      discountAmount: totalDiscount.toFixed(3),
      taxAmount: totalTax.toFixed(3),
      total: netTotal.toFixed(3),
      paidAmount: "0",
      remainingAmount: netTotal.toFixed(3),
      status: saveStatus,
      notes,
      items: validLines.map((l, idx) => ({
        productId: l.productId,
        productCode: l.productCode || undefined,
        productName: l.productName,
        unit: l.unit || undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPct,
        discountAmount: l.discountAmt,
        taxPercent: l.taxPct,
        taxAmount: l.taxAmt,
        total: l.total,
        sortOrder: idx,
      })),
    };
    if (existingId) {
      updateMutation.mutate({ id: existingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 h-8 text-xs">
          <ChevronRight className="w-3.5 h-3.5" /> القائمة
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => toast.info("جاري الطباعة...")}>
          <Printer className="w-3.5 h-3.5" /> طباعة
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleSave("draft")} disabled={isBusy}>
          <Save className="w-3.5 h-3.5" /> حفظ مسودة
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handleSave("confirmed")} disabled={isBusy}>
          <CheckCircle className="w-3.5 h-3.5" /> إرسال العرض
        </Button>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">عرض سعر مبيعات</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_MAP[status]?.color}`}>
            {STATUS_MAP[status]?.label}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* رقم العرض */}
          <div>
            <Label className="text-xs text-muted-foreground">رقم العرض</Label>
            <Input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} className="h-8 text-sm font-mono" />
          </div>
          {/* التاريخ */}
          <div>
            <Label className="text-xs text-muted-foreground">تاريخ العرض</Label>
            <Input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} className="h-8 text-sm" />
          </div>
          {/* صلاحية حتى */}
          <div>
            <Label className="text-xs text-muted-foreground">صالح حتى</Label>
            <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-8 text-sm" />
          </div>
          {/* العملة */}
          <div>
            <Label className="text-xs text-muted-foreground">العملة</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                <SelectItem value="USD">دولار (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* العميل */}
          <div className="col-span-2 relative">
            <Label className="text-xs text-muted-foreground">العميل</Label>
            <Input
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerId(null); setShowCustDropdown(true); }}
              onFocus={() => setShowCustDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
              placeholder="اسم العميل أو رمزه..."
              className="h-8 text-sm"
            />
            {showCustDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 flex justify-between items-center border-b border-border/30 last:border-0"
                    onMouseDown={() => { setCustomerId(c.id); setCustomerSearch(c.name); setShowCustDropdown(false); }}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* ملاحظات */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground">ملاحظات</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات عرض السعر..." className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Product search bar */}
        <div className="p-2 border-b border-border bg-muted/20 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="relative flex-1">
            <Input
              placeholder="ابحث عن صنف لإضافته للسطر المحدد..."
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowProdDropdown(true); setSearchForRow(selectedIdx); }}
              onFocus={() => { setShowProdDropdown(true); setSearchForRow(selectedIdx); }}
              onBlur={() => setTimeout(() => setShowProdDropdown(false), 150)}
              className="h-7 text-xs"
            />
            {showProdDropdown && productSearch && filteredProducts.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                {filteredProducts.map((p: any) => (
                  <button
                    key={p.id}
                    className="w-full text-right px-3 py-2 text-xs hover:bg-accent/50 flex justify-between items-center border-b border-border/30 last:border-0"
                    onMouseDown={() => pickProduct(p, searchForRow ?? selectedIdx)}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-primary font-semibold">{Number(p.salePrice || 0).toFixed(2)} {currency}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={addLine}>
            <Plus className="w-3 h-3" /> سطر
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right px-2 py-2 w-6 font-medium text-muted-foreground">#</th>
                <th className="text-right px-2 py-2 w-24 font-medium text-muted-foreground">الرمز</th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground">اسم الصنف</th>
                <th className="text-right px-2 py-2 w-16 font-medium text-muted-foreground">الكمية</th>
                <th className="text-right px-2 py-2 w-16 font-medium text-muted-foreground">الوحدة</th>
                <th className="text-right px-2 py-2 w-20 font-medium text-muted-foreground">السعر</th>
                <th className="text-right px-2 py-2 w-16 font-medium text-muted-foreground">خصم%</th>
                <th className="text-right px-2 py-2 w-20 font-medium text-muted-foreground">خصم ر.س</th>
                <th className="text-right px-2 py-2 w-16 font-medium text-muted-foreground">ضريبة%</th>
                <th className="text-right px-2 py-2 w-20 font-medium text-muted-foreground">ضريبة ر.س</th>
                <th className="text-right px-2 py-2 w-24 font-medium text-muted-foreground">الإجمالي</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, rowIdx) => (
                <tr
                  key={line.id}
                  className={`border-b border-border/40 transition-colors ${selectedIdx === rowIdx ? "bg-primary/5" : "hover:bg-muted/20"}`}
                  onClick={() => setSelectedIdx(rowIdx)}
                >
                  <td className="px-2 py-1 text-muted-foreground text-center">{rowIdx + 1}</td>
                  {COL_FIELDS.map((field, colIdx) => (
                    <td key={field} className="px-1 py-0.5">
                      <input
                        ref={el => {
                          const key = `${line.id}-${field}`;
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                        value={(line as any)[field]}
                        onChange={e => updateLine(rowIdx, field, e.target.value)}
                        onFocus={() => setSelectedIdx(rowIdx)}
                        onKeyDown={e => handleCellKeyDown(e, rowIdx, colIdx)}
                        className="w-full h-6 px-1.5 bg-transparent border border-transparent focus:border-primary/50 focus:bg-background rounded text-xs outline-none transition-colors"
                        dir={field === "productName" || field === "unit" ? "rtl" : "ltr"}
                        readOnly={field === "discountAmt" || field === "taxAmt"}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-semibold text-primary">{Number(line.total).toFixed(2)}</td>
                  <td className="px-1 py-1">
                    <button onClick={() => deleteLine(rowIdx)} className="text-destructive/50 hover:text-destructive p-0.5 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-border p-4 flex justify-between items-start bg-muted/10">
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Tab/Enter للانتقال بين الخلايا • Ctrl+C/V لنسخ السطر • Ctrl+Delete لحذف السطر • Insert لإضافة سطر</p>
          </div>
          <div className="space-y-1.5 min-w-48 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="font-mono">{subtotal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">إجمالي الخصم</span>
              <span className="font-mono text-orange-500">- {totalDiscount.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">إجمالي الضريبة</span>
              <span className="font-mono">{totalTax.toFixed(3)}</span>
            </div>
            <div className="flex justify-between gap-8 border-t border-border pt-1.5">
              <span className="font-bold">الإجمالي النهائي</span>
              <span className="font-bold text-primary text-base font-mono">{netTotal.toFixed(3)} {currency}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function QuotationDetail({ id, onBack, onEdit }: { id: number; onBack: () => void; onEdit: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.salesInvoices.get.useQuery({ id });
  const convertMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: () => {
      toast.success("تم تحويل عرض السعر إلى فاتورة مبيعات بنجاح");
      utils.salesInvoices.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>;
  if (!data) return null;

  const q = data as any;
  const st = STATUS_MAP[q.status] || STATUS_MAP.draft;
  const Icon = st.icon;

  const convertToInvoice = () => {
    if (!confirm("هل تريد تحويل هذا العرض إلى فاتورة مبيعات؟")) return;
    convertMutation.mutate({
      invoiceNumber: q.invoiceNumber?.replace("QT-", "INV-") || "INV-0001",
      invoiceType: "sale",
      invoiceDate: new Date().toISOString().split("T")[0],
      customerId: q.customerId,
      customerName: q.customerName,
      currency: q.currency,
      subtotal: q.subtotal,
      discountAmount: q.discountAmount,
      taxAmount: q.taxAmount,
      total: q.total,
      paidAmount: "0",
      remainingAmount: q.total,
      status: "draft",
      notes: `محوّل من عرض سعر ${q.invoiceNumber}`,
      items: (q.items || []).map((it: any, idx: number) => ({
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent || "0",
        discountAmount: it.discountAmount || "0",
        taxPercent: it.taxPercent || "0",
        taxAmount: it.taxAmount || "0",
        total: it.total,
        sortOrder: idx,
      })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 h-8 text-xs">
          <ChevronRight className="w-3.5 h-3.5" /> القائمة
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => toast.info("جاري الطباعة...")}>
          <Printer className="w-3.5 h-3.5" /> طباعة
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={onEdit}>
          <FileText className="w-3.5 h-3.5" /> تعديل
        </Button>
        {q.status !== "cancelled" && (
          <Button size="sm" className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={convertToInvoice} disabled={convertMutation.isPending}>
            <RotateCcw className="w-3.5 h-3.5" /> تحويل إلى فاتورة
          </Button>
        )}
      </div>

      {/* Header Card */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">رقم عرض السعر</p>
            <p className="text-2xl font-bold font-mono text-primary">{q.invoiceNumber}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium ${st.color}`}>
            <Icon className="w-4 h-4" />
            {st.label}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">التاريخ</p>
            <p className="font-medium">{fmtDate(q.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">العميل</p>
            <p className="font-medium">{q.customerName || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">العملة</p>
            <p className="font-medium">{q.currency}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الإجمالي</p>
            <p className="font-bold text-primary text-lg">{Number(q.total).toFixed(2)} {q.currency}</p>
          </div>
        </div>
        {q.notes && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
            <span className="font-medium text-foreground">ملاحظات: </span>{q.notes}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">أصناف عرض السعر</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="text-right text-xs">#</TableHead>
              <TableHead className="text-right text-xs">الصنف</TableHead>
              <TableHead className="text-right text-xs">الكمية</TableHead>
              <TableHead className="text-right text-xs">الوحدة</TableHead>
              <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
              <TableHead className="text-right text-xs">الخصم</TableHead>
              <TableHead className="text-right text-xs">الضريبة</TableHead>
              <TableHead className="text-right text-xs">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.items || []).map((it: any, i: number) => (
              <TableRow key={i} className="hover:bg-muted/10">
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="text-sm font-medium">{it.productName}</TableCell>
                <TableCell className="text-sm font-mono">{it.quantity}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{it.unit || "—"}</TableCell>
                <TableCell className="text-sm font-mono">{Number(it.unitPrice).toFixed(2)}</TableCell>
                <TableCell className="text-sm font-mono text-orange-500">{it.discountPercent}%</TableCell>
                <TableCell className="text-sm font-mono">{it.taxPercent}%</TableCell>
                <TableCell className="text-sm font-bold text-primary font-mono">{Number(it.total).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t border-border p-4 flex justify-end">
          <div className="space-y-1.5 min-w-48 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="font-mono">{Number(q.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">الخصم</span>
              <span className="font-mono text-orange-500">- {Number(q.discountAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">الضريبة</span>
              <span className="font-mono">{Number(q.taxAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-8 border-t border-border pt-2">
              <span className="font-bold">الإجمالي</span>
              <span className="font-bold text-primary font-mono">{Number(q.total || 0).toFixed(2)} {q.currency}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function SalesQuotation() {
  const [view, setView]       = useState<ViewMode>("list");
  const [viewId, setViewId]   = useState<number | null>(null);
  const [editId, setEditId]   = useState<number | null>(null);

  const goList = () => { setView("list"); setViewId(null); setEditId(null); };
  const goNew  = () => { setEditId(null); setView("new"); };
  const goView = (id: number) => { setViewId(id); setEditId(null); setView("view"); };
  const goEdit = () => { setEditId(viewId); setView("new"); };

  if (view === "new" || (view === "view" && editId)) {
    return (
      <QuotationForm
        existingId={editId || undefined}
        onBack={goList}
        onSaved={goList}
      />
    );
  }

  if (view === "view" && viewId) {
    return (
      <QuotationDetail
        id={viewId}
        onBack={goList}
        onEdit={goEdit}
      />
    );
  }

  return <QuotationList onNew={goNew} onView={goView} />;
}
