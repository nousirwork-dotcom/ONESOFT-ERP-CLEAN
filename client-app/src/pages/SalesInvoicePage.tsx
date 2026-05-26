/**
 * SalesInvoicePage.tsx — فاتورة مبيعات احترافية
 * تصميم ERP كثيف (NamaSoft / Dynamics / Oracle Forms)
 * - ترقيم تسلسلي تلقائي: INV-YYYY-XXXXXX
 * - نوع السند: نقدًا / آجل مع حساب المدفوع والمتبقي
 * - حفظ كامل مع Validation وتوست احترافي
 * - تنقل Tab/Enter بين خلايا الجدول
 * - بحث الأصناف بالاسم أو الكود
 */
import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import ERPToolbar, { ERPMode } from "@/components/ERPToolbar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceLine {
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

type PaymentType = "cash" | "credit";

const EMPTY_LINE = (): InvoiceLine => ({
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

const COL_FIELDS: (keyof InvoiceLine)[] = [
  "productCode", "productName", "quantity", "unit", "unitPrice",
  "discountPct", "discountAmt", "taxPct", "taxAmt",
];

// ─── حساب إجمالي السطر ────────────────────────────────────────────────────────
function calcLineTotal(line: InvoiceLine): string {
  const qty = parseFloat(line.quantity) || 0;
  const price = parseFloat(line.unitPrice) || 0;
  const discPct = parseFloat(line.discountPct) || 0;
  const taxPct = parseFloat(line.taxPct) || 0;
  const base = qty * price;
  const afterDisc = base - base * (discPct / 100);
  return (afterDisc + afterDisc * (taxPct / 100)).toFixed(3);
}

function fmt(n: number) { return n.toFixed(3); }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesInvoicePage() {
  // ── Header state ─────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [journalWarehouseId, setJournalWarehouseId] = useState<number | null>(null); // مخزن مقيَّد من الدفتر
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [currency, setCurrency] = useState("SAR");
  const [exchangeRate, setExchangeRate] = useState("1.000");
  const [salesperson, setSalesperson] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAmountOverride, setPaidAmountOverride] = useState<string>("");

  // ── Lines state ───────────────────────────────────────────────────────────
  const [lines, setLines] = useState<InvoiceLine[]>([EMPTY_LINE()]);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [copiedLine, setCopiedLine] = useState<InvoiceLine | null>(null);

  // ── Document Journal ──────────────────────────────────────────────────────
  const [journalId, setJournalId] = useState<number | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);

  // ── ERP mode ──────────────────────────────────────────────────────────────
  const [erpMode, setErpMode] = useState<ERPMode>("new");

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── Queries ───────────────────────────────────────────────────────────────
  const customersQuery   = trpc.customers.list.useQuery({});
  const warehousesQuery  = trpc.warehouses.list.useQuery();
  const productsQuery    = trpc.products.list.useQuery({});
  const journalsQuery    = trpc.documentJournals.list.useQuery({ docType: "sales_invoice" });
  const nextNumberQuery  = trpc.salesInvoices.nextNumber.useQuery({ prefix: "INV" });

  const nextJournalNumberMutation = trpc.documentJournals.nextNumber.useMutation();
  const utils = trpc.useUtils();

  const createMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: (data) => {
      toast.success(`✓ تم حفظ الفاتورة ${data.invoiceNumber} بنجاح`, {
        description: `الإجمالي: ${fmt(netTotal)} ${currency}`,
        duration: 4000,
      });
      handleNew();
    },
    onError: (e) => toast.error(`خطأ في الحفظ: ${e.message}`),
  });

  // عند اختيار دفتر: اعرض الرقم المتوقع فقط (بدون حجزه في قاعدة البيانات)
  const handleJournalSelect = useCallback(async (id: number) => {
    setJournalId(id);
    setJournalOpen(false);
    const journals = journalsQuery.data ?? [];
    const j = journals.find((x: any) => x.id === id);
    if (j) {
      if (j.warehouseId) {
        setWarehouseId(j.warehouseId);
        setJournalWarehouseId(j.warehouseId); // قيِّد dropdown المخزن
      } else {
        setJournalWarehouseId(null); // أي مخزن مسموح
      }
      if (j.defaultCurrency) setCurrency(j.defaultCurrency);
      if (j.defaultPayMethod) setPaymentType(j.defaultPayMethod as any);
    }
    try {
      const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: id });
      if (preview) setInvoiceNumber(preview);
    } catch {
      toast.error("تعذّر جلب رقم الفاتورة من الدفتر");
    }
  }, [journalsQuery.data, utils]);


  // ── Calculations ──────────────────────────────────────────────────────────
  const subtotal = lines.reduce((s, l) => {
    return s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }, 0);

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

  // المدفوع والمتبقي بناءً على نوع السند
  const paidAmount = paymentType === "cash"
    ? netTotal
    : parseFloat(paidAmountOverride || "0");
  const remainingAmount = Math.max(0, netTotal - paidAmount);

  // ── Line Operations ───────────────────────────────────────────────────────
  const updateLine = useCallback((idx: number, field: keyof InvoiceLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      if (field === "discountPct" || field === "quantity" || field === "unitPrice") {
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

  const addLine = useCallback(() => {
    setLines(prev => [...prev, EMPTY_LINE()]);
    setSelectedLineIdx(prev => prev + 1);
  }, []);

  const deleteLine = useCallback((idx: number) => {
    setLines(prev => prev.length === 1 ? [EMPTY_LINE()] : prev.filter((_, i) => i !== idx));
    setSelectedLineIdx(prev => Math.max(0, prev - 1));
  }, []);

  // ── Product auto-fill ─────────────────────────────────────────────────────
  const handleProductCodeChange = useCallback((idx: number, code: string) => {
    updateLine(idx, "productCode", code);
    if (!code) return;
    const found = (productsQuery.data ?? []).find(
      p => p.sku === code || p.barcode === code || String(p.id) === code
    );
    if (found) {
      setLines(prev => {
        const updated = [...prev];
        const l = { ...updated[idx] };
        l.productCode = found.sku ?? found.barcode ?? code;
        l.productName = found.name;
        l.productId = found.id;
        l.unit = found.unit ?? "";
        l.unitPrice = found.salePrice ? String(found.salePrice) : "";
        l.taxPct = found.taxRate ? String(found.taxRate) : "0";
        l.total = calcLineTotal(l);
        updated[idx] = l;
        return updated;
      });
    }
  }, [productsQuery.data]);

  // ── Keyboard Navigation ───────────────────────────────────────────────────
  const handleCellKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    const totalCols = COL_FIELDS.length;
    const totalRows = lines.length;

    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setCopiedLine({ ...lines[rowIdx] });
      toast.info(`تم نسخ السطر ${rowIdx + 1}`);
      return;
    }
    if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      if (!copiedLine) { toast.warning("لا يوجد سطر منسوخ"); return; }
      setLines(prev => {
        const updated = [...prev];
        updated.splice(rowIdx + 1, 0, { ...copiedLine, id: crypto.randomUUID() });
        return updated;
      });
      setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50);
      return;
    }
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < totalCols) {
        cellRefs.current.get(`${rowIdx}-${nextCol}`)?.focus();
      } else {
        if (rowIdx + 1 < totalRows) {
          setSelectedLineIdx(rowIdx + 1);
          cellRefs.current.get(`${rowIdx + 1}-0`)?.focus();
        } else {
          addLine();
          setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50);
        }
      }
      return;
    }
    if (e.shiftKey && e.key === "Tab") {
      e.preventDefault();
      const prevCol = colIdx - 1;
      if (prevCol >= 0) cellRefs.current.get(`${rowIdx}-${prevCol}`)?.focus();
      else if (rowIdx > 0) cellRefs.current.get(`${rowIdx - 1}-${totalCols - 1}`)?.focus();
      return;
    }
    if (e.ctrlKey && e.key === "Delete") {
      e.preventDefault();
      deleteLine(rowIdx);
    }
  }, [lines, copiedLine, addLine, deleteLine]);

  // ── Validation & Save ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // Validation
    if (!invoiceNumber.trim()) {
      toast.error("رقم الفاتورة مطلوب");
      return;
    }
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل في الفاتورة");
      return;
    }
    for (const l of validLines) {
      if (!l.unitPrice || parseFloat(l.unitPrice) === 0) {
        toast.error(`سعر الصنف "${l.productName}" يجب أن يكون أكبر من صفر`);
        return;
      }
      if (!l.quantity || parseFloat(l.quantity) === 0) {
        toast.error(`كمية الصنف "${l.productName}" يجب أن تكون أكبر من صفر`);
        return;
      }
    }

    // احجز الرقم التسلسلي من الدفتر فقط عند الحفظ الفعلي
    let finalInvoiceNumber = invoiceNumber;
    if (journalId) {
      try {
        finalInvoiceNumber = await nextJournalNumberMutation.mutateAsync({ journalId });
        setInvoiceNumber(finalInvoiceNumber);
      } catch {
        toast.error("تعذّر حجز رقم الفاتورة من الدفتر");
        return;
      }
    }

    const paid = paymentType === "cash" ? fmt(netTotal) : fmt(paidAmount);
    const remaining = paymentType === "cash" ? "0.000" : fmt(remainingAmount);
    const payMethod = paymentType === "cash" ? "cash" : "credit";
    const status = paymentType === "cash" ? "paid" : (remainingAmount <= 0 ? "paid" : "confirmed");

    createMutation.mutate({
      invoiceNumber: finalInvoiceNumber,
      invoiceType: "sale",
      invoiceDate,
      dueDate: dueDate || undefined,
      customerId: customerId ?? undefined,
      customerName: customerName || undefined,
      warehouseId: warehouseId ?? undefined,
      currency,
      exchangeRate,
      subtotal: fmt(subtotal),
      discountAmount: fmt(totalDiscount),
      taxAmount: fmt(totalTax),
      total: fmt(netTotal),
      paidAmount: paid,
      remainingAmount: remaining,
      paymentMethod: payMethod as any,
      status: status as any,
      notes: notes || undefined,
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
    });
  }, [
    invoiceNumber, invoiceDate, dueDate, customerId, customerName,
    warehouseId, currency, exchangeRate, paymentType, paidAmount,
    remainingAmount, notes, lines, subtotal, totalDiscount, totalTax,
    netTotal, createMutation, journalId, nextJournalNumberMutation,
  ]);

  // ── New Invoice ───────────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setLines([EMPTY_LINE()]);
    setSelectedLineIdx(0);
    setCustomerId(null);
    setCustomerName("");
    setWarehouseId(null);
    setPaymentType("cash");
    setBasedOn("");
    setNotes("");
    setDueDate("");
    setSalesperson("");
    setPaidAmountOverride("");
    setErpMode("new");
    setJournalWarehouseId(null);
    // إذا كان هناك دفتر محدد، اعرض الرقم المتوقع — وإلا يبقى الحقل فارغاً
    if (journalId) {
      utils.documentJournals.previewNextNumber.fetch({ journalId }).then(preview => {
        if (preview) setInvoiceNumber(preview);
      }).catch(() => setInvoiceNumber(""));
    } else {
      setInvoiceNumber("");
    }
  }, [journalId, utils]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full text-[#1a1a1a] select-none"
      style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: "12px", background: "#ECE7DD" }}
      dir="rtl"
    >
      {/* ── ERP Toolbar ─────────────────────────────────────────────────── */}
      <ERPToolbar
        pageTitle="فواتير المبيعات"
        mode={erpMode}
        saveDisabled={createMutation.isPending}
        onNew={() => { handleNew(); setErpMode("new"); }}
        onSave={() => handleSave()}
        onEdit={() => { setErpMode("edit"); toast.info("وضع التعديل"); }}
        onDelete={() => toast.info("حذف الفاتورة...")}
        onSearch={() => { setErpMode("search"); toast.info("بحث..."); }}
        onRefresh={() => nextNumberQuery.refetch()}
        onCopy={() => copiedLine && toast.info("تم النسخ")}
        onPost={() => toast.info("جاري الترحيل...")}
        onApprove={() => toast.success("تم الاعتماد")}
        onCancel={() => { setErpMode("view"); toast.info("تم الإلغاء"); }}
        onPrint={() => toast.info("جاري الطباعة...")}
        onFirst={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onLast={() => {}}
        onClose={() => toast.info("إغلاق")}
        enableShortcuts
      />

      {/* ── Header Form ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#b0a89a] px-3 pt-2 pb-1.5" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>

        {/* ── رقم الفاتورة (بارز أعلى يمين) + حقول الصف الأول ── */}
        <div className="flex items-start gap-2 mb-1.5">
          {/* رقم الفاتورة — مدمج مع منتقي الدفتر */}
          {(() => {
            const journals = journalsQuery.data ?? [];
            const selected = journals.find((j: any) => j.id === journalId);
            // حساب الرقم التالي للعرض في القائمة (بدون استدعاء API)
            const previewNum = (j: any): string => {
              const seq = (j.currentSeq ?? 0) === 0
                ? (j.firstNumber ?? 1)
                : (j.currentSeq ?? 0) + (j.increment ?? 1);
              const digits = j.numDigits ?? 6;
              const padded = String(seq).padStart(digits, "0");
              const year = j.includeYear ? `-${new Date().getFullYear()}` : "";
              return `${j.numberPrefix}${year}-${padded}`;
            };
            return (
              <div className="flex flex-col gap-0.5 flex-shrink-0 relative" style={{ minWidth: 176 }}>
                {/* Label مع اسم الدفتر المختار */}
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-bold text-[#406B93] uppercase tracking-wide">رقم الفاتورة</label>
                  {selected && (
                    <span
                      className="text-[9px] px-1 py-0 rounded font-medium cursor-pointer"
                      style={{ background: "#dbeafe", color: "#1d4ed8", lineHeight: "14px" }}
                      onClick={() => { setJournalId(null); }}
                      title="إلغاء الدفتر"
                    >
                      {selected.name} ✕
                    </span>
                  )}
                </div>
                {/* حقل الرقم + زر السهم */}
                <div className="flex items-stretch">
                  <input
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    onContextMenu={e => { e.preventDefault(); setJournalOpen(o => !o); }}
                    onKeyDown={e => { if (e.key === "F4" || (e.key === "ArrowDown" && e.altKey)) { e.preventDefault(); setJournalOpen(o => !o); } }}
                    className="classic-input text-center font-bold"
                    style={{
                      width: 148, background: selected ? "#eff6ff" : "#FFFDE7",
                      borderColor: selected ? "#3b82f6" : "#F59E0B",
                      borderRadius: "4px 0 0 4px", borderLeft: "none",
                      color: "#1a1a1a", fontSize: "13px", fontWeight: 700,
                      letterSpacing: "0.03em",
                    }}
                    title="كليك يمين أو F4 لاختيار الدفتر"
                  />
                  <button
                    onClick={() => setJournalOpen(o => !o)}
                    className="flex items-center justify-center transition-colors"
                    style={{
                      width: 22, borderRadius: "0 4px 4px 0",
                      background: selected ? "#3b82f6" : "#F59E0B",
                      border: `1px solid ${selected ? "#2563eb" : "#d97706"}`,
                      color: "white", fontSize: "9px",
                    }}
                    title="اختيار الدفتر"
                  >▼</button>
                </div>
                {/* Dropdown قائمة الدفاتر */}
                {journalOpen && (
                  <>
                    {/* Overlay لإغلاق عند الضغط خارجاً */}
                    <div className="fixed inset-0 z-[9998]" onClick={() => setJournalOpen(false)} />
                    <div
                      className="absolute top-full right-0 z-[9999] mt-1 bg-white rounded-lg overflow-hidden"
                      style={{ minWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)", border: "1px solid #e2e8f0" }}
                      dir="rtl"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2" style={{ background: "#1e40af" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-[11px] font-bold">دفاتر فاتورة المبيعات</span>
                          {journals.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                              {journals.length}
                            </span>
                          )}
                        </div>
                        <button onClick={() => setJournalOpen(false)} style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>✕</button>
                      </div>
                      {/* الدفاتر */}
                      {journals.length === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <div className="text-[20px] mb-1">📒</div>
                          <div className="text-[11px] text-slate-500 font-medium">لا توجد دفاتر مُعرَّفة</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">أضف دفاتر من إعدادات المستندات</div>
                        </div>
                      ) : (
                        <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                          {journals.map((j: any, idx: number) => {
                            const isSelected = j.id === journalId;
                            const preview = previewNum(j);
                            return (
                              <button
                                key={j.id}
                                onClick={() => handleJournalSelect(j.id)}
                                className="w-full flex items-center gap-0 text-right transition-colors"
                                style={{
                                  background: isSelected ? "#eff6ff" : idx % 2 === 0 ? "#fafafa" : "white",
                                  borderBottom: "1px solid #f1f5f9",
                                  padding: "6px 12px",
                                }}
                              >
                                {/* أيقونة التحديد */}
                                <span style={{ width: 16, color: isSelected ? "#3b82f6" : "transparent", fontSize: "11px", flexShrink: 0 }}>✓</span>
                                {/* اسم الدفتر الكامل */}
                                <div className="flex-1 min-w-0 mx-2">
                                  <div className="text-[12px] font-semibold truncate" style={{ color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                                    فاتورة مبيعات – {j.name}
                                  </div>
                                  {j.description && (
                                    <div className="text-[10px] text-slate-400 truncate">{j.description}</div>
                                  )}
                                </div>
                                {/* معاينة الرقم التالي */}
                                <div className="shrink-0 text-left">
                                  <div className="font-mono text-[11px] font-bold px-2 py-0.5 rounded" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                                    {preview}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Footer */}
                      <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                        <span className="text-[9px] text-slate-400">كليك يمين أو F4 لفتح القائمة</span>
                        {journalId && (
                          <button
                            onClick={() => { setJournalId(null); setJournalOpen(false); }}
                            className="text-[9px] text-red-400 hover:text-red-600"
                          >إلغاء اختيار الدفتر</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Grid الحقول الرئيسية */}
          <div className="grid gap-x-2 gap-y-1 flex-1" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <HF label="العميل">
              <select
                value={customerId ?? ""}
                onChange={e => {
                  const id = parseInt(e.target.value);
                  setCustomerId(isNaN(id) ? null : id);
                  const c = customersQuery.data?.find(x => x.id === id);
                  setCustomerName(c?.name ?? "");
                }}
                className="classic-input w-full"
              >
                <option value="">-- اختر عميل --</option>
                {customersQuery.data?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </HF>
            <HF label="تاريخ التحرير">
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="classic-input w-full"
              />
            </HF>
            <HF label="تاريخ الدفع">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="classic-input w-full"
              />
            </HF>
            <HF label="المخزن">
              <select
                value={warehouseId ?? ""}
                onChange={e => !journalWarehouseId && setWarehouseId(parseInt(e.target.value) || null)}
                className="classic-input w-full"
                disabled={!!journalWarehouseId}
                title={journalWarehouseId ? "المخزن محدد من الدفتر ولا يمكن تغييره" : undefined}
              >
                <option value="">-- اختر مخزن --</option>
                {(journalWarehouseId
                  ? warehousesQuery.data?.filter(w => w.id === journalWarehouseId)
                  : warehousesQuery.data
                )?.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </HF>
            <HF label="البائع">
              <input
                value={salesperson}
                onChange={e => setSalesperson(e.target.value)}
                className="classic-input w-full"
              />
            </HF>
          </div>
        </div>

        {/* ── الصف الثاني ── */}
        <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: "150px 120px 90px 100px 1fr 1fr" }}>
          <HF label="نوع السند">
            <select
              value={paymentType}
              onChange={e => {
                setPaymentType(e.target.value as PaymentType);
                setPaidAmountOverride("");
              }}
              className="classic-input w-full"
              style={{
                background: paymentType === "cash" ? "#F0FDF4" : "#FFF7ED",
                borderColor: paymentType === "cash" ? "#16A34A" : "#D97706",
                fontWeight: 700,
                color: paymentType === "cash" ? "#15803D" : "#B45309",
              }}
            >
              <option value="cash">نقدًا</option>
              <option value="credit">آجل</option>
            </select>
          </HF>
          <HF label="العملة">
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="classic-input w-full"
            >
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="USD">دولار (USD)</option>
              <option value="EUR">يورو (EUR)</option>
              <option value="AED">درهم (AED)</option>
            </select>
          </HF>
          <HF label="سعر الصرف">
            <input
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              className="classic-input w-full text-center"
            />
          </HF>
          <HF label="بناءً على">
            <input
              value={basedOn}
              onChange={e => setBasedOn(e.target.value)}
              className="classic-input w-full"
            />
          </HF>
          <HF label="ملحوظة">
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="classic-input w-full"
            />
          </HF>
          <div />
        </div>
      </div>

      {/* ── Lines Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white border-b border-[#b0a89a]">
        <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "linear-gradient(to bottom, #406B93, #365E80)", color: "#fff" }}>
              <th className="inv-th w-8 text-center">#</th>
              <th className="inv-th w-24">رقم الصنف</th>
              <th className="inv-th">اسم الصنف</th>
              <th className="inv-th w-20 text-center">الكمية</th>
              <th className="inv-th w-20 text-center">الوحدة</th>
              <th className="inv-th w-24 text-center">السعر</th>
              <th className="inv-th w-14 text-center">خصم%</th>
              <th className="inv-th w-24 text-center">الخصم ﷼</th>
              <th className="inv-th w-14 text-center">ض%</th>
              <th className="inv-th w-24 text-center font-bold">الإجمالي</th>
              <th className="inv-th w-7"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, rowIdx) => (
              <tr
                key={line.id}
                className={`border-b border-[#e8e4dc] ${
                  selectedLineIdx === rowIdx
                    ? "bg-[#EEF4FA]"
                    : rowIdx % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]"
                }`}
                onClick={() => setSelectedLineIdx(rowIdx)}
              >
                <td className="inv-td text-center text-[#999] text-[11px]">{rowIdx + 1}</td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-0`, el); }}
                    value={line.productCode}
                    onChange={e => handleProductCodeChange(rowIdx, e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 0)}
                    className="inv-cell"
                    placeholder="كود..."
                  />
                </td>

                <td className="inv-td p-0">
                  <ProductNameCell
                    rowIdx={rowIdx}
                    value={line.productName}
                    products={productsQuery.data ?? []}
                    cellRefs={cellRefs}
                    onSelect={(name, code, id, unit, price, tax) => {
                      setLines(prev => {
                        const updated = [...prev];
                        const l = { ...updated[rowIdx], productName: name, productCode: code, productId: id, unit, unitPrice: price, taxPct: tax };
                        l.total = calcLineTotal(l);
                        updated[rowIdx] = l;
                        return updated;
                      });
                    }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 1)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-2`, el); }}
                    type="number"
                    value={line.quantity}
                    onChange={e => updateLine(rowIdx, "quantity", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 2)}
                    className="inv-cell text-center"
                    min="0"
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-3`, el); }}
                    value={line.unit}
                    onChange={e => updateLine(rowIdx, "unit", e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 3)}
                    className="inv-cell text-center"
                    placeholder="وحدة"
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-4`, el); }}
                    type="number"
                    value={line.unitPrice}
                    onChange={e => updateLine(rowIdx, "unitPrice", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 4)}
                    className="inv-cell text-center"
                    min="0"
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-5`, el); }}
                    type="number"
                    value={line.discountPct}
                    onChange={e => updateLine(rowIdx, "discountPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 5)}
                    className="inv-cell text-center"
                    min="0" max="100"
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-6`, el); }}
                    type="number"
                    value={line.discountAmt}
                    onChange={e => updateLine(rowIdx, "discountAmt", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 6)}
                    className="inv-cell text-center"
                    min="0"
                  />
                </td>

                <td className="inv-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-7`, el); }}
                    type="number"
                    value={line.taxPct}
                    onChange={e => updateLine(rowIdx, "taxPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 7)}
                    className="inv-cell text-center"
                    min="0" max="100"
                  />
                </td>

                <td className="inv-td text-center font-bold" style={{ color: "#003399", fontSize: "12px" }}>
                  {parseFloat(line.total).toFixed(3)}
                </td>

                <td className="inv-td text-center">
                  <button
                    onClick={() => deleteLine(rowIdx)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    title="حذف السطر (Ctrl+Del)"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-2 py-1.5 border-t border-[#e8e4dc]">
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-[11px] text-[#406B93] hover:text-[#2d4f6e] hover:underline transition-colors"
          >
            <Plus className="w-3 h-3" />
            إضافة سطر جديد
            <span className="text-[#aaa] mr-1">(Enter في آخر سطر)</span>
          </button>
        </div>
      </div>

      {/* ── Totals Bar ──────────────────────────────────────────────────── */}
      <div style={{ background: "#E8E4DC", borderTop: "1px solid #b0a89a" }}>
        <div className="flex items-center gap-0 px-3 py-1.5">
          {/* Left: totals summary */}
          <div className="flex items-center gap-3 flex-1">
            <TF label="إجمالي" value={fmt(subtotal)} />
            <span className="text-[#aaa]">−</span>
            <TF label="الخصم" value={fmt(totalDiscount)} color="#C0392B" />
            <span className="text-[#aaa]">+</span>
            <TF label="الضريبة" value={fmt(totalTax)} />
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: "#b0a89a", margin: "0 12px" }} />

          {/* Right: payment info */}
          <div className="flex items-center gap-3">
            <TF label="الصافي" value={fmt(netTotal)} highlight />

            {paymentType === "cash" ? (
              <>
                <TF label="مدفوع نقداً" value={fmt(netTotal)} color="#16A34A" />
                <TF label="المتبقي" value="0.000" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[#444] whitespace-nowrap">مدفوع:</span>
                  <input
                    type="number"
                    value={paidAmountOverride}
                    onChange={e => setPaidAmountOverride(e.target.value)}
                    placeholder="0.000"
                    className="classic-input text-center w-24"
                    style={{ background: "#FFF7ED", borderColor: "#D97706" }}
                    min="0"
                  />
                </div>
                <TF
                  label="المتبقي"
                  value={fmt(remainingAmount)}
                  color={remainingAmount > 0 ? "#C0392B" : "#16A34A"}
                />
              </>
            )}

            <div style={{ width: 1, height: 28, background: "#b0a89a", margin: "0 4px" }} />
            <TF label="الإجمالي الكلي" value={fmt(netTotal)} highlight big />
          </div>
        </div>

        {/* Status + Shortcuts row */}
        <div className="flex items-center justify-between px-3 py-0.5 border-t border-[#c8c0b4]" style={{ background: "#DDD9D0", fontSize: "10px", color: "#666" }}>
          <div className="flex gap-4">
            <span>
              نوع السند:&nbsp;
              <strong style={{ color: paymentType === "cash" ? "#16A34A" : "#B45309" }}>
                {paymentType === "cash" ? "نقدًا — سيُحفظ بحالة مدفوع" : "آجل — يمكن المدفوع الجزئي"}
              </strong>
            </span>
            <span>الأصناف: <strong style={{ color: "#406B93" }}>{lines.filter(l => l.productName).length}</strong></span>
          </div>
          <div className="flex gap-3">
            <span>Tab/Enter: انتقال</span>
            <span>Ctrl+C: نسخ سطر</span>
            <span>Ctrl+V: لصق</span>
            <span>Ctrl+Del: حذف سطر</span>
            <span>F1: جديد</span>
            <span>F2: حفظ</span>
          </div>
        </div>
      </div>

      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        .classic-input {
          border: 1px solid #a0a0a0;
          padding: 1px 5px;
          height: 22px;
          font-size: 12px;
          font-family: 'Cairo', Tahoma, Arial, sans-serif;
          background: #fff;
          outline: none;
          border-radius: 1px;
        }
        .classic-input:focus {
          border-color: #406B93;
          background: #F0F6FF;
          box-shadow: 0 0 0 1px rgba(64,107,147,0.2);
        }
        .inv-th {
          border: 1px solid rgba(255,255,255,0.15);
          border-bottom: 2px solid rgba(0,0,0,0.15);
          padding: 4px 6px;
          text-align: right;
          font-weight: 700;
          font-size: 11px;
          white-space: nowrap;
          font-family: 'Cairo', Tahoma, sans-serif;
        }
        .inv-td {
          border: 1px solid #e8e4dc;
          padding: 1px 3px;
          height: 24px;
          vertical-align: middle;
        }
        .inv-cell {
          border: none;
          outline: none;
          padding: 1px 4px;
          height: 22px;
          font-size: 12px;
          font-family: 'Cairo', Tahoma, Arial, sans-serif;
          background: transparent;
          width: 100%;
        }
        .inv-cell:focus {
          background: #FFFFF0;
          border: 1px solid #406B93;
          box-shadow: inset 0 0 0 1px rgba(64,107,147,0.15);
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}

// ─── HF: Header Field ─────────────────────────────────────────────────────────
function HF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label style={{ fontSize: "10px", fontWeight: 700, color: "#666", fontFamily: "'Cairo', Tahoma" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── TF: Total Field ──────────────────────────────────────────────────────────
function TF({ label, value, highlight, big, color }: {
  label: string;
  value: string;
  highlight?: boolean;
  big?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap" }}>{label}</span>
      <input
        readOnly
        value={value}
        className="classic-input text-center"
        style={{
          width: big ? 100 : 88,
          background: highlight ? "#FFFDE7" : "#F5F3EF",
          fontWeight: highlight || big ? 700 : 400,
          color: color ?? (highlight ? "#003399" : "#333"),
          fontSize: big ? 13 : 12,
          borderColor: highlight ? "#F59E0B" : "#c0bab2",
        }}
      />
    </div>
  );
}

// ─── Product Name Cell with autocomplete ─────────────────────────────────────
function ProductNameCell({
  rowIdx, value, products, cellRefs, onSelect, onKeyDown, onFocus,
}: {
  rowIdx: number;
  value: string;
  products: any[];
  cellRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  onSelect: (name: string, code: string, id: number, unit: string, price: string, tax: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
}) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  const handleChange = (v: string) => {
    setSearch(v);
    if (v.length >= 1) {
      const f = products.filter(p =>
        p.name.includes(v) || (p.code && p.code.includes(v)) ||
        (p.sku && p.sku.includes(v)) || (p.barcode && p.barcode.includes(v))
      ).slice(0, 12);
      setFiltered(f);
      setOpen(f.length > 0);
      setHighlighted(0);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (p: any) => {
    setSearch(p.name);
    setOpen(false);
    onSelect(p.name, p.sku ?? p.barcode ?? p.code ?? "", p.id, p.unit ?? "", p.salePrice ? String(p.salePrice) : "", p.taxRate ? String(p.taxRate) : "0");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative w-full">
      <input
        ref={el => { (inputRef as any).current = el; if (el) cellRefs.current.set(`${rowIdx}-1`, el); }}
        value={search}
        onChange={e => handleChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={e => {
          if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return; }
            if (e.key === "Enter" && filtered[highlighted]) { e.preventDefault(); handleSelect(filtered[highlighted]); return; }
            if (e.key === "Escape") { setOpen(false); return; }
          }
          onKeyDown(e);
        }}
        className="inv-cell w-full"
        placeholder="اسم الصنف..."
        autoComplete="off"
      />
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "absolute", top: "100%", right: 0, zIndex: 100,
            background: "#fff", border: "1px solid #a0a0a0",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            width: 280, maxHeight: 200, overflowY: "auto",
            fontSize: "12px",
          }}
        >
          {filtered.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: "4px 8px",
                background: i === highlighted ? "#D4E3F7" : (i % 2 === 0 ? "#fff" : "#FAFAF8"),
                cursor: "pointer",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                gap: 8,
              }}
              onMouseDown={() => handleSelect(p)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span style={{ color: "#406B93", fontWeight: 600, minWidth: 60 }}>{p.sku ?? p.code ?? ""}</span>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ color: "#16A34A", fontWeight: 600 }}>{p.salePrice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
