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
import PostingPreviewModal from "@/components/PostingPreviewModal";
import InvoicePrintModal, { type DocTemplateConfig } from "@/components/InvoicePrintModal";
import SendDocumentPanel from "@/components/SendDocumentPanel";
import PaymentModal from "@/components/PaymentModal";
import { buildInvoiceHtml } from "@/lib/buildInvoiceHtml";
import QRCode from "qrcode";

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

type PaymentType = "cash" | "credit" | "partial";

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
export default function SalesInvoicePage({ initialInvoiceId }: { initialInvoiceId?: number } = {}) {
  // ── Header state ─────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [custSearch, setCustSearch]     = useState("");
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custDropRef = useRef<HTMLDivElement>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [journalWarehouseId, setJournalWarehouseId] = useState<number | null>(null); // مخزن مقيَّد من الدفتر
  const [docTypeWarehouseId, setDocTypeWarehouseId] = useState<number | null>(null); // مخزن مقيَّد من نوع السند
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPayInvoiceId, setPendingPayInvoiceId] = useState<number | null>(null);
  const [pendingPayInvoiceNumber, setPendingPayInvoiceNumber] = useState("");
  const [pendingPayTotal, setPendingPayTotal] = useState(0);
  const [docTypeId, setDocTypeId] = useState<string>("");
  const [currency, setCurrency] = useState("SAR");
  const [exchangeRate, setExchangeRate] = useState("1.000");
  const [salesperson, setSalesperson] = useState("");
  const [basedOnType, setBasedOnType] = useState<'sale' | 'quote' | 'order' | 'transfer' | ''>('');
  const [basedOnNum, setBasedOnNum]   = useState("");
  const [basedOnTrigger, setBasedOnTrigger] = useState(""); // يُحرِّك جلب البيانات
  const [notes, setNotes] = useState("");
  const [paidAmountOverride, setPaidAmountOverride] = useState<string>("");
  const [paymentBreakdown, setPaymentBreakdown]     = useState<Record<string, number>>({});

  // ── Lines state ───────────────────────────────────────────────────────────
  const [lines, setLines] = useState<InvoiceLine[]>([EMPTY_LINE()]);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [copiedLine, setCopiedLine] = useState<InvoiceLine | null>(null);

  // ── Document Journal ──────────────────────────────────────────────────────
  const [journalId, setJournalId] = useState<number | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalCustomersJournalId, setJournalCustomersJournalId] = useState<number | null>(null);

  // ── Posting state ─────────────────────────────────────────────────────────
  const [savedInvoiceId, setSavedInvoiceId]       = useState<number | null>(null);
  const [navInvoiceId,   setNavInvoiceId]         = useState<number | null>(initialInvoiceId ?? null);
  const [isPosted, setIsPosted]                   = useState(false);
  const [showPostingPreview, setShowPostingPreview] = useState(false);
  const [showPrintModal, setShowPrintModal]         = useState(false);
  const [showSendPanel, setShowSendPanel]           = useState(false);

  // ── ERP mode ──────────────────────────────────────────────────────────────
  const [erpMode, setErpMode] = useState<ERPMode>("new");

  // ── Customer type & tax ───────────────────────────────────────────────────
  const [customerType, setCustomerType]         = useState<'individual' | 'organization'>('individual');
  const [customerTaxNumber, setCustomerTaxNumber] = useState("");

  // ── Add Customer Modal ────────────────────────────────────────────────────
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName]     = useState("");
  const [newCustCode, setNewCustCode]     = useState("");
  const [newCustPhone, setNewCustPhone]   = useState("");
  const [newCustEmail, setNewCustEmail]   = useState("");
  const [newCustAddr, setNewCustAddr]     = useState("");
  const [newCustType, setNewCustType]         = useState<'individual' | 'organization'>('individual');
  const [newCustTaxNum, setNewCustTaxNum]     = useState("");
  const [newCustRegNum, setNewCustRegNum]     = useState("");
  const [newCustShortAddr, setNewCustShortAddr] = useState("");
  const [newCustBuilding, setNewCustBuilding] = useState("");
  const [newCustAdditional, setNewCustAdditional] = useState("");
  const [newCustPostal, setNewCustPostal]     = useState("");
  const [newCustCity, setNewCustCity]         = useState("");

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const skipAutoPayModal = useRef(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const customersQuery   = trpc.customers.list.useQuery({});
  const warehousesQuery  = trpc.warehouses.list.useQuery();
  const productsQuery    = trpc.products.list.useQuery({});
  const journalsQuery    = trpc.documentJournals.list.useQuery({ docTypes: ["sales_invoice", "sales"] });
  const nextNumberQuery  = trpc.salesInvoices.nextNumber.useQuery({ prefix: "INV" });
  const docTypesQuery    = trpc.documentTypes.list.useQuery({ typeId: "sales" });
  const allInvoicesQuery = trpc.salesInvoices.list.useQuery({});
  const qrSettingsQuery       = trpc.qrSettings.get.useQuery();
  const orgQuery              = trpc.orgs.currentOrg.useQuery();
  const defaultTemplateQuery  = trpc.documentTemplates.getDefault.useQuery({ docType: "sales_invoice" });
  const stockQuery       = trpc.reports.stockByWarehouse.useQuery(
    { warehouseId: warehouseId! },
    { enabled: !!warehouseId }
  );

  const nextJournalNumberMutation = trpc.documentJournals.nextNumber.useMutation();
  const utils = trpc.useUtils();

  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: (data) => {
      customersQuery.refetch();
      setCustomerId(data.id);
      setCustomerName(data.name);
      setCustomerCode((data as any).code ?? "");
      setCustomerType((data.customerType as any) ?? 'individual');
      setCustomerTaxNumber((data as any).taxNumber ?? "");
      setShowAddCustomer(false);
      setNewCustName(""); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
      setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
      setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional("");
      setNewCustPostal(""); setNewCustCity("");
      toast.success(`✓ تم إضافة العميل: ${data.name}`);
    },
    onError: (e) => toast.error(`خطأ في إضافة العميل: ${e.message}`),
  });

  // جلب المستند المصدر (بناءً على)
  const basedOnQuery = trpc.salesInvoices.getByNumber.useQuery(
    { type: basedOnType as 'sale' | 'quote' | 'order' | 'transfer', number: basedOnTrigger },
    { enabled: !!basedOnType && !!basedOnTrigger }
  );

  // إغلاق dropdown العميل عند الضغط خارجه
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custDropRef.current && !custDropRef.current.contains(e.target as Node)) {
        setShowCustDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // عند ورود بيانات المستند المصدر: ملء حقول الفاتورة
  useEffect(() => {
    const src = basedOnQuery.data;
    if (!src) return;
    if (src.customerName) setCustomerName(src.customerName);
    if (src.customerId)   setCustomerId(src.customerId);
    if (src.warehouseId && !journalWarehouseId) setWarehouseId(src.warehouseId);
    if (src.currency)     setCurrency(src.currency);
    if (src.notes)        setNotes(src.notes ?? "");
    if (src.items.length > 0) {
      setLines(src.items.map(i => ({
        id: crypto.randomUUID(),
        productCode:  i.productCode,
        productName:  i.productName,
        unit:         i.unit || "",
        quantity:     i.quantity,
        unitPrice:    i.unitPrice,
        discountPct:  i.discountPct,
        discountAmt:  i.discountAmt,
        taxPct:       i.taxPct,
        taxAmt:       i.taxAmt,
        total:        i.total,
        productId:    i.productId ?? undefined,
      })));
    }
    toast.success(`✓ تم استيراد بيانات المستند ${src.number}`);
  }, [basedOnQuery.data]);

  // ── فتح فاتورة موجودة بالـ ID (من القائمة أو التنقل) ────────────────────
  const navInvoiceQuery = trpc.salesInvoices.get.useQuery(
    { id: navInvoiceId! },
    { enabled: !!navInvoiceId }
  );

  useEffect(() => {
    const inv = navInvoiceQuery.data;
    if (!inv) return;
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : "");
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "");
    setCustomerId(inv.customerId ?? null);
    setCustomerName(inv.customerName ?? "");
    setCustomerCode(inv.customerId ? ((customersQuery.data ?? []).find(c => c.id === inv.customerId)?.code ?? "") : "");
    setCustomerType((inv.customerType as any) ?? 'individual');
    setCustomerTaxNumber(inv.customerTaxNumber ?? "");
    setWarehouseId(inv.warehouseId ?? null);
    setJournalId(inv.journalId ?? null);
    setCurrency(inv.currency ?? "SAR");
    setExchangeRate(inv.exchangeRate ?? "1.000");
    setPaymentType((inv.paymentMethod ?? "cash") as PaymentType);
    setNotes(inv.notes ?? "");
    setPaidAmountOverride(inv.paidAmount ?? "");
    setSavedInvoiceId(inv.id);
    setIsPosted(inv.isPosted ?? false);
    setPaymentBreakdown((inv.paymentBreakdown as Record<string, number>) ?? {});
    setErpMode("view");
    if (inv.items && inv.items.length > 0) {
      setLines(inv.items.map(item => ({
        id: crypto.randomUUID(),
        productCode:  item.productCode ?? "",
        productName:  item.productName,
        unit:         item.unit ?? "",
        quantity:     item.quantity,
        unitPrice:    item.unitPrice,
        discountPct:  item.discountPercent ?? "0",
        discountAmt:  item.discountAmount ?? "0",
        taxPct:       item.taxPercent ?? "0",
        taxAmt:       item.taxAmount ?? "0",
        total:        item.total,
        productId:    item.productId ?? undefined,
      })));
    }
  }, [navInvoiceQuery.data]);

  const createMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: (data) => {
      const autoEntry = (data as any).autoPostedEntryNumber as string | undefined;
      if (autoEntry) {
        toast.success(`✓ تم حفظ الفاتورة ${data.invoiceNumber} وترحيلها تلقائياً`, {
          description: `قيد محاسبي رقم ${autoEntry} — الإجمالي: ${fmt(netTotal)} ${currency}`,
          duration: 6000,
        });
      } else {
        toast.success(`✓ تم حفظ الفاتورة ${data.invoiceNumber} بنجاح`, {
          description: `الإجمالي: ${fmt(netTotal)} ${currency} — اضغط "ترحيل" لترحيل القيد`,
          duration: 5000,
        });
      }
      setSavedInvoiceId(data.id);
      setNavInvoiceId(data.id);
      setIsPosted(data.isPosted ?? false);
      setErpMode("view");
      // فتح شاشة الدفع تلقائياً للفواتير النقدية (إلا إذا كانت تُستدعى من saveForPayment)
      if (paymentType !== "credit" && !skipAutoPayModal.current) {
        if (netTotal <= 0) {
          toast.warning("إجمالي الفاتورة يساوي صفر — لا يمكن تسجيل دفعة");
        } else {
          setPendingPayInvoiceId(data.id);
          setPendingPayInvoiceNumber(data.invoiceNumber);
          setPendingPayTotal(netTotal);
          setShowPaymentModal(true);
        }
      }
      skipAutoPayModal.current = false;
    },
    onError: (e) => toast.error(`خطأ في الحفظ: ${e.message}`),
  });

  const postMutation = trpc.posting.postSalesInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`✓ تم الترحيل — قيد رقم ${data.entryNumber}`);
      setIsPosted(true);
      setShowPostingPreview(false);
    },
    onError: (e) => toast.error(`خطأ في الترحيل: ${e.message}`),
  });

  const unpostMutation = trpc.posting.unpostSalesInvoice.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء الترحيل");
      setIsPosted(false);
    },
    onError: (e) => toast.error(`خطأ في إلغاء الترحيل: ${e.message}`),
  });

  const handleRepost = useCallback(() => {
    if (!savedInvoiceId) return;
    if (!window.confirm("سيتم حذف القيد الحالي وإنشاء قيد جديد بالأرقام الصحيحة. هل تريد المتابعة؟")) return;
    unpostMutation.mutate({ invoiceId: savedInvoiceId }, {
      onSuccess: () => {
        setIsPosted(false);
        postMutation.mutate({ invoiceId: savedInvoiceId }, {
          onSuccess: () => {
            toast.success("تمت إعادة الترحيل بنجاح");
            setIsPosted(true);
            setShowPostingPreview(false);
          },
          onError: (e) => toast.error(`خطأ في إعادة الترحيل: ${e.message}`),
        });
      },
      onError: (e) => toast.error(`خطأ في إلغاء الترحيل القديم: ${e.message}`),
    });
  }, [savedInvoiceId, unpostMutation, postMutation]);

  const deleteMutation = trpc.salesInvoices.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفاتورة بنجاح");
      allInvoicesQuery.refetch();
      handleNew();
    },
    onError: (e) => toast.error(`خطأ في الحذف: ${e.message}`),
  });

  const handleDelete = useCallback(() => {
    const targetId = navInvoiceId ?? savedInvoiceId;
    if (!targetId) { toast.warning("لا توجد فاتورة محددة للحذف"); return; }
    if (isPosted) { toast.error("لا يمكن حذف فاتورة مرحّلة — يجب إلغاء الترحيل أولاً"); return; }
    if (!window.confirm(`هل أنت متأكد من حذف الفاتورة؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    deleteMutation.mutate({ id: targetId });
  }, [navInvoiceId, savedInvoiceId, isPosted, deleteMutation]);

  // عند اختيار دفتر: اعرض الرقم المتوقع فقط (بدون حجزه في قاعدة البيانات)
  const handleJournalSelect = useCallback(async (id: number) => {
    setJournalId(id);
    setJournalOpen(false);
    const journals = journalsQuery.data ?? [];
    const j = journals.find((x: any) => x.id === id);
    if (j) {
      if (j.warehouseId) {
        setWarehouseId(j.warehouseId);
        setJournalWarehouseId(j.warehouseId);
      } else {
        setJournalWarehouseId(null);
      }
      if (j.defaultCurrency) setCurrency(j.defaultCurrency);
      if (j.defaultPayMethod) setPaymentType(j.defaultPayMethod as any);
      const custJId = (j as any).customersJournal ? parseInt((j as any).customersJournal) : null;
      setJournalCustomersJournalId(custJId && !isNaN(custJId) ? custJId : null);
    }
    // أعد ضبط نوع السند إذا لم يعد ضمن الدفتر الجديد
    setDocTypeId(prev => {
      const newFiltered = (docTypesQuery.data ?? []).filter((dt: any) => dt.journal === String(id));
      const still = newFiltered.some((dt: any) => String(dt.id) === prev);
      return still ? prev : "";
    });
    setDocTypeWarehouseId(null);
    try {
      const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: id });
      if (preview) setInvoiceNumber(preview);
    } catch {
      toast.error("تعذّر جلب رقم الفاتورة من الدفتر");
    }
  }, [journalsQuery.data, docTypesQuery.data, utils]);

  // عند اختيار نوع السند
  const handleDocTypeSelect = useCallback(async (id: string) => {
    setDocTypeId(id);
    if (!id) { setDocTypeWarehouseId(null); return; }
    const dt = (docTypesQuery.data ?? []).find((d: any) => String(d.id) === id);

    // ── تحديد المخزن من نوع السند ────────────────────────────────────────
    const wStr = dt?.warehouse;
    if (wStr && wStr !== "all" && wStr !== "none" && wStr !== "") {
      const wId = parseInt(wStr);
      if (!isNaN(wId)) {
        setDocTypeWarehouseId(wId);
        if (!journalWarehouseId) setWarehouseId(wId);
      }
    } else {
      setDocTypeWarehouseId(null);
    }

    // ── اختيار الدفتر تلقائياً من نوع السند (السيريال) ──────────────────
    if (dt?.journal) {
      const jId = parseInt(dt.journal);
      if (!isNaN(jId) && jId !== journalId) {
        setJournalId(jId);
        const j = (journalsQuery.data ?? []).find((x: any) => x.id === jId);
        if (j) {
          if (j.warehouseId) { setWarehouseId(j.warehouseId); setJournalWarehouseId(j.warehouseId); }
          if (j.defaultCurrency) setCurrency(j.defaultCurrency);
          if (j.defaultPayMethod) setPaymentType(j.defaultPayMethod as any);
        }
        try {
          const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: jId });
          if (preview) setInvoiceNumber(preview);
        } catch {
          // تجاهل خطأ جلب الرقم
        }
      }
    }
  }, [docTypesQuery.data, journalWarehouseId, journalId, journalsQuery.data, utils]);


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
    if (!journalId) {
      toast.error("يجب اختيار نوع السند قبل الحفظ");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("رقم الفاتورة مطلوب");
      return;
    }
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل في الفاتورة");
      return;
    }
    // تحقق من الرقم الضريبي للمؤسسات
    if (customerType === 'organization' && !customerTaxNumber.trim()) {
      toast.error("الرقم الضريبي مطلوب للعملاء من نوع مؤسسة");
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

    // ── التحقق من خيارات نوع المستند ──────────────────────────────────────
    const selectedDocType = docTypeId
      ? (docTypesQuery.data ?? []).find((dt: any) => String(dt.id) === docTypeId)
      : null;
    if (selectedDocType) {
      if (selectedDocType.requireNote && !notes.trim()) {
        toast.error("يجب إدخال ملاحظة للمستند (مطلوب في نوع المستند المختار)");
        return;
      }
      if (selectedDocType.requireCustomerCode && !customerId) {
        toast.error("يجب اختيار العميل (مطلوب في نوع المستند المختار)");
        return;
      }
      if (selectedDocType.requireEmployeeCode && !salesperson.trim()) {
        toast.error("يجب إدخال كود الموظف (مطلوب في نوع المستند المختار)");
        return;
      }
      if (selectedDocType.noStockDispatch && warehouseId) {
        const stockData = stockQuery.data ?? [];
        for (const line of validLines) {
          if (!line.productId) continue;
          const inv = stockData.find((s: any) => s.productId === line.productId);
          const available = Number(inv?.totalQuantity ?? 0);
          const requested = parseFloat(line.quantity) || 0;
          if (requested > available) {
            toast.error(
              `⛔ لا يوجد رصيد كافٍ للصنف "${line.productName}"\nالمتاح: ${available.toFixed(3)} — المطلوب: ${requested.toFixed(3)}`
            );
            return;
          }
        }
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

    const paid = paymentType === "cash" ? fmt(netTotal) : paymentType === "partial" ? fmt(paidAmount) : fmt(paidAmount);
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
      customerType,
      customerTaxNumber: customerTaxNumber || undefined,
      warehouseId: warehouseId ?? undefined,
      journalId: journalId ?? undefined,
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
      docTypeId: docTypeId ? parseInt(docTypeId) : undefined,
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
    customerType, customerTaxNumber,
    warehouseId, currency, exchangeRate, paymentType, paidAmount,
    remainingAmount, notes, lines, subtotal, totalDiscount, totalTax,
    netTotal, createMutation, journalId, nextJournalNumberMutation,
    docTypeId, docTypesQuery.data, salesperson, stockQuery.data,
  ]);

  // ── Save For Payment (حفظ الفاتورة من شاشة الدفع) ────────────────────────
  const saveForPayment = useCallback(async (): Promise<number | null> => {
    if (!journalId) { toast.error("يجب اختيار نوع السند قبل الحفظ"); return null; }
    if (!invoiceNumber.trim()) { toast.error("رقم الفاتورة مطلوب"); return null; }
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) { toast.error("يجب إضافة صنف واحد على الأقل في الفاتورة"); return null; }
    if (customerType === 'organization' && !customerTaxNumber.trim()) {
      toast.error("الرقم الضريبي مطلوب للعملاء من نوع مؤسسة"); return null;
    }
    for (const l of validLines) {
      if (!l.unitPrice || parseFloat(l.unitPrice) === 0) {
        toast.error(`سعر الصنف "${l.productName}" يجب أن يكون أكبر من صفر`); return null;
      }
      if (!l.quantity || parseFloat(l.quantity) === 0) {
        toast.error(`كمية الصنف "${l.productName}" يجب أن تكون أكبر من صفر`); return null;
      }
    }
    const selectedDocType = docTypeId
      ? (docTypesQuery.data ?? []).find((dt: any) => String(dt.id) === docTypeId)
      : null;
    if (selectedDocType) {
      if (selectedDocType.requireNote && !notes.trim()) { toast.error("يجب إدخال ملاحظة للمستند"); return null; }
      if (selectedDocType.requireCustomerCode && !customerId) { toast.error("يجب اختيار العميل"); return null; }
      if (selectedDocType.requireEmployeeCode && !salesperson.trim()) { toast.error("يجب إدخال كود الموظف"); return null; }
      if (selectedDocType.noStockDispatch && warehouseId) {
        const stockData = stockQuery.data ?? [];
        for (const line of validLines) {
          if (!line.productId) continue;
          const inv = stockData.find((s: any) => s.productId === line.productId);
          const available = Number(inv?.totalQuantity ?? 0);
          const requested = parseFloat(line.quantity) || 0;
          if (requested > available) {
            toast.error(`⛔ لا يوجد رصيد كافٍ للصنف "${line.productName}"\nالمتاح: ${available.toFixed(3)} — المطلوب: ${requested.toFixed(3)}`);
            return null;
          }
        }
      }
    }
    let finalInvoiceNumber = invoiceNumber;
    if (journalId) {
      try {
        finalInvoiceNumber = await nextJournalNumberMutation.mutateAsync({ journalId });
        setInvoiceNumber(finalInvoiceNumber);
      } catch {
        toast.error("تعذّر حجز رقم الفاتورة من الدفتر"); return null;
      }
    }
    const paid = paymentType === "cash" ? fmt(netTotal) : fmt(paidAmount);
    const remaining2 = paymentType === "cash" ? "0.000" : fmt(remainingAmount);
    const payMethod = paymentType === "cash" ? "cash" : "credit";
    const status = paymentType === "cash" ? "paid" : (remainingAmount <= 0 ? "paid" : "confirmed");
    try {
      skipAutoPayModal.current = true;
      const data = await createMutation.mutateAsync({
        invoiceNumber: finalInvoiceNumber,
        invoiceType: "sale",
        invoiceDate,
        dueDate: dueDate || undefined,
        customerId: customerId ?? undefined,
        customerName: customerName || undefined,
        customerType,
        customerTaxNumber: customerTaxNumber || undefined,
        warehouseId: warehouseId ?? undefined,
        journalId: journalId ?? undefined,
        currency,
        exchangeRate,
        subtotal: fmt(subtotal),
        discountAmount: fmt(totalDiscount),
        taxAmount: fmt(totalTax),
        total: fmt(netTotal),
        paidAmount: paid,
        remainingAmount: remaining2,
        paymentMethod: payMethod as any,
        status: status as any,
        notes: notes || undefined,
        docTypeId: docTypeId ? parseInt(docTypeId) : undefined,
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
      return data.id;
    } catch {
      skipAutoPayModal.current = false;
      return null;
    }
  }, [
    invoiceNumber, invoiceDate, dueDate, customerId, customerName,
    customerType, customerTaxNumber,
    warehouseId, currency, exchangeRate, paymentType, paidAmount,
    remainingAmount, notes, lines, subtotal, totalDiscount, totalTax,
    netTotal, createMutation, journalId, nextJournalNumberMutation,
    docTypeId, docTypesQuery.data, salesperson, stockQuery.data,
  ]);

  // ── New Invoice ───────────────────────────────────────────────────────────
  /* ── نسخة مماثلة — تحتفظ بكل بيانات الفاتورة وتفتح مستنداً جديداً ── */
  const handleDuplicate = useCallback(() => {
    const hasDoc = !!(savedInvoiceId ?? navInvoiceId);
    if (!hasDoc) { toast.warning("لا يوجد مستند محفوظ للنسخ — احفظ الفاتورة أولاً"); return; }
    setSavedInvoiceId(null);
    setNavInvoiceId(null);
    setIsPosted(false);
    setShowPostingPreview(false);
    setErpMode("new");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date().toISOString().split("T")[0]);
    setBasedOnType(''); setBasedOnNum(''); setBasedOnTrigger('');
    setPaidAmountOverride("");
    if (journalId) {
      utils.documentJournals.previewNextNumber.fetch({ journalId })
        .then(p => { if (p) setInvoiceNumber(p); })
        .catch(() => setInvoiceNumber(""));
    } else setInvoiceNumber("");
    toast.success("تم إنشاء نسخة مماثلة — راجع البيانات ثم احفظ");
  }, [savedInvoiceId, navInvoiceId, journalId, utils]);

  const handleNew = useCallback(() => {
    setLines([EMPTY_LINE()]);
    setSelectedLineIdx(0);
    setCustomerId(null);
    setCustomerName("");
    setCustSearch("");
    setShowCustDrop(false);
    setCustomerType('individual');
    setCustomerTaxNumber("");
    setWarehouseId(null);
    setPaymentType("cash");
    setBasedOnType('');
    setBasedOnNum('');
    setBasedOnTrigger('');
    setNotes("");
    setDueDate(new Date().toISOString().split("T")[0]);
    setSalesperson("");
    setPaidAmountOverride("");
    setErpMode("new");
    setJournalWarehouseId(null);
    setSavedInvoiceId(null);
    setNavInvoiceId(null);
    setIsPosted(false);
    setPaymentBreakdown({});
    setShowPostingPreview(false);
    // إذا كان هناك دفتر محدد، اعرض الرقم المتوقع — وإلا يبقى الحقل فارغاً
    if (journalId) {
      utils.documentJournals.previewNextNumber.fetch({ journalId }).then(preview => {
        if (preview) setInvoiceNumber(preview);
      }).catch(() => setInvoiceNumber(""));
    } else {
      setInvoiceNumber("");
    }
  }, [journalId, utils]);

  /* ── تحميل PDF الفاتورة (تُستخدم في SendDocumentPanel) ── */
  const handleDownloadPdf = useCallback(async () => {
    try {
      const qrEnabled = !!(qrSettingsQuery.data?.isEnabled && qrSettingsQuery.data?.showOnSalesInvoice);
      let qrDataUrl = "";
      if (qrEnabled) {
        const { generateQrContent } = await import("@/lib/qrUtils");
        const content = generateQrContent(
          qrSettingsQuery.data!.countrySystem as any,
          {
            sellerName: orgQuery.data?.name ?? qrSettingsQuery.data?.sellerName ?? "OneSoft ERP",
            taxNumber: orgQuery.data?.taxNumber ?? qrSettingsQuery.data?.taxNumber ?? "",
            invoiceDateTime: `${invoiceDate}T${new Date().toTimeString().slice(0,8)}`,
            totalAmount: netTotal, vatAmount: totalTax,
            invoiceNumber: invoiceNumber,
            buyerName: customerName, buyerTaxNumber: customerTaxNumber,
          } as any,
          qrSettingsQuery.data?.customFormat ?? undefined,
        );
        if (content) {
          qrDataUrl = await QRCode.toDataURL(content, { width: 200, margin: 1 }).catch(() => "");
        }
      }
      const html = buildInvoiceHtml(
        {
          invoiceNumber: invoiceNumber || "—",
          invoiceDate,
          invoiceTime: new Date().toTimeString().slice(0, 8),
          customerName: customerName || "عميل نقدي",
          customerCode: customerCode || undefined,
          customerTaxNumber: customerTaxNumber || undefined,
          customerBuildingNo: (customersQuery.data ?? []).find(c => c.id === customerId)?.buildingNumber || undefined,
          customerStreet: (customersQuery.data ?? []).find(c => c.id === customerId)?.address || undefined,
          customerCity: (customersQuery.data ?? []).find(c => c.id === customerId)?.city || undefined,
          customerPostalCode: (customersQuery.data ?? []).find(c => c.id === customerId)?.postalCode || undefined,
          customerAdditionalNo: (customersQuery.data ?? []).find(c => c.id === customerId)?.shortAddress || undefined,
          salesperson: salesperson || undefined,
          paymentType,
          currency,
          notes: notes || undefined,
          lines: lines.filter(l => l.productName.trim()).map(l => ({
            productCode: l.productCode,
            productName: l.productName,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            taxPct: l.taxPct,
            taxAmt: l.taxAmt,
            total: l.total,
          })),
          subtotal,
          discountTotal: totalDiscount,
          taxTotal: totalTax,
          grandTotal: netTotal,
          paidAmount,
          remainingAmount,
          sellerName: orgQuery.data?.name ?? qrSettingsQuery.data?.sellerName ?? "OneSoft ERP",
          sellerTaxNumber: orgQuery.data?.taxNumber ?? qrSettingsQuery.data?.taxNumber ?? "",
          sellerCommercialReg: orgQuery.data?.commercialReg || undefined,
          sellerAddress: orgQuery.data?.address ?? undefined,
          sellerPhone: orgQuery.data?.phone ?? undefined,
        },
        (() => {
          try {
            const raw = defaultTemplateQuery.data?.layoutJson;
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.type === "config_v1" ? parsed : null;
          } catch { return null; }
        })(),
        qrDataUrl || undefined,
        qrSettingsQuery.data?.countrySystem === "zatca" ? "ZATCA QR"
          : qrSettingsQuery.data?.countrySystem === "eta" ? "ETA QR" : "QR Code",
        qrSettingsQuery.data?.qrSize ?? 100,
      );
      const win = window.open("", "_blank", "width=980,height=1100");
      if (!win) { toast.error("تعذّر فتح نافذة PDF — تحقق من إعدادات المتصفح (السماح بالنوافذ المنبثقة)"); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 600);
    } catch (e: any) {
      toast.error("تعذّر توليد PDF");
    }
  }, [invoiceNumber, invoiceDate, customerName, customerCode, customerTaxNumber, salesperson,
      paymentType, currency, notes, lines, subtotal, totalDiscount, totalTax, netTotal,
      paidAmount, remainingAmount, orgQuery.data, qrSettingsQuery.data, defaultTemplateQuery.data]);

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
        isSaved={savedInvoiceId !== null}
        isPosted={isPosted}
        postingStatus={savedInvoiceId !== null ? (isPosted ? "posted" : "unposted") : null}
        onNew={() => { handleNew(); setErpMode("new"); }}
        onEdit={() => { setErpMode("edit"); toast.info("وضع التعديل"); }}
        onDelete={handleDelete}
        onSearch={() => { setErpMode("search"); toast.info("بحث..."); }}
        onRefresh={() => nextNumberQuery.refetch()}
        onCopy={handleDuplicate}
        onPost={() => {
          if (!savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً"); return; }
          setShowPostingPreview(true);
        }}
        onUnpost={() => {
          if (!savedInvoiceId) return;
          if (window.confirm("هل أنت متأكد من إلغاء ترحيل هذه الفاتورة؟")) {
            unpostMutation.mutate({ invoiceId: savedInvoiceId });
          }
        }}
        onRepost={handleRepost}
        onPreviewJournal={() => {
          if (!savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً"); return; }
          setShowPostingPreview(true);
        }}
        onApprove={() => toast.success("تم الاعتماد")}
        onCancel={() => { setErpMode("view"); toast.info("تم الإلغاء"); }}
        onPrint={() => setShowPrintModal(true)}
        onSend={() => {
          if (!savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً قبل الإرسال"); return; }
          setShowSendPanel(true);
        }}
        onFirst={() => {
          const ids = [...(allInvoicesQuery.data ?? [])].sort((a, b) => a.id - b.id).map(i => i.id);
          if (ids.length) { setNavInvoiceId(ids[0]); setErpMode("view"); }
        }}
        onPrev={() => {
          const ids = [...(allInvoicesQuery.data ?? [])].sort((a, b) => a.id - b.id).map(i => i.id);
          const cur = navInvoiceId ?? savedInvoiceId;
          const idx = cur ? ids.indexOf(cur) : -1;
          if (idx > 0) { setNavInvoiceId(ids[idx - 1]); setErpMode("view"); }
          else if (idx === -1 && ids.length) { setNavInvoiceId(ids[ids.length - 1]); setErpMode("view"); }
        }}
        onNext={() => {
          const ids = [...(allInvoicesQuery.data ?? [])].sort((a, b) => a.id - b.id).map(i => i.id);
          const cur = navInvoiceId ?? savedInvoiceId;
          const idx = cur ? ids.indexOf(cur) : -1;
          if (idx >= 0 && idx < ids.length - 1) { setNavInvoiceId(ids[idx + 1]); setErpMode("view"); }
          else if (idx === -1 && ids.length) { setNavInvoiceId(ids[0]); setErpMode("view"); }
        }}
        onLast={() => {
          const ids = [...(allInvoicesQuery.data ?? [])].sort((a, b) => a.id - b.id).map(i => i.id);
          if (ids.length) { setNavInvoiceId(ids[ids.length - 1]); setErpMode("view"); }
        }}
        onClose={() => toast.info("إغلاق")}
        enableShortcuts
      />

      {/* ── Main Content: outer flex row (left-col + summary) ──────────── */}
      <div className="flex-1 flex overflow-hidden" dir="rtl">
      <div className="flex-1 flex flex-col overflow-hidden">

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
                  <label className="text-[10px] font-bold text-[#D19C05] uppercase tracking-wide">رقم الفاتورة</label>
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
              <div className="flex gap-1 w-full" ref={custDropRef} style={{ position: "relative" }}>
                {/* حقل البحث */}
                <input
                  value={customerId ? (customerCode ? `${customerCode} - ${customerName}` : customerName) : custSearch}
                  onChange={e => {
                    if (customerId) return; // مقفول بعد الاختيار
                    setCustSearch(e.target.value);
                    setShowCustDrop(true);
                  }}
                  onFocus={() => { if (!customerId) setShowCustDrop(true); }}
                  readOnly={!!customerId}
                  placeholder="ابحث عن عميل..."
                  className="classic-input flex-1 min-w-0"
                  style={{ cursor: customerId ? "default" : "text", paddingLeft: customerId ? 22 : undefined }}
                />
                {/* زر مسح العميل المحدد */}
                {customerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId(null); setCustomerName(""); setCustomerCode(""); setCustSearch("");
                      setCustomerType('individual'); setCustomerTaxNumber("");
                      setShowCustDrop(false);
                    }}
                    style={{ position: "absolute", left: 66, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 13, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                    title="إلغاء اختيار العميل"
                  >✕</button>
                )}
                {/* زر السهم (عرض كل العملاء) */}
                <button
                  type="button"
                  onClick={() => { if (!customerId) { setCustSearch(""); setShowCustDrop(v => !v); } }}
                  className="flex-shrink-0 flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ width: 22, height: 22, borderRadius: 3, background: "#6B7280", color: "white", fontSize: 11, border: "1px solid #4B5563", lineHeight: 1 }}
                  title="عرض قائمة العملاء"
                >▾</button>
                {/* زر إضافة عميل جديد */}
                <button
                  type="button"
                  onClick={async () => {
                    setNewCustName(custSearch.trim()); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
                    setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
                    setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional("");
                    setNewCustPostal(""); setNewCustCity("");
                    if (journalCustomersJournalId) {
                      try {
                        const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: journalCustomersJournalId });
                        if (preview) setNewCustCode(preview);
                      } catch {}
                    }
                    setShowAddCustomer(true); setShowCustDrop(false);
                  }}
                  className="flex-shrink-0 flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ width: 22, height: 22, borderRadius: 3, background: "#D19C05", color: "white", fontSize: 16, fontWeight: 700, border: "1px solid #9A7203", lineHeight: 1 }}
                  title="إضافة عميل جديد"
                >+</button>

                {/* Dropdown نتائج البحث */}
                {showCustDrop && !customerId && (() => {
                  const all = customersQuery.data ?? [];
                  const q = custSearch.trim().toLowerCase();
                  const filtered = q
                    ? all.filter(c => c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q))
                    : all;
                  const exactMatch = all.some(c => c.name.toLowerCase() === q || (c.code ?? "").toLowerCase() === q);
                  return (
                    <div
                      style={{
                        position: "absolute", top: "100%", right: 0, left: 0, zIndex: 9999,
                        background: "white", border: "1px solid #d1d5db",
                        borderRadius: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                        maxHeight: 220, overflowY: "auto", marginTop: 2,
                      }}
                      dir="rtl"
                    >
                      {filtered.length === 0 && !custSearch.trim() && (
                        <div className="px-3 py-2 text-[11px] text-gray-400 text-center">لا يوجد عملاء مضافون</div>
                      )}
                      {filtered.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            setCustomerId(c.id);
                            setCustomerName(c.name);
                            setCustomerCode((c as any).code ?? "");
                            setCustomerType((c as any).customerType ?? 'individual');
                            setCustomerTaxNumber((c as any).taxNumber ?? "");
                            setCustSearch("");
                            setShowCustDrop(false);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-[12px]"
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                        >
                          <span style={{ fontSize: 13 }}>{(c as any).customerType === 'organization' ? '🏢' : '👤'}</span>
                          {(c as any).code && (
                            <span className="font-mono text-[11px] font-bold px-1 rounded" style={{ background: "#FEF3C7", color: "#D19C05", letterSpacing: "0.04em" }}>{(c as any).code}</span>
                          )}
                          <span className="font-medium text-gray-800">{c.name}</span>
                          {(c as any).customerType === 'organization' && (
                            <span className="text-[10px] text-blue-500 mr-auto">مؤسسة</span>
                          )}
                        </div>
                      ))}
                      {/* خيار إضافة الاسم المكتوب مباشرة */}
                      {custSearch.trim() && !exactMatch && (
                        <div
                          onMouseDown={async () => {
                            setNewCustName(custSearch.trim()); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
                            setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
                            setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional("");
                            setNewCustPostal(""); setNewCustCity("");
                            if (journalCustomersJournalId) {
                              try {
                                const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: journalCustomersJournalId });
                                if (preview) setNewCustCode(preview);
                              } catch {}
                            }
                            setShowAddCustomer(true); setShowCustDrop(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer text-[12px] font-bold"
                          style={{ background: "#EFF6FF", borderTop: "1px solid #BFDBFE", color: "#1D4ED8" }}
                        >
                          <span>➕</span>
                          <span>إضافة "{custSearch.trim()}" كعميل جديد</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
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
          </div>
        </div>

        {/* ── صف نوع العميل والرقم الضريبي ── */}
        <div className="flex items-center gap-3 mb-1.5 mt-1">
          {/* نوع الفاتورة (مؤشر) */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] flex-shrink-0"
            style={{
              background: customerType === 'organization' ? '#EFF6FF' : '#F0FDF4',
              border: `1px solid ${customerType === 'organization' ? '#93C5FD' : '#86EFAC'}`,
              color: customerType === 'organization' ? '#1D4ED8' : '#15803D',
            }}
          >
            {customerType === 'organization' ? '📋 فاتورة ضريبية' : '🧾 فاتورة ضريبية مبسطة'}
          </div>

          {/* نوع العميل (يظهر عند اختيار عميل) */}
          {customerId && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] flex-shrink-0"
              style={{
                background: customerType === 'organization' ? '#1D4ED8' : '#15803D',
                color: 'white',
                border: `1px solid ${customerType === 'organization' ? '#1e40af' : '#166534'}`,
              }}
            >
              {customerType === 'organization' ? '🏢 مؤسسة' : '👤 فرد'}
            </div>
          )}

          {/* الرقم الضريبي (يظهر فقط عند مؤسسة) */}
          {customerType === 'organization' && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold whitespace-nowrap" style={{ color: customerTaxNumber.trim() ? '#15803D' : '#DC2626' }}>
                الرقم الضريبي <span className="text-red-500">*</span>
              </label>
              <input
                value={customerTaxNumber}
                onChange={e => !customerId && setCustomerTaxNumber(e.target.value)}
                readOnly={!!customerId}
                className="classic-input"
                placeholder="3xxxxxxxxxxxxxxxxx"
                title={customerId ? "الرقم الضريبي محدد من كارت العميل — يُعدَّل من هناك" : ""}
                style={{
                  width: 200,
                  borderColor: customerTaxNumber.trim() ? '#86EFAC' : '#FCA5A5',
                  background: customerId ? '#F1F5F9' : (customerTaxNumber.trim() ? '#F0FDF4' : '#FFF5F5'),
                  cursor: customerId ? 'not-allowed' : 'text',
                  color: customerId ? '#475569' : undefined,
                }}
              />
            </div>
          )}

          {/* اسم العميل المحدد (للعرض السريع) */}
          {customerName && (
            <span className="text-[11px] font-medium text-gray-600 truncate flex-1 min-w-0">
              👤 {customerName}
              {customerType === 'organization' && customerTaxNumber && (
                <span className="text-[10px] text-blue-600 mr-2">| ض: {customerTaxNumber}</span>
              )}
            </span>
          )}
        </div>

        {/* ── الصف الثاني ── */}
        <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: "150px 120px 90px 100px 1fr 1fr" }}>
          <HF label="نوع السند">
            {(() => {
              const allDocTypes = docTypesQuery.data ?? [];
              const filteredDocTypes = journalId
                ? allDocTypes.filter((dt: any) => dt.journal === String(journalId))
                : allDocTypes;
              const selectedDT = docTypeId
                ? allDocTypes.find((dt: any) => String(dt.id) === docTypeId)
                : null;
              if (allDocTypes.length > 0) {
                return (
                  <div className="relative w-full">
                    {/* طبقة عرض الكود العربي فقط عند الاختيار */}
                    {selectedDT && (
                      <div
                        className="absolute inset-0 flex items-center px-2 pointer-events-none z-10"
                        style={{ background: "transparent" }}
                      >
                        <span className="font-bold text-blue-800 text-[12px] truncate">
                          {selectedDT.codeAr || selectedDT.nameAr}
                        </span>
                      </div>
                    )}
                    <select
                      value={docTypeId}
                      onChange={e => handleDocTypeSelect(e.target.value)}
                      className="classic-input w-full"
                      style={{
                        fontWeight: 600,
                        color: selectedDT ? "transparent" : undefined,
                      }}
                    >
                      {filteredDocTypes.map((dt: any) => (
                        <option key={dt.id} value={String(dt.id)}>
                          {dt.codeAr ? `${dt.codeAr} — ${dt.nameAr}` : dt.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <select
                  value={paymentType}
                  onChange={e => {
                    setPaymentType(e.target.value as PaymentType);
                    setPaidAmountOverride("");
                  }}
                  className="classic-input w-full"
                  style={{
                    background: paymentType === "cash" ? "#F0FDF4" : paymentType === "partial" ? "#EFF6FF" : "#FFF7ED",
                    borderColor: paymentType === "cash" ? "#16A34A" : paymentType === "partial" ? "#2563EB" : "#D97706",
                    fontWeight: 700,
                    color: paymentType === "cash" ? "#15803D" : paymentType === "partial" ? "#1D4ED8" : "#B45309",
                  }}
                >
                  <option value="cash">نقدًا</option>
                  <option value="partial">جزئي (دفعة + رصيد)</option>
                  <option value="credit">آجل</option>
                </select>
              );
            })()}
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
            <div className="flex gap-1 w-full">
              <select
                value={basedOnType}
                onChange={e => {
                  setBasedOnType(e.target.value as any);
                  setBasedOnNum('');
                  setBasedOnTrigger('');
                }}
                className="classic-input"
                style={{ minWidth: 100, flex: '0 0 auto' }}
              >
                <option value="">-- النوع --</option>
                <option value="order">أمر بيع</option>
                <option value="quote">عرض أسعار</option>
                <option value="transfer">تحويل داخلي</option>
                <option value="sale">فاتورة مبيعات</option>
              </select>
              <div className="relative flex-1">
                <input
                  value={basedOnNum}
                  onChange={e => { setBasedOnNum(e.target.value); setBasedOnTrigger(""); }}
                  onBlur={() => {
                    if (basedOnType && basedOnNum.trim())
                      setBasedOnTrigger(basedOnNum.trim());
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && basedOnType && basedOnNum.trim())
                      setBasedOnTrigger(basedOnNum.trim());
                  }}
                  placeholder={basedOnType ? "رقم المستند ثم Enter ↵" : "اختر النوع أولاً"}
                  disabled={!basedOnType}
                  className="classic-input w-full"
                  style={!basedOnType ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                />
                {basedOnQuery.isFetching && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-blue-500">⏳</span>
                )}
                {basedOnTrigger && !basedOnQuery.isFetching && basedOnQuery.data === null && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-red-500 font-bold" title="لم يُوجد المستند">✗</span>
                )}
                {basedOnTrigger && !basedOnQuery.isFetching && basedOnQuery.data && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-bold" title="تم استيراد البيانات">✓</span>
                )}
              </div>
            </div>
          </HF>
          <HF label="ملحوظة">
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="classic-input w-full"
            />
          </HF>
          <HF label="المخزن">
            {(() => {
              const lockedWh = journalWarehouseId ?? docTypeWarehouseId;
              const whTitle = journalWarehouseId
                ? "المخزن محدد من الدفتر ولا يمكن تغييره"
                : docTypeWarehouseId
                ? "المخزن محدد من نوع السند ولا يمكن تغييره"
                : undefined;
              return (
                <select
                  value={warehouseId ?? ""}
                  onChange={e => !lockedWh && setWarehouseId(parseInt(e.target.value) || null)}
                  className="classic-input w-full"
                  disabled={!!lockedWh}
                  title={whTitle}
                >
                  <option value="">-- اختر مخزن --</option>
                  {(lockedWh
                    ? warehousesQuery.data?.filter(w => w.id === lockedWh)
                    : warehousesQuery.data
                  )?.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              );
            })()}
          </HF>
          <HF label="البائع">
            <input
              value={salesperson}
              onChange={e => setSalesperson(e.target.value)}
              className="classic-input w-full"
            />
          </HF>
          <div />
        </div>
      </div>

      {/* ── Lines Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden border-b border-[#b0a89a]">

      {/* جدول السطور (يمين) */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "linear-gradient(to bottom, #D19C05, #B88904)", color: "#fff" }}>
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
            className="flex items-center gap-1 text-[11px] text-[#D19C05] hover:text-[#9A7203] hover:underline transition-colors"
          >
            <Plus className="w-3 h-3" />
            إضافة سطر جديد
            <span className="text-[#aaa] mr-1">(Enter في آخر سطر)</span>
          </button>
        </div>
      </div>
      </div>{/* end lines wrapper */}
      </div>{/* end left flex-col wrapper */}

      {/* ── لوحة الإجماليات (يسار) ──────────────────────────────────────── */}
      <div
        className="flex flex-col border-r border-[#b0a89a]"
        style={{ width: 290, minWidth: 290, background: "#F4F1EC" }}
      >
        {/* عنوان اللوحة */}
        <div
          className="px-3 py-2 text-[11px] font-bold text-white text-center"
          style={{ background: "linear-gradient(to bottom, #D19C05, #B88904)" }}
        >
          ملخص الفاتورة
        </div>

        {/* صفوف الإجماليات */}
        <div className="flex-1 flex flex-col justify-start px-3 py-3 gap-0">

          {/* المبلغ الإجمالي */}
          <div className="flex items-center justify-between py-2 border-b border-[#d4cfc7]">
            <span className="text-[11px] text-[#555]">المبلغ الإجمالي</span>
            <span className="text-[12px] font-semibold text-[#333] font-mono">{fmt(subtotal)}</span>
          </div>

          {/* قيمة الخصم */}
          <div className="flex items-center justify-between py-2 border-b border-[#d4cfc7]">
            <span className="text-[11px] text-[#555]">قيمة الخصم</span>
            <span className="text-[12px] font-semibold font-mono" style={{ color: totalDiscount > 0 ? "#C0392B" : "#aaa" }}>
              {totalDiscount > 0 ? `− ${fmt(totalDiscount)}` : fmt(0)}
            </span>
          </div>

          {/* الإجمالي غير شامل الضريبة */}
          <div className="flex items-center justify-between py-2 border-b border-[#d4cfc7]">
            <span className="text-[11px] text-[#555]">الإجمالي غير شامل الضريبة</span>
            <span className="text-[12px] font-semibold text-[#333] font-mono">{fmt(subtotal - totalDiscount)}</span>
          </div>

          {/* إجمالي الضريبة */}
          <div className="flex items-center justify-between py-2 border-b border-[#d4cfc7]">
            <span className="text-[11px] text-[#555]">إجمالي الضريبة</span>
            <span className="text-[12px] font-semibold font-mono" style={{ color: totalTax > 0 ? "#B45309" : "#aaa" }}>
              {fmt(totalTax)}
            </span>
          </div>

          {/* الإجمالي شامل الضريبة */}
          <div
            className="flex items-center justify-between py-2.5 px-2 rounded-md mt-1"
            style={{ background: "#D19C05", color: "#fff" }}
          >
            <span className="text-[11px] font-bold">الإجمالي شامل الضريبة</span>
            <span className="text-[13px] font-bold font-mono">{fmt(netTotal)}</span>
          </div>
        </div>

        {/* زر الدفع */}
        <div className="px-3 pt-1 pb-2">
          <button
            onClick={() => {
              if (netTotal <= 0) {
                toast.warning("يجب إضافة أصناف أو مبالغ إلى الفاتورة قبل تسجيل الدفع");
                return;
              }
              setPendingPayInvoiceId(savedInvoiceId);
              setPendingPayInvoiceNumber(invoiceNumber);
              setPendingPayTotal(netTotal);
              setShowPaymentModal(true);
            }}
            disabled={netTotal <= 0}
            className="w-full py-2.5 rounded-md text-[13px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: netTotal <= 0
                ? "#94a3b8"
                : "linear-gradient(135deg, #D19C05, #9A7203)",
              boxShadow: netTotal > 0 ? "0 2px 6px rgba(209,156,5,0.4)" : "none",
            }}
          >
            💳 الدفع
          </button>
          {paymentType !== "cash" && remainingAmount > 0 && (
            <div className="text-center mt-1 text-[10px]" style={{ color: "#C0392B" }}>
              متبقي: <span className="font-bold font-mono">{fmt(remainingAmount)}</span>
            </div>
          )}
        </div>

        {/* ── بيانات الدفع ── */}
        {(() => {
          const METHOD_LABELS: Record<string, { label: string; icon: string }> = {
            CASH:    { label: "نقدي",          icon: "💵" },
            CARD:    { label: "بطاقة بنكية",   icon: "💳" },
            BANK:    { label: "تحويل بنكي",    icon: "🏦" },
            ACCOUNT: { label: "آجل",            icon: "👤" },
            TAMARA:  { label: "تمارة",          icon: "🌙" },
            TABBY:   { label: "تابي",           icon: "⭐" },
            OTHER:   { label: "أخرى",           icon: "📋" },
          };
          const entries = Object.entries(paymentBreakdown).filter(([, v]) => v > 0);
          if (entries.length === 0) return null;
          const total = entries.reduce((s, [, v]) => s + v, 0);
          const openPayModal = () => {
            setPendingPayInvoiceId(savedInvoiceId);
            setPendingPayInvoiceNumber(invoiceNumber);
            setPendingPayTotal(netTotal);
            setShowPaymentModal(true);
          };
          return (
            <div className="mx-3 mb-3 rounded-md overflow-hidden border border-[#d4cfc7]" dir="rtl">
              {/* رأس القسم */}
              <button
                onClick={openPayModal}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(to left, #7C5A02, #9A7203)" }}
              >
                <span>بيانات الدفع</span>
                <span className="opacity-70 text-[9px]">✏️ تعديل</span>
              </button>
              {/* صفوف الوسائل */}
              <div className="bg-white divide-y divide-[#f0ede8]">
                {entries.map(([code, amount]) => {
                  const m = METHOD_LABELS[code] ?? { label: code, icon: "💰" };
                  return (
                    <div key={code} className="flex items-center justify-between px-2.5 py-1">
                      <span className="text-[10px] text-[#555] flex items-center gap-1">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                      <span className="text-[11px] font-semibold font-mono text-[#333]">
                        {fmt(amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* إجمالي */}
              <div
                className="flex items-center justify-between px-2.5 py-1.5"
                style={{ background: "#F4F1EC", borderTop: "1px solid #d4cfc7" }}
              >
                <span className="text-[10px] font-bold text-[#555]">الإجمالي</span>
                <span className="text-[11px] font-bold font-mono" style={{ color: "#9A7203" }}>
                  {fmt(total)}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      </div>{/* end flex wrapper */}

      {/* ── Totals Bar (مبسّط) ──────────────────────────────────────────── */}
      <div style={{ background: "#E8E4DC", borderTop: "1px solid #b0a89a" }}>
        {/* Status + Shortcuts row */}
        <div className="flex items-center justify-between px-3 py-1" style={{ fontSize: "10px", color: "#666" }}>
          <div className="flex gap-4">
            <span>
              نوع السند:&nbsp;
              <strong style={{ color: paymentType === "cash" ? "#16A34A" : "#B45309" }}>
                {paymentType === "cash" ? "نقدًا — سيُحفظ بحالة مدفوع" : "آجل — يمكن المدفوع الجزئي"}
              </strong>
            </span>
            <span>الأصناف: <strong style={{ color: "#D19C05" }}>{lines.filter(l => l.productName).length}</strong></span>
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
          border-color: #D19C05;
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
          border: 1px solid #D19C05;
          box-shadow: inset 0 0 0 1px rgba(64,107,147,0.15);
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* ── نافذة معاينة القيد المحاسبي ─────────────────────────────────── */}
      {showPostingPreview && savedInvoiceId && (
        <PostingPreviewModal
          invoiceId={savedInvoiceId}
          onClose={() => setShowPostingPreview(false)}
          onConfirmPost={() => postMutation.mutate({ invoiceId: savedInvoiceId! })}
          isPosting={postMutation.isPending}
        />
      )}

      {/* ── شاشة الدفع ──────────────────────────────────────────────────── */}
      {showPaymentModal && (
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          invoiceId={pendingPayInvoiceId}
          invoiceNumber={pendingPayInvoiceNumber}
          invoiceTotal={pendingPayTotal}
          currency={currency}
          customerId={customerId}
          onSaveFirst={!pendingPayInvoiceId ? saveForPayment : undefined}
          onConfirmed={(paidAmt, breakdown) => {
            setShowPaymentModal(false);
            setPaymentBreakdown(breakdown);
            const keys = Object.keys(breakdown);
            const methods = keys.join(" + ");
            toast.success(`✓ تم حفظ الفاتورة وتسجيل الدفع: ${paidAmt.toFixed(2)} ${currency}`, {
              description: keys.length > 0 ? `وسائل الدفع: ${methods}` : undefined,
              duration: 5000,
            });
          }}
        />
      )}

      {/* ── نافذة الطباعة مع QR Code ──────────────────────────────────── */}
      {/* ── لوحة الإرسال الإلكتروني ──────────────────────────────────────── */}
      {showSendPanel && (
        <SendDocumentPanel
          open={showSendPanel}
          onClose={() => setShowSendPanel(false)}
          docType="sales_invoice"
          docId={savedInvoiceId ?? undefined}
          docNumber={invoiceNumber || "—"}
          docTypeName="فاتورة مبيعات"
          amount={(() => {
            try {
              const n = Number(lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0) - (parseFloat(discountAmount) || 0));
              return new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2 }).format(n);
            } catch { return "0.00"; }
          })()}
          currency={currency || "SAR"}
          customerId={customerId ?? undefined}
          customerName={customerName || "العميل"}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {showPrintModal && (
        <InvoicePrintModal
          open={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          templateConfig={(() => {
            try {
              const raw = defaultTemplateQuery.data?.layoutJson;
              if (!raw) return null;
              const parsed = JSON.parse(raw);
              return parsed.type === "config_v1" ? (parsed as DocTemplateConfig) : null;
            } catch { return null; }
          })()}
          qrSettings={qrSettingsQuery.data ? {
            isEnabled: qrSettingsQuery.data.isEnabled,
            countrySystem: qrSettingsQuery.data.countrySystem as any,
            sellerName: qrSettingsQuery.data.sellerName ?? undefined,
            taxNumber: qrSettingsQuery.data.taxNumber ?? undefined,
            customFormat: qrSettingsQuery.data.customFormat ?? undefined,
            showOnSalesInvoice: qrSettingsQuery.data.showOnSalesInvoice,
            showOnPurchaseInvoice: qrSettingsQuery.data.showOnPurchaseInvoice,
            showOnReceiptVoucher: qrSettingsQuery.data.showOnReceiptVoucher,
            qrSize: qrSettingsQuery.data.qrSize,
            qrPosition: qrSettingsQuery.data.qrPosition,
          } : null}
          data={{
            invoiceNumber: invoiceNumber || "—",
            invoiceDate,
            invoiceTime: new Date().toTimeString().slice(0, 8),
            customerName: customerName || "عميل نقدي",
            customerCode: customerCode || undefined,
            customerTaxNumber: customerTaxNumber || undefined,
            customerBuildingNo: (customersQuery.data ?? []).find(c => c.id === customerId)?.buildingNumber || undefined,
            customerStreet: (customersQuery.data ?? []).find(c => c.id === customerId)?.address || undefined,
            customerCity: (customersQuery.data ?? []).find(c => c.id === customerId)?.city || undefined,
            customerPostalCode: (customersQuery.data ?? []).find(c => c.id === customerId)?.postalCode || undefined,
            customerAdditionalNo: (customersQuery.data ?? []).find(c => c.id === customerId)?.shortAddress || undefined,
            salesperson: salesperson || undefined,
            paymentType,
            currency,
            notes: notes || undefined,
            lines: lines
              .filter(l => l.productName.trim())
              .map(l => ({
                productCode: l.productCode,
                productName: l.productName,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                discountPct: l.discountPct,
                taxPct: l.taxPct,
                taxAmt: l.taxAmt,
                total: l.total,
              })),
            subtotal,
            discountTotal: totalDiscount,
            taxTotal: totalTax,
            grandTotal: netTotal,
            paidAmount,
            remainingAmount,
            sellerName: orgQuery.data?.name ?? qrSettingsQuery.data?.sellerName ?? "OneSoft ERP",
            sellerTaxNumber: orgQuery.data?.taxNumber ?? qrSettingsQuery.data?.taxNumber ?? "",
            sellerCommercialReg: orgQuery.data?.commercialReg || undefined,
            sellerAddress: orgQuery.data?.address ?? undefined,
            sellerPhone: orgQuery.data?.phone ?? undefined,
          }}
        />
      )}

      {/* ── نافذة إضافة عميل جديد ──────────────────────────────────────── */}
      {showAddCustomer && (
        <>
          <div
            className="fixed inset-0 z-[10000]"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowAddCustomer(false)}
          />
          <div
            className="fixed z-[10001] bg-white rounded-lg overflow-hidden"
            style={{
              top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: "1px solid #d1d5db",
            }}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#D19C05" }}>
              <span className="text-white font-bold text-[13px]">إضافة عميل جديد</span>
              <button onClick={() => setShowAddCustomer(false)} style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 flex flex-col gap-3">
              {/* الكود التلقائي */}
              {newCustCode && (
                <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "#FEF3C7", border: "1px solid #b8cfe0" }}>
                  <span className="text-[11px] font-bold text-[#D19C05]">كود العميل:</span>
                  <span className="font-mono font-bold text-[13px] text-[#D19C05] tracking-wider">{newCustCode}</span>
                  <span className="text-[10px] text-slate-400 mr-auto">(يُحدَّد تلقائياً من دفتر التكويد)</span>
                </div>
              )}
              {/* نوع العميل */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-600">نوع العميل</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setNewCustType('individual'); setNewCustTaxNum(""); }}
                    className="flex-1 py-1.5 rounded text-[12px] font-bold transition-colors"
                    style={{
                      background: newCustType === 'individual' ? '#15803D' : '#F3F4F6',
                      color: newCustType === 'individual' ? 'white' : '#374151',
                      border: `1px solid ${newCustType === 'individual' ? '#15803D' : '#D1D5DB'}`,
                    }}
                  >🧾 فرد (فاتورة مبسطة)</button>
                  <button
                    type="button"
                    onClick={() => setNewCustType('organization')}
                    className="flex-1 py-1.5 rounded text-[12px] font-bold transition-colors"
                    style={{
                      background: newCustType === 'organization' ? '#1D4ED8' : '#F3F4F6',
                      color: newCustType === 'organization' ? 'white' : '#374151',
                      border: `1px solid ${newCustType === 'organization' ? '#1D4ED8' : '#D1D5DB'}`,
                    }}
                  >📋 مؤسسة (فاتورة ضريبية)</button>
                </div>
              </div>

              {/* ── حقول الفرد ── */}
              {newCustType === 'individual' && (<>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">اسم العميل <span className="text-red-500">*</span></label>
                  <input autoFocus value={newCustName} onChange={e => setNewCustName(e.target.value)}
                    className="classic-input w-full" placeholder="أدخل اسم العميل..."
                    style={{ height: 28, fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم الجوال</label>
                  <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="classic-input w-full" placeholder="05xxxxxxxx" style={{ height: 28 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">البريد الإلكتروني</label>
                  <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)}
                    className="classic-input w-full" placeholder="example@domain.com" style={{ height: 28 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">العنوان</label>
                  <input value={newCustAddr} onChange={e => setNewCustAddr(e.target.value)}
                    className="classic-input w-full" placeholder="العنوان..." style={{ height: 28 }} />
                </div>
              </>)}

              {/* ── حقول المؤسسة ── */}
              {newCustType === 'organization' && (<>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">اسم المؤسسة <span className="text-red-500">*</span></label>
                  <input autoFocus value={newCustName} onChange={e => setNewCustName(e.target.value)}
                    className="classic-input w-full" placeholder="اسم الشركة أو المؤسسة..."
                    style={{ height: 28, fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم الجوال</label>
                  <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="classic-input w-full" placeholder="05xxxxxxxx" style={{ height: 28 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">البريد الإلكتروني</label>
                  <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)}
                    className="classic-input w-full" placeholder="example@domain.com" style={{ height: 28 }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold" style={{ color: '#DC2626' }}>
                    الرقم الضريبي <span className="text-red-500">*</span>
                  </label>
                  <input value={newCustTaxNum} onChange={e => setNewCustTaxNum(e.target.value)}
                    className="classic-input w-full" placeholder="3xxxxxxxxxxxxxxxxx"
                    style={{ height: 28, borderColor: newCustTaxNum.trim() ? '#86EFAC' : '#FCA5A5', background: newCustTaxNum.trim() ? '#F0FDF4' : '#FFF5F5' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم السجل التجاري</label>
                  <input value={newCustRegNum} onChange={e => setNewCustRegNum(e.target.value)}
                    className="classic-input w-full" placeholder="1010xxxxxx" style={{ height: 28 }} />
                </div>
                {/* صف: العنوان المختصر + المدينة */}
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">العنوان المختصر</label>
                    <input value={newCustShortAddr} onChange={e => setNewCustShortAddr(e.target.value)}
                      className="classic-input w-full" placeholder="مثال: ABCD" style={{ height: 28 }} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">المدينة</label>
                    <input value={newCustCity} onChange={e => setNewCustCity(e.target.value)}
                      className="classic-input w-full" placeholder="الرياض" style={{ height: 28 }} />
                  </div>
                </div>
                {/* صف: رقم المبنى + الرقم الفرعي */}
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">رقم المبنى</label>
                    <input value={newCustBuilding} onChange={e => setNewCustBuilding(e.target.value)}
                      className="classic-input w-full" placeholder="1234" style={{ height: 28 }} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">الرقم الفرعي</label>
                    <input value={newCustAdditional} onChange={e => setNewCustAdditional(e.target.value)}
                      className="classic-input w-full" placeholder="5678" style={{ height: 28 }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">الرمز البريدي</label>
                  <input value={newCustPostal} onChange={e => setNewCustPostal(e.target.value)}
                    className="classic-input w-full" placeholder="12345" style={{ height: 28 }} />
                </div>
              </>)}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <button
                onClick={() => setShowAddCustomer(false)}
                className="px-4 py-1.5 rounded text-[12px] font-medium transition-colors"
                style={{ background: "#e5e7eb", color: "#374151" }}
              >إلغاء</button>
              <button
                onClick={async () => {
                  if (!newCustName.trim()) return;
                  if (newCustType === 'organization' && !newCustTaxNum.trim()) {
                    toast.error("الرقم الضريبي مطلوب للمؤسسات"); return;
                  }
                  let finalCode: string | undefined = undefined;
                  if (journalCustomersJournalId && newCustCode) {
                    try {
                      finalCode = await nextJournalNumberMutation.mutateAsync({ journalId: journalCustomersJournalId });
                    } catch {
                      toast.error("تعذّر توليد كود العميل"); return;
                    }
                  }
                  createCustomerMutation.mutate({
                    name: newCustName.trim(),
                    code: finalCode || undefined,
                    phone: newCustPhone || undefined,
                    email: newCustEmail || undefined,
                    address: newCustType === 'individual' ? (newCustAddr || undefined) : undefined,
                    taxNumber: newCustTaxNum || undefined,
                    customerType: newCustType,
                    registrationNumber: newCustRegNum || undefined,
                    shortAddress: newCustShortAddr || undefined,
                    buildingNumber: newCustBuilding || undefined,
                    additionalNumber: newCustAdditional || undefined,
                    postalCode: newCustPostal || undefined,
                    city: newCustCity || undefined,
                  });
                }}
                disabled={!newCustName.trim() || createCustomerMutation.isPending || nextJournalNumberMutation.isPending}
                className="px-4 py-1.5 rounded text-[12px] font-bold transition-colors"
                style={{
                  background: newCustName.trim() ? "#D19C05" : "#9ca3af",
                  color: "white",
                  opacity: createCustomerMutation.isPending ? 0.7 : 1,
                }}
              >
                {createCustomerMutation.isPending ? "جاري الحفظ..." : "✓ حفظ العميل"}
              </button>
            </div>
          </div>
        </>
      )}
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
              <span style={{ color: "#D19C05", fontWeight: 600, minWidth: 60 }}>{p.sku ?? p.code ?? ""}</span>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ color: "#16A34A", fontWeight: 600 }}>{p.salePrice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
