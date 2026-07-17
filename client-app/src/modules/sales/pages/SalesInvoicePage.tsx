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
import { trpc } from "@/shared/lib/trpc";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import ERPToolbar, { ERPMode } from "@/shared/components/ERPToolbar";
import PostingPreviewModal from "@/shared/components/PostingPreviewModal";
import InvoicePrintModal from "@/shared/components/InvoicePrintModal";
import SendDocumentPanel from "@/shared/components/SendDocumentPanel";
import PaymentModal from "@/shared/components/PaymentModal";
import { PrintEngine } from "@/shared/lib/print";
import { usePrintTemplate } from "@/shared/hooks/usePrintTemplate";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import BasedOnDocInput from "@/shared/components/BasedOnDocInput";
import ContextSelectInput from "@/shared/components/ContextSelectInput";
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
  isStockItem?: boolean;
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

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmtDb(n: number) {
  return n.toFixed(4);
}
function toDisplayDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
function toIsoDate(display: string) {
  if (!display) return '';
  const parts = display.split('-');
  if (parts.length !== 3) return display;
  const [d, m, y] = parts;
  if (y.length === 4) return `${y}-${m}-${d}`;
  return display;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesInvoicePage({ initialInvoiceId, onDocTypeChange }: { initialInvoiceId?: number; onDocTypeChange?: (name: string) => void } = {}) {
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
  const invoiceDatePickerRef = useRef<HTMLInputElement>(null);
  const dueDatePickerRef = useRef<HTMLInputElement>(null);
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

  // ── Dirty guard ───────────────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const skipLinesRef  = useRef(false);
  const skipHeaderRef = useRef(false);

  // ── ZATCA tab ──────────────────────────────────────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState<"invoice" | "zatca">("invoice");

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
  const { templateConfig }    = usePrintTemplate("sales_invoice");

  const currentInvId          = navInvoiceId ?? savedInvoiceId;
  const zatcaQuery            = trpc.zatca.getInvoiceZatca.useQuery(
    { invoiceId: currentInvId! },
    { enabled: !!currentInvId && activeMainTab === "zatca" }
  );
  const zatcaSubmitMut        = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (r) => { toast.success(r.message ?? "تم"); zatcaQuery.refetch(); },
    onError:   (e) => toast.error(e.message),
  });
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

  // ── Dirty guard hook ──────────────────────────────────────────────────────
  const { confirmOpen: dirtyConfirmOpen, requestClose: dirtyRequestClose,
          confirmSave: dirtyConfirmSave, confirmDiscard: dirtyConfirmDiscard,
          confirmCancel: dirtyConfirmCancel } = useUnsavedChangesGuard({ isDirty });

  // reset dirty when entering view; skip first lines/header effect after mode change
  useEffect(() => {
    if (erpMode === "view") { setIsDirty(false); return; }
    skipLinesRef.current  = true;
    skipHeaderRef.current = true;
  }, [erpMode]);

  // mark dirty when lines change (skip first run after mode change)
  useEffect(() => {
    if (skipLinesRef.current) { skipLinesRef.current = false; return; }
    if (erpMode === "new" || erpMode === "edit") setIsDirty(true);
  }, [lines]); // eslint-disable-line react-hooks/exhaustive-deps

  // mark dirty when any header field changes (skip first run after mode change)
  useEffect(() => {
    if (skipHeaderRef.current) { skipHeaderRef.current = false; return; }
    if (erpMode === "new" || erpMode === "edit") setIsDirty(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, notes, invoiceDate, dueDate, journalId, warehouseId, docTypeId,
      currency, salesperson, paymentType, paidAmountOverride, customerTaxNumber, customerType]);

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
    if (inv.docTypeId) setDocTypeId(String(inv.docTypeId));
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
      (p: any) => p.sku === code || p.barcode === code || String(p.id) === code
    );
    if (found) {
      const isStock = (found as any).itemType !== "service";
      setLines(prev => {
        const updated = [...prev];
        const l = { ...updated[idx] };
        l.productCode = found.sku ?? found.barcode ?? code;
        l.productName = found.name;
        l.productId = found.id;
        l.isStockItem = isStock;
        l.unit = found.unit ?? "";
        l.unitPrice = found.salePrice ? String(found.salePrice) : "";
        l.taxPct = found.taxRate ? String(found.taxRate) : "0";
        l.total = calcLineTotal(l);
        updated[idx] = l;
        return updated;
      });
    } else {
      // كود غير موجود في قاعدة البيانات
      setLines(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], productId: undefined, isStockItem: undefined };
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

    if (e.ctrlKey && e.code === "KeyC") {
      e.preventDefault();
      setCopiedLine({ ...lines[rowIdx] });
      toast.info(`تم نسخ السطر ${rowIdx + 1}`);
      return;
    }
    if (e.ctrlKey && e.code === "KeyV") {
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
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const prevCol = colIdx - 1;
      if (prevCol >= 0 && cellRefs.current.has(`${rowIdx}-${prevCol}`)) {
        cellRefs.current.get(`${rowIdx}-${prevCol}`)?.focus();
      } else if (rowIdx > 0) {
        for (let c = totalCols; c >= 0; c--) {
          if (cellRefs.current.has(`${rowIdx - 1}-${c}`)) {
            cellRefs.current.get(`${rowIdx - 1}-${c}`)?.focus();
            break;
          }
        }
      }
      return;
    }
    if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter") {
      e.preventDefault();
      const nextKey = `${rowIdx}-${colIdx + 1}`;
      if (cellRefs.current.has(nextKey)) {
        cellRefs.current.get(nextKey)?.focus();
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
    if (e.ctrlKey && e.key === "Delete") {
      e.preventDefault();
      deleteLine(rowIdx);
    }
  }, [lines, copiedLine, addLine, deleteLine]);

  // ── Validation & Save ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // Validation — throw on failure so the unsaved-changes guard stays open
    if (!journalId) {
      toast.error("يجب اختيار نوع السند قبل الحفظ");
      throw new Error("validation");
    }
    if (!invoiceNumber.trim()) {
      toast.error("رقم الفاتورة مطلوب");
      throw new Error("validation");
    }
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل في الفاتورة");
      throw new Error("validation");
    }
    // تحقق من أن جميع الأصناف مسجلة في النظام
    for (const l of validLines) {
      if (!l.productId) {
        const nameOrCode = l.productCode || l.productName;
        toast.error(`الصنف "${nameOrCode}" غير موجود — يرجى اختيار صنف مسجل أو إنشاء صنف جديد`);
        throw new Error("validation");
      }
    }
    // تحقق من الرقم الضريبي للمؤسسات
    if (customerType === 'organization' && !customerTaxNumber.trim()) {
      toast.error("الرقم الضريبي مطلوب للعملاء من نوع مؤسسة");
      throw new Error("validation");
    }
    for (const l of validLines) {
      if (!l.unitPrice || parseFloat(l.unitPrice) === 0) {
        toast.error(`سعر الصنف "${l.productName}" يجب أن يكون أكبر من صفر`);
        throw new Error("validation");
      }
      if (!l.quantity || parseFloat(l.quantity) === 0) {
        toast.error(`كمية الصنف "${l.productName}" يجب أن تكون أكبر من صفر`);
        throw new Error("validation");
      }
    }

    // ── التحقق من خيارات نوع المستند ──────────────────────────────────────
    const selectedDocType = docTypeId
      ? (docTypesQuery.data ?? []).find((dt: any) => String(dt.id) === docTypeId)
      : null;
    if (selectedDocType) {
      if (selectedDocType.requireNote && !notes.trim()) {
        toast.error("يجب إدخال ملاحظة للمستند (مطلوب في نوع المستند المختار)");
        throw new Error("validation");
      }
      if (selectedDocType.requireCustomerCode && !customerId) {
        toast.error("يجب اختيار العميل (مطلوب في نوع المستند المختار)");
        throw new Error("validation");
      }
      if (selectedDocType.requireEmployeeCode && !salesperson.trim()) {
        toast.error("يجب إدخال كود الموظف (مطلوب في نوع المستند المختار)");
        throw new Error("validation");
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
            throw new Error("validation");
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
        throw new Error("journal_number");
      }
    }

    const paid = paymentType === "cash" ? fmtDb(netTotal) : paymentType === "partial" ? fmtDb(paidAmount) : fmtDb(paidAmount);
    const remaining = paymentType === "cash" ? "0.0000" : fmtDb(remainingAmount);
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
      subtotal: fmtDb(subtotal),
      discountAmount: fmtDb(totalDiscount),
      taxAmount: fmtDb(totalTax),
      total: fmtDb(netTotal),
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
    for (const l of validLines) {
      if (!l.productId) {
        const nameOrCode = l.productCode || l.productName;
        toast.error(`الصنف "${nameOrCode}" غير موجود — يرجى اختيار صنف مسجل أو إنشاء صنف جديد`);
        return null;
      }
    }
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
    const paid = paymentType === "cash" ? fmtDb(netTotal) : fmtDb(paidAmount);
    const remaining2 = paymentType === "cash" ? "0.0000" : fmtDb(remainingAmount);
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
        subtotal: fmtDb(subtotal),
        discountAmount: fmtDb(totalDiscount),
        taxAmount: fmtDb(totalTax),
        total: fmtDb(netTotal),
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

  // إبلاغ الأب بتغيير نوع السند
  useEffect(() => {
    if (!onDocTypeChange) return;
    if (!docTypeId) { onDocTypeChange(""); return; }
    const dt = (docTypesQuery.data ?? []).find((d: any) => String(d.id) === docTypeId);
    onDocTypeChange(dt?.nameAr ?? "");
  }, [docTypeId, docTypesQuery.data]);

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
    setExchangeRate("1.000");
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
        const { generateQrContent } = await import("@/shared/lib/qrUtils");
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
      const ok = PrintEngine.buildAndPrint({
        documentType: "sales_invoice",
        data: {
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
        templateConfig,
        qrDataUrl: qrDataUrl || undefined,
        qrLabel: qrSettingsQuery.data?.countrySystem === "zatca" ? "ZATCA QR"
          : qrSettingsQuery.data?.countrySystem === "eta" ? "ETA QR" : "QR Code",
        qrSize: qrSettingsQuery.data?.qrSize ?? 100,
      });
      if (!ok) toast.error("تعذّر فتح نافذة PDF — تحقق من إعدادات المتصفح (السماح بالنوافذ المنبثقة)");
    } catch (e: any) {
      toast.error("تعذّر توليد PDF");
    }
  }, [invoiceNumber, invoiceDate, customerName, customerCode, customerTaxNumber, salesperson,
      paymentType, currency, notes, lines, subtotal, totalDiscount, totalTax, netTotal,
      paidAmount, remainingAmount, orgQuery.data, qrSettingsQuery.data, templateConfig]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full text-[#1a1a1a] select-none"
      style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: "12px", background: "var(--background)" }}
      dir="rtl"
    >
      {/* ── Main Content: outer flex row (left-col + summary) ──────────── */}
      <div className="flex-1 flex overflow-hidden" dir="rtl">
      <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header Form ─────────────────────────────────────────────────── */}
      <div className="border-b border-[#b0a89a] px-3 pt-2 pb-2" style={{ background: "#F7F5EE", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        {/* ثوابت مشتركة لجميع الحقول — ارتفاع موحد 26px + عرض label موحد */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", columnGap: 10, rowGap: 5, alignItems: "center" }}>

          {/* ══ صف 1: رقم الفاتورة │ بناءً على │ نوع السند ══ */}

          {/* col 1: رقم الفاتورة */}
          {(() => {
            const journals = journalsQuery.data ?? [];
            const selected = journals.find((j: any) => j.id === journalId);
            const previewNum = (j: any): string => {
              const seq = (j.currentSeq ?? 0) === 0 ? (j.firstNumber ?? 1) : (j.currentSeq ?? 0) + (j.increment ?? 1);
              const padded = String(seq).padStart(j.numDigits ?? 6, "0");
              const year = j.includeYear ? `-${new Date().getFullYear()}` : "";
              return `${j.numberPrefix}${year}-${padded}`;
            };
            return (
              <div className="flex items-center flex-shrink-0 relative" style={{ gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#D19C05", flexShrink: 0, whiteSpace: "nowrap" }}>رقم الفاتورة</label>
                {selected && (
                  <span className="text-[9px] px-1 rounded cursor-pointer" style={{ background: "#dbeafe", color: "#1d4ed8", lineHeight: "16px" }} onClick={() => setJournalId(null)} title="إلغاء الدفتر">
                    {selected.name} ✕
                  </span>
                )}
                <div className="flex" style={{ height: 26 }}>
                  <input
                    value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    onContextMenu={e => { e.preventDefault(); setJournalOpen(o => !o); }}
                    onKeyDown={e => { if (e.key === "F4" || (e.key === "ArrowDown" && e.altKey)) { e.preventDefault(); setJournalOpen(o => !o); } }}
                    className="classic-input text-center font-bold"
                    style={{ width: 100, height: 26, background: selected ? "#eff6ff" : "#FFFDE7", borderColor: selected ? "#3b82f6" : "#F59E0B", borderRadius: "4px 0 0 4px", borderLeft: "none", color: "#1a1a1a", fontSize: "13px", fontWeight: 700 }}
                    title="كليك يمين أو F4 لاختيار الدفتر"
                  />
                  <button onClick={() => setJournalOpen(o => !o)} className="flex items-center justify-center" style={{ width: 20, height: 26, borderRadius: "0 4px 4px 0", background: selected ? "#3b82f6" : "#F59E0B", border: `1px solid ${selected ? "#2563eb" : "#d97706"}`, color: "white", fontSize: "9px" }}>▼</button>
                </div>
                {journalOpen && (<>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setJournalOpen(false)} />
                  <div className="absolute top-full right-0 z-[9999] mt-1 bg-white rounded-lg overflow-hidden" style={{ minWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0" }} dir="rtl">
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: "#1e40af" }}>
                      <span className="text-white text-[11px] font-bold">دفاتر فاتورة المبيعات</span>
                      <button onClick={() => setJournalOpen(false)} style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>✕</button>
                    </div>
                    {journals.length === 0 ? (
                      <div className="px-4 py-5 text-center"><div className="text-[20px] mb-1">📒</div><div className="text-[11px] text-slate-500">لا توجد دفاتر مُعرَّفة</div></div>
                    ) : (
                      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                        {journals.map((j: any, idx: number) => {
                          const isSelected = j.id === journalId;
                          return (
                            <button key={j.id} onClick={() => handleJournalSelect(j.id)} className="w-full flex items-center gap-0 text-right transition-colors" style={{ background: isSelected ? "#eff6ff" : idx % 2 === 0 ? "#fafafa" : "white", borderBottom: "1px solid #f1f5f9", padding: "6px 12px" }}>
                              <span style={{ width: 16, color: isSelected ? "#3b82f6" : "transparent", fontSize: "11px", flexShrink: 0 }}>✓</span>
                              <div className="flex-1 min-w-0 mx-2">
                                <div className="text-[12px] font-semibold truncate" style={{ color: isSelected ? "#1d4ed8" : "#1e293b" }}>فاتورة مبيعات – {j.name}</div>
                                {j.description && <div className="text-[10px] text-slate-400 truncate">{j.description}</div>}
                              </div>
                              <div className="font-mono text-[11px] font-bold px-2 py-0.5 rounded shrink-0" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>{previewNum(j)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                      <span className="text-[9px] text-slate-400">كليك يمين أو F4 لفتح القائمة</span>
                      {journalId && <button onClick={() => { setJournalId(null); setJournalOpen(false); }} className="text-[9px] text-red-400 hover:text-red-600">إلغاء اختيار الدفتر</button>}
                    </div>
                  </div>
                </>)}
              </div>
            );
          })()}

          {/* col 2-3: بناءً على */}
          <div className="flex items-center" style={{ gap: 6, gridColumn: "2/4" }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>بناءً على</label>
            <div className="flex flex-1 min-w-0" style={{ gap: 4 }}>
              <div style={{ flexShrink: 0, width: 110, display: "flex" }}>
                <ContextSelectInput
                  value={basedOnType}
                  onChange={v => { setBasedOnType(v as any); setBasedOnNum(''); setBasedOnTrigger(''); }}
                  options={[
                    { value: "order",    label: "أمر بيع" },
                    { value: "quote",    label: "عرض أسعار" },
                    { value: "transfer", label: "تحويل داخلي" },
                    { value: "sale",     label: "فاتورة مبيعات" },
                  ]}
                  menuTitle="نوع المستند المصدر"
                  placeholder="النوع ⊞"
                  style={{ height: 26 }}
                />
              </div>
              <BasedOnDocInput
                docType={basedOnType}
                value={basedOnNum}
                onChange={v => { setBasedOnNum(v); setBasedOnTrigger(""); }}
                onPick={num => { setBasedOnNum(num); setBasedOnTrigger(num); }}
                warehouseId={warehouseId}
                isFetching={basedOnQuery.isFetching}
                trigger={basedOnTrigger}
                isFound={basedOnTrigger && !basedOnQuery.isFetching
                  ? basedOnQuery.data != null
                  : null}
              />
            </div>
          </div>

          {/* col 4: نوع السند */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>نوع السند</label>
            {(() => {
              const allDocTypes = docTypesQuery.data ?? [];
              const filteredDocTypes = journalId ? allDocTypes.filter((dt: any) => dt.journal === String(journalId)) : allDocTypes;
              const selectedDT = docTypeId ? allDocTypes.find((dt: any) => String(dt.id) === docTypeId) : null;
              if (allDocTypes.length > 0) {
                return (
                  <ContextSelectInput
                    value={docTypeId}
                    onChange={v => handleDocTypeSelect(v)}
                    options={filteredDocTypes.map((dt: any) => ({
                      value: String(dt.id),
                      label: dt.codeAr ? `${dt.codeAr} — ${dt.nameAr}` : dt.nameAr,
                    }))}
                    menuTitle="نوع السند"
                    placeholder="نوع السند ⊞"
                    style={{ height: 26, fontWeight: 600, color: "#1e40af" }}
                  />
                );
              }
              return (
                <ContextSelectInput
                  value={paymentType}
                  onChange={v => { setPaymentType((v || "cash") as PaymentType); setPaidAmountOverride(""); }}
                  options={[
                    { value: "cash",    label: "نقدًا", color: "#15803D" },
                    { value: "partial", label: "جزئي",  color: "#1D4ED8" },
                    { value: "credit",  label: "آجل",   color: "#B45309" },
                  ]}
                  menuTitle="نوع الدفع"
                  style={{
                    height: 26, fontWeight: 700,
                    background:   paymentType === "cash" ? "#F0FDF4" : paymentType === "partial" ? "#EFF6FF" : "#FFF7ED",
                    borderColor:  paymentType === "cash" ? "#16A34A" : paymentType === "partial" ? "#2563EB" : "#D97706",
                    color:        paymentType === "cash" ? "#15803D" : paymentType === "partial" ? "#1D4ED8" : "#B45309",
                  }}
                />
              );
            })()}
          </div>

          {/* ══ صف 2: العميل (col 1-3) │ العملة (col 4) ══ */}

          {/* col 1-3: العميل */}
          <div className="flex items-center" ref={custDropRef} style={{ gap: 6, gridColumn: "1/4", position: "relative" }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>العميل</label>
            <div className="flex flex-1 min-w-0" style={{ gap: 4, position: "relative" }}>
              {/* حقل البحث / اسم العميل */}
              {(() => {
                const customerLocked = !!(savedInvoiceId || isPosted);
                const clearCustomer = () => {
                  setCustomerId(null); setCustomerName(""); setCustomerCode("");
                  setCustSearch(""); setCustomerType('individual');
                  setCustomerTaxNumber(""); setShowCustDrop(true);
                };
                return (
                  <>
                    <input
                      value={customerId ? (customerCode ? `${customerCode} - ${customerName}` : customerName) : custSearch}
                      onChange={e => { if (customerId || customerLocked) return; setCustSearch(e.target.value); setShowCustDrop(true); }}
                      onFocus={() => { if (!customerLocked && !customerId) setShowCustDrop(true); }}
                      onClick={() => { if (!customerLocked && customerId) clearCustomer(); }}
                      readOnly={!!(customerId || customerLocked)}
                      aria-expanded={showCustDrop ? "true" : "false"}
                      placeholder="ابحث عن عميل..."
                      className="classic-input flex-1 min-w-0"
                      style={{
                        height: 26,
                        cursor: customerLocked ? "not-allowed" : customerId ? "pointer" : "text",
                        background: customerLocked ? "#f3f4f6" : undefined,
                        paddingLeft: customerId && !customerLocked ? 20 : undefined,
                      }}
                      title={customerId && !customerLocked ? "انقر لتغيير العميل" : undefined}
                    />
                    {/* زر مسح العميل — يظهر فقط قبل الحفظ */}
                    {customerId && !customerLocked && (
                      <button type="button" onClick={clearCustomer}
                        style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", color: "#ef4444", fontSize: 12, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: "0 2px", zIndex: 2 }}
                        title="تغيير العميل">✕</button>
                    )}
                    {customerId && (
                      <div className="flex items-center flex-shrink-0 px-1.5 rounded text-[10px] font-bold" style={{ height: 26, background: customerType === 'organization' ? '#EFF6FF' : '#F0FDF4', border: `1px solid ${customerType === 'organization' ? '#93C5FD' : '#86EFAC'}`, color: customerType === 'organization' ? '#1D4ED8' : '#15803D' }}>
                        {customerType === 'organization' ? '🏢' : '👤'}
                      </div>
                    )}
                  </>
                );
              })()}
              <button type="button"
                onClick={() => { if (!(savedInvoiceId || isPosted) && !customerId) { setCustSearch(""); setShowCustDrop(v => !v); } }}
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 26, height: 26, borderRadius: 3, background: (savedInvoiceId || isPosted) ? "#9ca3af" : "#6B7280", color: "white", fontSize: 11, border: "1px solid #4B5563", cursor: (savedInvoiceId || isPosted) ? "not-allowed" : "pointer" }}>▾</button>
              <button type="button"
                onClick={async () => {
                  setNewCustName(custSearch.trim()); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
                  setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
                  setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional(""); setNewCustPostal(""); setNewCustCity("");
                  if (journalCustomersJournalId) { try { const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: journalCustomersJournalId }); if (preview) setNewCustCode(preview); } catch {} }
                  setShowAddCustomer(true); setShowCustDrop(false);
                }}
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 26, height: 26, borderRadius: 3, background: "#D19C05", color: "white", fontSize: 15, fontWeight: 700, border: "1px solid #9A7203" }}
                title="إضافة عميل جديد">+</button>
              {customerId && (
                <div className="flex items-center flex-shrink-0 px-2 rounded text-[10px] font-bold whitespace-nowrap"
                  style={{
                    height: 26,
                    background: customerTaxNumber ? "#EFF6FF" : "#F0FDF4",
                    border: `1px solid ${customerTaxNumber ? "#93C5FD" : "#86EFAC"}`,
                    color: customerTaxNumber ? "#1D4ED8" : "#15803D",
                  }}>
                  {customerTaxNumber ? "فاتورة ضريبية" : "فاتورة ضريبة مبسطة"}
                </div>
              )}
              {showCustDrop && !customerId && (() => {
                const all = customersQuery.data ?? [];
                const q = custSearch.trim().toLowerCase();
                const filtered = q ? all.filter(c => c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q)) : all;
                const exactMatch = all.some(c => c.name.toLowerCase() === q || (c.code ?? "").toLowerCase() === q);
                return (
                  <div style={{ position: "absolute", top: "100%", right: 0, left: 0, zIndex: 9999, background: "#f0f0f0", border: "1px solid #adadad", borderRadius: 0, boxShadow: "2px 2px 8px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)", maxHeight: 220, overflowY: "auto", marginTop: 2, fontFamily: '"Tahoma","Segoe UI",Arial,sans-serif' }} dir="rtl">
                    {filtered.length === 0 && !custSearch.trim() && <div className="px-3 py-2 text-[11px] text-center" style={{ color: "#999" }}>لا يوجد عملاء مضافون</div>}
                    {filtered.map(c => (
                      <div key={c.id}
                        onMouseDown={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerCode((c as any).code ?? ""); setCustomerType((c as any).customerType ?? 'individual'); setCustomerTaxNumber((c as any).taxNumber ?? ""); setCustSearch(""); setShowCustDrop(false); }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#CCE8FF")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                        className="flex items-center gap-2 px-3 cursor-default text-[12px]"
                        style={{ borderBottom: "1px solid #e0e0e0", minHeight: 28, cursor: "default" }}>
                        <span style={{ fontSize: 13 }}>{(c as any).customerType === 'organization' ? '🏢' : '👤'}</span>
                        {(c as any).code && <span className="font-mono text-[11px] font-bold px-1" style={{ background: "#FEF3C7", color: "#D19C05" }}>{(c as any).code}</span>}
                        <span style={{ fontWeight: 500, color: "#1a1a1a" }}>{c.name}</span>
                        {(c as any).customerType === 'organization' && <span className="text-[10px] mr-auto" style={{ color: "#0078D7" }}>مؤسسة</span>}
                      </div>
                    ))}
                    {custSearch.trim() && !exactMatch && (
                      <div
                        onMouseDown={async () => {
                          setNewCustName(custSearch.trim()); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
                          setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
                          setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional(""); setNewCustPostal(""); setNewCustCity("");
                          if (journalCustomersJournalId) { try { const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: journalCustomersJournalId }); if (preview) setNewCustCode(preview); } catch {} }
                          setShowAddCustomer(true); setShowCustDrop(false);
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#CCE8FF")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                        className="flex items-center gap-2 px-3 cursor-default text-[12px] font-bold"
                        style={{ borderTop: "1px solid #e0e0e0", minHeight: 28, color: "#0078D7", cursor: "default" }}>
                        <span>➕</span><span>إضافة "{custSearch.trim()}" كعميل جديد</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* col 4: العملة — تحت نوع السند */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>العملة</label>
            <ContextSelectInput
              value={currency}
              onChange={v => setCurrency(v || "SAR")}
              options={[
                { value: "SAR", label: "ريال سعودي", sublabel: "SAR" },
                { value: "USD", label: "دولار أمريكي", sublabel: "USD" },
                { value: "EUR", label: "يورو", sublabel: "EUR" },
                { value: "AED", label: "درهم إماراتي", sublabel: "AED" },
              ]}
              menuTitle="اختر العملة"
              placeholder="العملة ⊞"
              style={{ height: 26 }}
            />
          </div>

          {/* ══ صف 3: المخزن │ تاريخ التحرير │ تاريخ الدفع │ البائع ══ */}

          {/* col 1: المخزن */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>المخزن</label>
            {(() => {
              const lockedWh = journalWarehouseId ?? docTypeWarehouseId;
              const whTitle = journalWarehouseId ? "المخزن محدد من الدفتر" : docTypeWarehouseId ? "المخزن محدد من نوع السند" : undefined;
              const whOptions = (lockedWh
                ? warehousesQuery.data?.filter(w => w.id === lockedWh)
                : warehousesQuery.data
              )?.map(w => ({ value: String(w.id), label: w.name })) ?? [];
              return (
                <ContextSelectInput
                  value={warehouseId ? String(warehouseId) : ""}
                  onChange={v => !lockedWh && setWarehouseId(parseInt(v) || null)}
                  options={whOptions}
                  menuTitle="اختر المخزن"
                  placeholder="المخزن ⊞"
                  disabled={!!lockedWh}
                  title={whTitle}
                  style={{ height: 26 }}
                />
              );
            })()}
          </div>

          {/* col 2: تاريخ التحرير */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>تاريخ التحرير</label>
            <div className="flex flex-1" style={{ height: 26 }}>
              <DateSegmentInput value={invoiceDate} onChange={setInvoiceDate} style={{ flex: 1, minWidth: 0, height: 26 }} />
              <button type="button" onClick={() => invoiceDatePickerRef.current?.showPicker()} className="flex items-center justify-center flex-shrink-0" style={{ height: 26, width: 26, background: "#f3f4f6", border: "1px solid #d1d5db", borderLeft: "none", borderRadius: "0 4px 4px 0", color: "#555", cursor: "pointer", fontSize: 12 }}>📅</button>
              <input ref={invoiceDatePickerRef} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} tabIndex={-1} aria-hidden="true" />
            </div>
          </div>

          {/* col 3: تاريخ الدفع */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>تاريخ الدفع</label>
            <div className="flex flex-1" style={{ height: 26 }}>
              <DateSegmentInput value={dueDate} onChange={setDueDate} style={{ flex: 1, minWidth: 0, height: 26 }} />
              <button type="button" onClick={() => dueDatePickerRef.current?.showPicker()} className="flex items-center justify-center flex-shrink-0" style={{ height: 26, width: 26, background: "#f3f4f6", border: "1px solid #d1d5db", borderLeft: "none", borderRadius: "0 4px 4px 0", color: "#555", cursor: "pointer", fontSize: 12 }}>📅</button>
              <input ref={dueDatePickerRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} tabIndex={-1} aria-hidden="true" />
            </div>
          </div>

          {/* col 4: البائع — تحت العملة */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>البائع</label>
            <input value={salesperson} onChange={e => setSalesperson(e.target.value)} className="classic-input flex-1" style={{ height: 26 }} />
          </div>

          {/* ══ صف 4: ملحوظة ══ */}
          <div className="flex items-center" style={{ gap: 6, gridColumn: "1/-1" }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#555", minWidth: 62, flexShrink: 0, whiteSpace: "nowrap" }}>ملحوظة</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="classic-input flex-1" style={{ height: 26 }} />
          </div>

        </div>
      </div>

      {/* ── Main Tab Bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #b0a89a", background: "#F0EDE4", padding: "0 10px" }}>
        {[
          { id: "invoice", label: "📋 بيانات الفاتورة" },
          { id: "zatca",   label: "🏛️ الهيئة (ZATCA)", disabled: !currentInvId },
        ].map(t => (
          <button key={t.id} onClick={() => !t.disabled && setActiveMainTab(t.id as "invoice" | "zatca")}
            style={{ height: 30, padding: "0 14px", border: "none", borderBottom: activeMainTab === t.id ? "2px solid #D19C05" : "2px solid transparent", background: "transparent", color: activeMainTab === t.id ? "#D19C05" : t.disabled ? "#bbb" : "#4a4a4a", fontWeight: activeMainTab === t.id ? 800 : 600, fontSize: 11, cursor: t.disabled ? "not-allowed" : "pointer", fontFamily: "'Cairo', Tahoma, Arial, sans-serif", marginBottom: -1 }}>
            {t.label}
            {t.id === "zatca" && currentInvId && zatcaQuery.data?.zatcaStatus === "cleared" && (
              <span style={{ marginRight: 4, fontSize: 9, color: "#16a34a" }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ZATCA Panel ──────────────────────────────────────────────────── */}
      {activeMainTab === "zatca" && currentInvId && (
        <div className="flex-1 overflow-auto p-4" style={{ background: "#F7F5EE" }} dir="rtl">
          {zatcaQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>جارٍ التحميل...</div>
          ) : zatcaQuery.data && (
            <div style={{ maxWidth: 640 }}>
              {/* حالة الإرسال */}
              {(() => {
                const statusMap: Record<string, { label: string; color: string; bg: string; icon: string }> = {
                  not_submitted: { label: "لم تُرسَل للهيئة بعد",   color: "#6b7280", bg: "#f3f4f6", icon: "📭" },
                  pending:       { label: "في انتظار معالجة الهيئة", color: "#d97706", bg: "#fef3c7", icon: "⏳" },
                  cleared:       { label: "مُخلَّصة من الهيئة ✓",   color: "#16a34a", bg: "#dcfce7", icon: "✅" },
                  reported:      { label: "مُبلَّغة للهيئة",         color: "#0ea5e9", bg: "#e0f2fe", icon: "📤" },
                  rejected:      { label: "مرفوضة من الهيئة",        color: "#dc2626", bg: "#fee2e2", icon: "❌" },
                  error:         { label: "خطأ في الإرسال",           color: "#dc2626", bg: "#fee2e2", icon: "⚠️" },
                };
                const st = statusMap[zatcaQuery.data.zatcaStatus ?? "not_submitted"] ?? statusMap.not_submitted;
                return (
                  <div style={{ padding: "14px 18px", borderRadius: 10, background: st.bg, border: `1px solid ${st.color}44`, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{st.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: st.color }}>{st.label}</div>
                      {zatcaQuery.data.zatcaClearedAt && (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                          تاريخ التخليص: {new Date(zatcaQuery.data.zatcaClearedAt).toLocaleString('ar-SA')}
                        </div>
                      )}
                    </div>
                    <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
                      {zatcaQuery.data.zatcaStatus !== "cleared" && (
                        <button onClick={() => zatcaSubmitMut.mutate({ invoiceId: currentInvId })} disabled={zatcaSubmitMut.isPending} style={{ height: 30, padding: "0 16px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: zatcaSubmitMut.isPending ? 0.6 : 1 }}>
                          {zatcaSubmitMut.isPending ? "جارٍ الإرسال..." : "🏛️ إرسال للهيئة"}
                        </button>
                      )}
                      {zatcaQuery.data.zatcaStatus === "rejected" && (
                        <button onClick={() => zatcaSubmitMut.mutate({ invoiceId: currentInvId, forceResend: true })} disabled={zatcaSubmitMut.isPending} style={{ height: 30, padding: "0 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          إعادة الإرسال
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* التفاصيل التقنية */}
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "10px 16px", fontWeight: 800, fontSize: 12, color: "#374151", borderBottom: "1px solid #e2e8f0" }}>
                  🔑 البيانات التقنية
                </div>
                <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 10, alignItems: "start", fontSize: 12 }}>
                  {[
                    { label: "UUID الفاتورة",      value: zatcaQuery.data.zatcaUuid },
                    { label: "Hash التشفيري",       value: zatcaQuery.data.zatcaHash },
                    { label: "PIH (الفاتورة السابقة)", value: zatcaQuery.data.zatcaPih },
                    { label: "رقم تسلسلي (Counter)", value: zatcaQuery.data.zatcaInvoiceCounter?.toString() },
                  ].map(row => row.value ? (
                    <React.Fragment key={row.label}>
                      <div style={{ fontWeight: 700, color: "#6b7280", paddingLeft: 8 }}>{row.label}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1e293b", background: "#f8fafc", padding: "3px 8px", borderRadius: 4, wordBreak: "break-all" }}>{row.value}</div>
                    </React.Fragment>
                  ) : null)}
                  {!zatcaQuery.data.zatcaUuid && (
                    <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#9ca3af", padding: 20 }}>
                      لم تُرسَل الفاتورة بعد — اضغط "إرسال للهيئة" لبدء عملية التخليص
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {zatcaQuery.data.zatcaQrCode && (
                <div style={{ marginTop: 16, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>📱 QR Code الهيئة</div>
                  <img src={`data:image/png;base64,${zatcaQuery.data.zatcaQrCode}`} alt="ZATCA QR" style={{ width: 140, height: 140 }} />
                </div>
              )}

              {/* استجابة الهيئة */}
              {zatcaQuery.data.zatcaResponse && (
                <div style={{ marginTop: 16, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "10px 16px", fontWeight: 700, fontSize: 12, color: "#374151", borderBottom: "1px solid #e2e8f0" }}>
                    📋 استجابة الهيئة
                  </div>
                  <div style={{ padding: 14 }}>
                    <pre style={{ fontFamily: "monospace", fontSize: 10, background: "#1e293b", color: "#e2e8f0", borderRadius: 6, padding: "10px 14px", overflow: "auto", maxHeight: 200, margin: 0 }}>
                      {JSON.stringify(zatcaQuery.data.zatcaResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Lines Table ─────────────────────────────────────────────────── */}
      {activeMainTab === "invoice" && <div className="flex-1 overflow-hidden border-b border-[#b0a89a] flex flex-col">

      {/* جدول السطور (يمين) */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "#DAD271", color: "#4A3800" }}>
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
          <tbody data-nav-internal="true">
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
                    isStockItem={line.isStockItem}
                    onSelect={(name, code, id, unit, price, tax, itemType) => {
                      setLines(prev => {
                        const updated = [...prev];
                        const l = { ...updated[rowIdx], productName: name, productCode: code, productId: id, unit, unitPrice: price, taxPct: tax, isStockItem: itemType !== "service" };
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
                  {fmt(parseFloat(line.total) || 0)}
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

      </div>
      {/* زر إضافة سطر — خارج منطقة التمرير ليبقى ثابتاً */}
      <div className="px-2 py-1.5 border-t border-[#e8e4dc] bg-white flex-shrink-0">
        <button
          onClick={addLine}
          className="flex items-center gap-1 text-[11px] text-[#D19C05] hover:text-[#9A7203] hover:underline transition-colors"
        >
          <Plus className="w-3 h-3" />
          إضافة سطر جديد
          <span className="text-[#aaa] mr-1">(Enter في آخر سطر)</span>
        </button>
      </div>
      </div>}{/* end lines wrapper */}
      </div>{/* end left flex-col wrapper */}

      {/* ── لوحة الإجماليات (يسار) ──────────────────────────────────────── */}
      <div
        className="border-r border-[#b0a89a] overflow-y-auto flex-shrink-0"
        style={{ width: 320, minWidth: 320, background: "#F4F1EC" }}
      >
        {/* عنوان اللوحة — ثابت دائماً في الأعلى */}
        <div
          className="px-3 py-2 text-[11px] font-bold text-white text-center sticky top-0 z-10"
          style={{ background: "linear-gradient(to bottom, #D19C05, #B88904)" }}
        >
          ملخص الفاتورة
        </div>

        {/* صفوف الإجماليات */}
        <div className="px-3 py-3 gap-0 flex flex-col">

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

      {/* ── ERP Toolbar (أسفل الشاشة) ────────────────────────────────── */}
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
        onCancel={() => dirtyRequestClose(() => { setErpMode("view"); toast.info("تم الإلغاء"); })}
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
        onBrowse={() => {
          const ids = [...(allInvoicesQuery.data ?? [])].sort((a, b) => a.id - b.id).map(i => i.id);
          if (navInvoiceId) {
            setErpMode("view");
          } else if (ids.length) {
            setNavInvoiceId(ids[ids.length - 1]);
            setErpMode("view");
          } else {
            toast.info("لا توجد فواتير محفوظة بعد");
          }
        }}
        onClose={() => toast.info("إغلاق")}
        enableShortcuts
      />

      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        .classic-input {
          border: 1px solid #a0a0a0;
          padding: 2px 5px;
          height: 24px;
          font-size: 12px;
          font-family: 'Cairo', Tahoma, Arial, sans-serif;
          background: #fff;
          outline: none;
          border-radius: 2px;
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
          height: 27px;
          vertical-align: middle;
        }
        .inv-cell {
          border: none;
          outline: none;
          padding: 2px 4px;
          height: 25px;
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
        select.classic-input {
          padding: 1px 4px;
          height: 24px;
          cursor: pointer;
        }
        .inv-th {
          padding: 5px 6px;
        }
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
          templateConfig={templateConfig}
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
            sellerNameEn: orgQuery.data?.nameEn ?? undefined,
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

      <UnsavedChangesDialog
        open={dirtyConfirmOpen}
        onSave={() => dirtyConfirmSave(handleSave)}
        onDiscard={dirtyConfirmDiscard}
        onCancel={dirtyConfirmCancel}
        isSaving={createMutation.isPending}
      />
    </div>
  );
}

// ─── HF: Header Field ─────────────────────────────────────────────────────────
function HF({ label, children, labelW }: { label: string; children: React.ReactNode; labelW?: number }) {
  return (
    <div className="flex flex-row items-center gap-1.5">
      <label style={{ fontSize: "10px", fontWeight: 700, color: "#666", fontFamily: "'Cairo', Tahoma", whiteSpace: "nowrap", flexShrink: 0, ...(labelW ? { minWidth: labelW, display: "inline-block" } : {}) }}>
        {label}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
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
  rowIdx, value, products, cellRefs, onSelect, onKeyDown, onFocus, isStockItem,
}: {
  rowIdx: number;
  value: string;
  products: any[];
  cellRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  onSelect: (name: string, code: string, id: number, unit: string, price: string, tax: string, itemType: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  isStockItem?: boolean;
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
    onSelect(p.name, p.sku ?? p.barcode ?? p.code ?? "", p.id, p.unit ?? "", p.salePrice ? String(p.salePrice) : "", p.taxRate ? String(p.taxRate) : "0", p.itemType ?? "stock");
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
        data-no-desktop-field
        value={search}
        onChange={e => { if (!isStockItem) handleChange(e.target.value); }}
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
        placeholder={isStockItem ? "" : "اسم الصنف..."}
        autoComplete="off"
        readOnly={isStockItem}
        title={isStockItem ? "اسم الصنف المخزني لا يمكن تعديله" : undefined}
        style={isStockItem ? { background: "#f5f5f3", color: "#555", cursor: "default" } : undefined}
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
