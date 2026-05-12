/**
 * SalesInvoicePage.tsx
 * فاتورة مبيعات كلاسيكية بتصميم مطابق لبرنامج أجيال
 * - تنقل Tab/Enter بين حقول الجدول
 * - Ctrl+C لنسخ السطر المحدد، Ctrl+V للصق
 * - رأس الفاتورة: رقم الفاتورة، التاريخ، العميل، المخزن، نوع السند، العملة، البائع، الكود التحليلي
 * - جدول الأصناف: رقم الصنف، اسم الصنف، الكمية، الوحدة، السعر، الخصم%، الخصم$، الضريبة%، الإجمالي
 * - قسم الإجماليات: إجمالي، خصم، ضريبة، صافي، مدفوع نقداً، مدين
 */
import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// أعمدة الجدول بالترتيب للتنقل بـ Tab
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
  const discAmt = base * (discPct / 100);
  const afterDisc = base - discAmt;
  const taxAmt = afterDisc * (taxPct / 100);
  return (afterDisc + taxAmt).toFixed(3);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesInvoicePage() {
  // Header state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [voucherType, setVoucherType] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [exchangeRate, setExchangeRate] = useState("1.00000");
  const [salesperson, setSalesperson] = useState("بائع");
  const [analyticCode, setAnalyticCode] = useState("");
  const [notes, setNotes] = useState("");

  // Lines state
  const [lines, setLines] = useState<InvoiceLine[]>([EMPTY_LINE()]);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [copiedLine, setCopiedLine] = useState<InvoiceLine | null>(null);

  // Refs for cell inputs
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Queries
  const customersQuery = trpc.customers.list.useQuery({});
  const warehousesQuery = trpc.warehouses.list.useQuery();
  const productsQuery = trpc.products.list.useQuery({});
  const nextNumberQuery = trpc.salesInvoices.nextNumber.useQuery({ prefix: "SI" });

  // Mutations
  const createMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الفاتورة بنجاح");
      handleNew();
    },
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  // Set invoice number on load
  useEffect(() => {
    if (nextNumberQuery.data && !invoiceNumber) {
      setInvoiceNumber(nextNumberQuery.data);
    }
  }, [nextNumberQuery.data]);

  // ─── Calculations ─────────────────────────────────────────────────────────
  const subtotal = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return s + qty * price;
  }, 0);

  const totalDiscount = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const discPct = parseFloat(l.discountPct) || 0;
    return s + qty * price * (discPct / 100);
  }, 0);

  const totalTax = lines.reduce((s, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const discPct = parseFloat(l.discountPct) || 0;
    const taxPct = parseFloat(l.taxPct) || 0;
    const base = qty * price;
    const afterDisc = base - base * (discPct / 100);
    return s + afterDisc * (taxPct / 100);
  }, 0);

  const netTotal = subtotal - totalDiscount + totalTax;

  // ─── Line Operations ──────────────────────────────────────────────────────
  const updateLine = useCallback((idx: number, field: keyof InvoiceLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      // Auto-calc discount amount when pct changes
      if (field === "discountPct" || field === "quantity" || field === "unitPrice") {
        const qty = parseFloat(field === "quantity" ? value : line.quantity) || 0;
        const price = parseFloat(field === "unitPrice" ? value : line.unitPrice) || 0;
        const discPct = parseFloat(field === "discountPct" ? value : line.discountPct) || 0;
        line.discountAmt = (qty * price * discPct / 100).toFixed(3);
      }
      // Auto-calc tax amount when pct changes
      if (field === "taxPct" || field === "quantity" || field === "unitPrice" || field === "discountPct") {
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
    setLines(prev => {
      if (prev.length === 1) return [EMPTY_LINE()];
      return prev.filter((_, i) => i !== idx);
    });
    setSelectedLineIdx(prev => Math.max(0, prev - 1));
  }, []);

  // ─── Product Search ───────────────────────────────────────────────────────
  const handleProductCodeChange = useCallback((idx: number, code: string) => {
    updateLine(idx, "productCode", code);
    if (!code) return;
    const products = productsQuery.data ?? [];
    const found = products.find(p => p.sku === code || p.barcode === code || p.id.toString() === code);
    if (found) {
      setLines(prev => {
        const updated = [...prev];
        const line = { ...updated[idx] };
        line.productCode = found.sku ?? found.barcode ?? code;
        line.productName = found.name;
        line.productId = found.id;
        line.unit = found.unit ?? "";
        line.unitPrice = found.salePrice ? String(found.salePrice) : "";
        line.taxPct = found.vatRate ? String(found.vatRate) : "0";
        line.total = calcLineTotal(line);
        updated[idx] = line;
        return updated;
      });
    }
  }, [productsQuery.data]);

  // ─── Keyboard Navigation (Tab/Enter + Ctrl+C/V) ──────────────────────────
  const handleCellKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    const totalCols = COL_FIELDS.length;
    const totalRows = lines.length;

    // Ctrl+C: نسخ السطر الحالي
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      setCopiedLine({ ...lines[rowIdx] });
      toast.info(`تم نسخ السطر ${rowIdx + 1}`);
      return;
    }

    // Ctrl+V: لصق السطر المنسوخ
    if (e.ctrlKey && e.key === "v") {
      e.preventDefault();
      if (!copiedLine) { toast.warning("لا يوجد سطر منسوخ"); return; }
      setLines(prev => {
        const updated = [...prev];
        const newLine = { ...copiedLine, id: crypto.randomUUID() };
        newLine.total = calcLineTotal(newLine);
        updated.splice(rowIdx + 1, 0, newLine);
        return updated;
      });
      setTimeout(() => {
        const key = `${rowIdx + 1}-0`;
        cellRefs.current.get(key)?.focus();
      }, 50);
      return;
    }

    // Tab أو Enter: الانتقال للحقل التالي
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < totalCols) {
        // انتقل للعمود التالي في نفس السطر
        const key = `${rowIdx}-${nextCol}`;
        cellRefs.current.get(key)?.focus();
      } else {
        // آخر عمود → انتقل للسطر التالي
        if (rowIdx + 1 < totalRows) {
          setSelectedLineIdx(rowIdx + 1);
          const key = `${rowIdx + 1}-0`;
          cellRefs.current.get(key)?.focus();
        } else {
          // آخر سطر → أضف سطراً جديداً
          addLine();
          setTimeout(() => {
            const key = `${rowIdx + 1}-0`;
            cellRefs.current.get(key)?.focus();
          }, 50);
        }
      }
      return;
    }

    // Shift+Tab: الانتقال للخلف
    if (e.shiftKey && e.key === "Tab") {
      e.preventDefault();
      const prevCol = colIdx - 1;
      if (prevCol >= 0) {
        const key = `${rowIdx}-${prevCol}`;
        cellRefs.current.get(key)?.focus();
      } else if (rowIdx > 0) {
        setSelectedLineIdx(rowIdx - 1);
        const key = `${rowIdx - 1}-${totalCols - 1}`;
        cellRefs.current.get(key)?.focus();
      }
      return;
    }

    // Delete: حذف السطر
    if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteLine(rowIdx);
      return;
    }
  }, [lines, copiedLine, addLine, deleteLine]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }
    createMutation.mutate({
      invoiceNumber,
      invoiceType: "invoice",
      invoiceDate: new Date(invoiceDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      customerId: customerId ?? undefined,
      customerName: customerName || undefined,
      warehouseId: warehouseId ?? undefined,
      currency,
      exchangeRate,
      voucherType: voucherType || undefined,
      basedOn: basedOn || undefined,
      analyticCode: analyticCode || undefined,
      salesperson: salesperson || undefined,
      notes: notes || undefined,
      subtotal: subtotal.toFixed(3),
      discountAmount: totalDiscount.toFixed(3),
      taxAmount: totalTax.toFixed(3),
      total: netTotal.toFixed(3),
      items: validLines.map(l => ({
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
      })),
    });
  }, [invoiceNumber, invoiceDate, dueDate, customerId, customerName, warehouseId, currency, exchangeRate, voucherType, basedOn, analyticCode, salesperson, notes, lines, subtotal, totalDiscount, totalTax, netTotal, createMutation]);

  // ─── New Invoice ──────────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    setLines([EMPTY_LINE()]);
    setSelectedLineIdx(0);
    setCustomerId(null);
    setCustomerName("");
    setWarehouseId(null);
    setVoucherType("");
    setBasedOn("");
    setAnalyticCode("");
    setNotes("");
    setDueDate("");
    nextNumberQuery.refetch().then(r => {
      if (r.data) setInvoiceNumber(r.data);
    });
  }, [nextNumberQuery]);

  // ─── ERP mode state ───────────────────────────────────────────────────────
  const [erpMode, setErpMode] = useState<ERPMode>("new");

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full bg-[#f0f0f0] text-[#1a1a1a] select-none"
      style={{ fontFamily: "Tahoma, Arial, sans-serif", fontSize: "12px" }}
      dir="rtl"
    >
      {/* ── ERP Toolbar ──────────────────────────────────────────────────── */}
      <ERPToolbar
        pageTitle="فواتير المبيعات"
        mode={erpMode}
        saveDisabled={createMutation.isPending}
        onNew={() => { handleNew(); setErpMode("new"); }}
        onSave={() => { handleSave(); setErpMode("view"); }}
        onEdit={() => { setErpMode("edit"); toast.info("وضع التعديل"); }}
        onDelete={() => { toast.info("حذف الفاتورة..."); }}
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

      {/* ── Header Form ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#a0a0a0] px-3 py-2">
        {/* Row 1 */}
        <div className="grid grid-cols-6 gap-x-3 gap-y-1 mb-1">
          <HeaderField label="فاتورة #">
            <input
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="classic-input w-full"
              style={{ backgroundColor: "#ffffcc" }}
            />
          </HeaderField>
          <HeaderField label="بناءً على">
            <input
              value={basedOn}
              onChange={e => setBasedOn(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <HeaderField label="نوع السند">
            <input
              value={voucherType}
              onChange={e => setVoucherType(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <HeaderField label="العملة">
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="classic-input w-full"
            >
              <option value="SAR">SAR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="AED">AED</option>
            </select>
          </HeaderField>
          <HeaderField label="سعر الصرف">
            <input
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              className="classic-input w-full text-center"
            />
          </HeaderField>
          <div />
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-6 gap-x-3 gap-y-1 mb-1">
          <HeaderField label="عميل">
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
          </HeaderField>
          <HeaderField label="تاريخ التحرير">
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <HeaderField label="تاريخ الدفع">
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <HeaderField label="مخزن">
            <select
              value={warehouseId ?? ""}
              onChange={e => setWarehouseId(parseInt(e.target.value) || null)}
              className="classic-input w-full"
            >
              <option value="">-- اختر مخزن --</option>
              {warehousesQuery.data?.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </HeaderField>
          <HeaderField label="بائع">
            <input
              value={salesperson}
              onChange={e => setSalesperson(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <div />
        </div>
        {/* Row 3 */}
        <div className="grid grid-cols-6 gap-x-3 gap-y-1">
          <HeaderField label="ملحوظة">
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <HeaderField label="الكود التحليلي">
            <input
              value={analyticCode}
              onChange={e => setAnalyticCode(e.target.value)}
              className="classic-input w-full"
            />
          </HeaderField>
          <div className="col-span-4" />
        </div>
      </div>

      {/* ── Lines Table ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white border-b border-[#a0a0a0]">
        <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
          <thead>
            <tr className="bg-[#d4e3f7] text-[#1a1a1a]">
              <th className="classic-th w-8 text-center">#</th>
              <th className="classic-th w-24">رقم الصنف</th>
              <th className="classic-th">إسم الصنف</th>
              <th className="classic-th w-20 text-center">كمية</th>
              <th className="classic-th w-20">وحدة</th>
              <th className="classic-th w-24 text-center">سعر الوحدة</th>
              <th className="classic-th w-16 text-center">%</th>
              <th className="classic-th w-24 text-center">تخفيض $</th>
              <th className="classic-th w-16 text-center">ض%</th>
              <th className="classic-th w-24 text-center">القيمة</th>
              <th className="classic-th w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, rowIdx) => (
              <tr
                key={line.id}
                className={`border-b border-[#e0e0e0] ${selectedLineIdx === rowIdx ? "bg-[#e8f0fe]" : rowIdx % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]"}`}
                onClick={() => setSelectedLineIdx(rowIdx)}
              >
                {/* # */}
                <td className="classic-td text-center text-[#666]">{rowIdx + 1}</td>

                {/* رقم الصنف */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-0`, el); }}
                    value={line.productCode}
                    onChange={e => handleProductCodeChange(rowIdx, e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 0)}
                    className="classic-cell-input w-full"
                    placeholder="كود..."
                  />
                </td>

                {/* اسم الصنف */}
                <td className="classic-td p-0">
                  <ProductNameCell
                    rowIdx={rowIdx}
                    value={line.productName}
                    products={productsQuery.data ?? []}
                    cellRefs={cellRefs}
                    onSelect={(name, code, id, unit, price, tax) => {
                      setLines(prev => {
                        const updated = [...prev];
                        const l = { ...updated[rowIdx] };
                        l.productName = name;
                        l.productCode = code;
                        l.productId = id;
                        l.unit = unit;
                        l.unitPrice = price;
                        l.taxPct = tax;
                        l.total = calcLineTotal(l);
                        updated[rowIdx] = l;
                        return updated;
                      });
                    }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 1)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                  />
                </td>

                {/* كمية */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-2`, el); }}
                    type="number"
                    value={line.quantity}
                    onChange={e => updateLine(rowIdx, "quantity", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 2)}
                    className="classic-cell-input w-full text-center"
                    min="0"
                  />
                </td>

                {/* وحدة */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-3`, el); }}
                    value={line.unit}
                    onChange={e => updateLine(rowIdx, "unit", e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 3)}
                    className="classic-cell-input w-full text-center"
                    placeholder="وحدة"
                  />
                </td>

                {/* سعر الوحدة */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-4`, el); }}
                    type="number"
                    value={line.unitPrice}
                    onChange={e => updateLine(rowIdx, "unitPrice", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 4)}
                    className="classic-cell-input w-full text-center"
                    min="0"
                  />
                </td>

                {/* خصم % */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-5`, el); }}
                    type="number"
                    value={line.discountPct}
                    onChange={e => updateLine(rowIdx, "discountPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 5)}
                    className="classic-cell-input w-full text-center"
                    min="0" max="100"
                  />
                </td>

                {/* خصم $ */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-6`, el); }}
                    type="number"
                    value={line.discountAmt}
                    onChange={e => updateLine(rowIdx, "discountAmt", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 6)}
                    className="classic-cell-input w-full text-center"
                    min="0"
                  />
                </td>

                {/* ضريبة % */}
                <td className="classic-td p-0">
                  <input
                    ref={el => { if (el) cellRefs.current.set(`${rowIdx}-7`, el); }}
                    type="number"
                    value={line.taxPct}
                    onChange={e => updateLine(rowIdx, "taxPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 7)}
                    className="classic-cell-input w-full text-center"
                    min="0" max="100"
                  />
                </td>

                {/* الإجمالي */}
                <td className="classic-td text-center font-semibold text-[#003399]">
                  {parseFloat(line.total).toFixed(3)}
                </td>

                {/* حذف */}
                <td className="classic-td text-center">
                  <button
                    onClick={() => deleteLine(rowIdx)}
                    className="text-red-500 hover:text-red-700 px-1"
                    title="حذف السطر"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add Line Button */}
        <div className="p-2 border-t border-[#e0e0e0]">
          <button
            onClick={addLine}
            className="flex items-center gap-1 text-[11px] text-[#0055cc] hover:underline"
          >
            <Plus className="w-3 h-3" /> إضافة سطر جديد (أو اضغط Enter في آخر سطر)
          </button>
        </div>
      </div>

      {/* ── Totals Bar ───────────────────────────────────────────────────── */}
      <div className="bg-[#e8e8e8] border-t border-[#a0a0a0] px-3 py-2">
        <div className="flex items-center gap-4">
          {/* Right totals */}
          <div className="flex items-center gap-3 flex-1">
            <TotalField label="إجمالي" value={subtotal.toFixed(3)} />
            <TotalField label="تخفيض" value={totalDiscount.toFixed(3)} />
            <TotalField label="الضريبة" value={totalTax.toFixed(3)} />
          </div>
          {/* Left totals */}
          <div className="flex items-center gap-3">
            <TotalField label="صافي" value={netTotal.toFixed(3)} highlight />
            <TotalField label="مدفوع نقداً" value="0.00" />
            <TotalField label="مدين" value={netTotal.toFixed(3)} />
            <TotalField label="المجموع الإجمالي" value={netTotal.toFixed(3)} />
          </div>
        </div>
      </div>

      {/* ── Keyboard Hint ────────────────────────────────────────────────── */}
      <div className="bg-[#f5f5f5] border-t border-[#d0d0d0] px-3 py-1 text-[10px] text-[#666] flex gap-4">
        <span>Tab/Enter: انتقال للحقل التالي</span>
        <span>Ctrl+C: نسخ السطر</span>
        <span>Ctrl+V: لصق السطر</span>
        <span>Ctrl+Del: حذف السطر</span>
      </div>

      {/* ── Styles ───────────────────────────────────────────────────────── */}
      <style>{`
        .classic-input {
          border: 1px solid #a0a0a0;
          padding: 2px 4px;
          height: 22px;
          font-size: 12px;
          font-family: Tahoma, Arial, sans-serif;
          background: #fff;
          outline: none;
        }
        .classic-input:focus {
          border-color: #0066cc;
          background: #fffff0;
        }
        .classic-th {
          border: 1px solid #a0b8d0;
          padding: 3px 6px;
          text-align: right;
          font-weight: bold;
          font-size: 11px;
          white-space: nowrap;
        }
        .classic-td {
          border: 1px solid #e0e0e0;
          padding: 1px 4px;
          height: 24px;
          vertical-align: middle;
        }
        .classic-cell-input {
          border: none;
          outline: none;
          padding: 2px 4px;
          height: 22px;
          font-size: 12px;
          font-family: Tahoma, Arial, sans-serif;
          background: transparent;
          width: 100%;
        }
        .classic-cell-input:focus {
          background: #fffff0;
          border: 1px solid #0066cc;
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] text-[#555] font-bold">{label}</label>
      {children}
    </div>
  );
}

function TotalField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-[#444] whitespace-nowrap">{label}</span>
      <input
        readOnly
        value={value}
        className="classic-input text-center w-24"
        style={{
          backgroundColor: highlight ? "#ffffcc" : "#f0f0f0",
          fontWeight: highlight ? "bold" : "normal",
          color: highlight ? "#003399" : "#333",
        }}
      />
    </div>
  );
}

// ─── Product Name Cell with Search ───────────────────────────────────────────
function ProductNameCell({
  rowIdx,
  value,
  products,
  cellRefs,
  onSelect,
  onKeyDown,
  onFocus,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  const handleChange = (v: string) => {
    setSearch(v);
    if (v.length >= 1) {
      const f = products.filter(p =>
        p.name.includes(v) || (p.code && p.code.includes(v))
      ).slice(0, 10);
      setFiltered(f);
      setOpen(f.length > 0);
    } else {
      setOpen(false);
    }
  };

  const handleSelect = (p: any) => {
    setSearch(p.name);
    setOpen(false);
    onSelect(
      p.name,
      p.sku ?? p.barcode ?? "",
      p.id,
      p.unit ?? "",
      p.salePrice ? String(p.salePrice) : "",
      p.vatRate ? String(p.vatRate) : "0"
    );
  };

  // Close on outside click
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
        ref={el => {
          (inputRef as any).current = el;
          if (el) cellRefs.current.set(`${rowIdx}-1`, el);
        }}
        value={search}
        onChange={e => handleChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={e => {
          if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            return;
          }
          if (e.key === "Escape") { setOpen(false); return; }
          onKeyDown(e);
        }}
        className="classic-cell-input w-full"
        placeholder="اسم الصنف..."
        autoComplete="off"
      />
      {open && (
        <div
          ref={dropRef}
          className="absolute z-50 bg-white border border-[#a0a0a0] shadow-lg w-64 max-h-40 overflow-y-auto"
          style={{ top: "100%", right: 0, fontSize: "12px" }}
        >
          {filtered.map(p => (
            <div
              key={p.id}
              className="px-2 py-1 hover:bg-[#d4e3f7] cursor-pointer border-b border-[#f0f0f0]"
              onMouseDown={() => handleSelect(p)}
            >
              <span className="text-[#0055cc] ml-2">{p.code}</span>
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
