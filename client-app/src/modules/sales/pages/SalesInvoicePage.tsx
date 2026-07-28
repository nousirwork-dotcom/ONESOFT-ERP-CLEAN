/**
 * SalesInvoicePage.tsx — فاتورة مبيعات احترافية
 * تصميم ERP كثيف (NamaSoft / Dynamics / Oracle Forms)
 * - ترقيم تسلسلي تلقائي: INV-YYYY-XXXXXX
 * - نوع السند: نقدًا / آجل مع حساب المدفوع والمتبقي
 * - حفظ كامل مع Validation وتوست احترافي
 * - تنقل Tab/Enter بين خلايا الجدول
 * - بحث الأصناف بالاسم أو الكود
 */
import React, { useState, useRef, useCallback, useEffect, useMemo, KeyboardEvent } from "react";
import { clearBranchDependentFields } from "@/lib/invoiceBranchLogic";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import { useRegisterCommands } from "@/components/unified-toolbar/useRegisterCommands";
import type { CommandHandlers, ScreenState } from "@/components/unified-toolbar/useRegisterCommands";
import { useDocumentNavigation } from "@/components/unified-toolbar/useDocumentNavigation";
type ERPMode = "view" | "new" | "edit" | "search";
import PostingPreviewModal from "@/shared/components/PostingPreviewModal";
import InvoicePrintModal from "@/shared/components/InvoicePrintModal";
import SendDocumentPanel from "@/shared/components/SendDocumentPanel";
import PaymentModal from "@/shared/components/PaymentModal";
import { PrintEngine } from "@/shared/lib/print";
import { usePrintTemplate } from "@/shared/hooks/usePrintTemplate";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import BasedOnDocInput from "@/shared/components/BasedOnDocInput";
import ContextSelectInput from "@/shared/components/ContextSelectInput";
import { InvoiceTableColgroup } from "@/components/responsive-layout";
import QRCode from "qrcode";
import styles from "@/components/responsive-layout/ResponsiveLayout.module.css";

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

function fieldsExcludedFromHeader(el: HTMLElement): boolean {
  return !!el.closest("[data-global-keyboard], [data-no-desktop-field]");
}

function focusHeaderField(field: HTMLElement, backwards: boolean): void {
  if (field.matches("[data-date-field]")) {
    const parts = Array.from(field.querySelectorAll<HTMLInputElement>("input:not([disabled])"));
    (backwards ? parts.at(-1) : parts[0])?.focus();
    return;
  }
  field.focus();
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

// ─── تنبيه صوتي قصير عند إدخال صنف غير مسجل ─────────────────────────────────────
function playProductBeep() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 150);
  } catch {
    // ignore audio errors
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SalesInvoicePage({ initialInvoiceId, onDocTypeChange, onClose, registerClose }: { initialInvoiceId?: number; onDocTypeChange?: (name: string) => void; onClose?: () => void; registerClose?: (requestClose: () => void) => void } = {}) {
  const { isAr } = useLang();
  const { user: currentUser } = useAuth();
  const canChangeSeller = useMemo(() =>
    currentUser?.role === "admin" || currentUser?.role === "superadmin",
    [currentUser?.role]
  );

  // ── نمط موحد لجميع تسميات رأس الفاتورة ───────────────────────────────────
  const headerLabelStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    color: "#555",
    width: 70,
    minWidth: 70,
    textAlign: "right",
    padding: 0,
    margin: 0,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  const compactHeaderLabelStyle: React.CSSProperties = {
    ...headerLabelStyle,
    width: 42,
    minWidth: 42,
  };
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
  const [warehouseDisplayName, setWarehouseDisplayName] = useState<string>(""); // اسم المخزن المحفوظ (للعرض قبل تحميل قائمة المخازن)
  const [journalWarehouseId, setJournalWarehouseId] = useState<number | null>(null); // مخزن مقيَّد من الدفتر
  const [docTypeWarehouseId, setDocTypeWarehouseId] = useState<number | null>(null); // مخزن مقيَّد من نوع السند
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [invoiceStatus, setInvoiceStatus] = useState<"draft" | "confirmed" | "paid" | "cancelled">("draft");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPayInvoiceId, setPendingPayInvoiceId] = useState<number | null>(null);
  const [pendingPayInvoiceNumber, setPendingPayInvoiceNumber] = useState("");
  const [pendingPayTotal, setPendingPayTotal] = useState(0);
  const [docTypeId, setDocTypeId] = useState<string>("");
  const [currency, setCurrency] = useState("SAR");
  const [exchangeRate, setExchangeRate] = useState("1.000");
  // ── Warehouse / Branch (اختيار المخزن/الفرع أولاً — إلزامي) ────────────────
  const [branchOpen, setBranchOpen] = useState(false);
  // ── Seller (بائع من جدول المستخدمين) ──────────────────────────────────────
  const [sellerUserId, setSellerUserId] = useState<number | null>(null);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [basedOnType, setBasedOnType] = useState<'sale' | 'quote' | 'order' | 'transfer' | ''>('');
  const [basedOnNum, setBasedOnNum]   = useState("");
  const [basedOnTrigger, setBasedOnTrigger] = useState(""); // يُحرِّك جلب البيانات
  const [pendingSourceDoc, setPendingSourceDoc] = useState<any | null>(null); // مستند معلّق بانتظار تأكيد تغيير العميل
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
  const skipSaveToast = useRef(false);
  const pendingCreatePayloadRef = useRef<Parameters<typeof createMutation.mutate>[0] | null>(null);
  const workRootRef = useRef<HTMLDivElement>(null);

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
  const draftIdToFinalizeRef = useRef<number | null>(null);
  const skipUpdateToast = useRef(false);

  // ── مساعدو التنبيه والتركيز على حقل صنف غير مسجل ─────────────────────────────
  const focusAndSelectCell = useCallback((key: string) => {
    const el = cellRefs.current.get(key);
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
  }, []);

  const rejectInvalidProduct = useCallback((key: string) => {
    playProductBeep();
    toast.error("الصنف غير مسجل، يرجى اختيار صنف من القائمة.");
    focusAndSelectCell(key);
  }, [focusAndSelectCell]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const customersQuery   = trpc.customers.list.useQuery({});
  const warehousesQuery  = trpc.warehouses.list.useQuery();
  const productsQuery    = trpc.products.list.useQuery({});
  const journalsQuery    = trpc.documentJournals.list.useQuery({ docType: "sales_invoice" });
  const salespersonsQuery = trpc.users.listSalespersons.useQuery({ warehouseId: warehouseId ?? undefined });
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
      currency, sellerUserId, paymentType, paidAmountOverride, customerTaxNumber, customerType]);

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

  // تحديث اسم المخزن الظاهر عند تحميل قائمة المخازن أو تغير المخزن المختار
  useEffect(() => {
    if (!warehouseId) return;
    const wh = warehousesQuery.data?.find(w => w.id === warehouseId);
    if (wh?.name) setWarehouseDisplayName(wh.name);
  }, [warehouseId, warehousesQuery.data]);

  // تعيين البائع = المستخدم الحالي عند فتح فاتورة جديدة، فقط إذا كان مفعّلاً كبائع
  // مصدر التحقق: نفس حقل users.canBeSalesperson المستخدم في شاشة المستخدمين والـ Backend.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (erpMode !== "new") return;
    if (navInvoiceId || savedInvoiceId) return;
    if (sellerUserId) return;
    if (currentUser.canBeSalesperson) {
      setSellerUserId(currentUser.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.canBeSalesperson, erpMode, navInvoiceId, savedInvoiceId]);

  // تأكد من أن البائع المختار لا يزال مؤهلاً للمخزن/الفرع المختار
  useEffect(() => {
    if (erpMode === "view") return;
    if (!warehouseId) return;
    if (!sellerUserId) return;
    const sellers = salespersonsQuery.data ?? [];
    const currentIsValid = currentUser?.canBeSalesperson && sellers.some(s => s.id === currentUser.id);
    if (sellers.some(s => s.id === sellerUserId)) return; // البائع المختار مؤهل
    // البائع المختار غير مؤهل للفرع الحالي → حاول المستخدم الحالي، وإلا اتركه فارغاً
    if (currentIsValid) {
      setSellerUserId(currentUser.id);
    } else if (sellerUserId === currentUser?.id) {
      setSellerUserId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, salespersonsQuery.data, currentUser?.id, currentUser?.canBeSalesperson, erpMode]);

  // تطبيق بيانات مستند مصدر (داخلي — يُستدعى بعد التأكيد إن لزم)
  const applySourceDoc = (src: NonNullable<typeof basedOnQuery.data>) => {
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
  };

  // عند ورود بيانات المستند المصدر: تحقق من تعارض العميل ثم طبّق
  useEffect(() => {
    const src = basedOnQuery.data;
    if (!src) return;
    // إذا كان هناك عميل حالي مختلف عن عميل المستند → انتظر التأكيد
    const hasCurrentCustomer = !!customerId || !!customerName.trim();
    const hasNewCustomer     = !!src.customerId || !!src.customerName;
    const customerConflict   = hasCurrentCustomer && hasNewCustomer &&
                               (src.customerId !== customerId || src.customerName !== customerName);
    if (customerConflict) {
      setPendingSourceDoc(src);
      return;
    }
    applySourceDoc(src);
  }, [basedOnQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setWarehouseDisplayName(inv.warehouseName ?? "");
    setJournalId(inv.journalId ?? null);
    if (inv.docTypeId) setDocTypeId(String(inv.docTypeId));
    setCurrency(inv.currency ?? "SAR");
    setExchangeRate(inv.exchangeRate ?? "1.000");
    setPaymentType((inv.paymentMethod ?? "cash") as PaymentType);
    setSellerUserId((inv as any).sellerUserId ?? null);
    setNotes(inv.notes ?? "");
    setPaidAmountOverride(inv.paidAmount ?? "");
    setSavedInvoiceId(inv.id);
    setIsPosted(inv.isPosted ?? false);
    setInvoiceStatus((inv.status as any) ?? "draft");
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
      setSavedInvoiceId(data.id ?? null);
      setNavInvoiceId(data.id ?? null);
      setIsPosted(data.isPosted ?? false);
      setInvoiceNumber(data.invoiceNumber ?? invoiceNumber);
      setErpMode("view");
      // رسالة النجاح تُعرض هنا فقط للحفظ المباشر (آجل)؛ أما عند التأكيد من شاشة الدفع فالنافذة تُعرضها.
      if (!skipSaveToast.current) {
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
      }
      skipSaveToast.current = false;
      if (data.id) {
        pendingCreatePayloadRef.current = null;
      }
    },
    onError: (e) => {
      skipSaveToast.current = false;
      toast.error(`خطأ في الحفظ: ${e.message}`);
    },
  });

  const updateMutation = trpc.salesInvoices.update.useMutation({
    onSuccess: (data) => {
      if (skipUpdateToast.current) {
        skipUpdateToast.current = false;
        return; // شاشة الدفع تعرض رسالة النجاح بنفسها عند إتمام الدورة الكاملة
      }
      toast.success(`✓ تم تحديث المستند ${data.invoiceNumber ?? ""} بنجاح`, {
        description: `الإجمالي: ${fmt(netTotal)} ${currency}`,
        duration: 5000,
      });
      setInvoiceStatus("confirmed");
    },
    onError: (e) => {
      skipUpdateToast.current = false;
      toast.error(`خطأ في تحديث المستند: ${e.message}`);
    },
  });

  const requestWorkClose = useCallback(() => {
    if (createMutation.isPending || updateMutation.isPending || showPaymentModal) return;
    dirtyRequestClose(() => onClose?.());
  }, [createMutation.isPending, updateMutation.isPending, showPaymentModal, dirtyRequestClose, onClose]);

  useEffect(() => {
    registerClose?.(requestWorkClose);
  }, [registerClose, requestWorkClose]);

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
        const whName = warehousesQuery.data?.find(w => w.id === j.warehouseId)?.name ?? "";
        setWarehouseDisplayName(whName);
      } else {
        setJournalWarehouseId(null);
        setWarehouseDisplayName("");
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

  // تفعيل المخزن/الفرع المختار: مسح جميع البيانات التابعة وإنشاء أول سطر تلقائياً
  const doSelectWarehouse = useCallback(async (id: number) => {
    setWarehouseId(id);
    setBranchOpen(false);
    // مسح الحقول التابعة للمخزن/الفرع
    const cleared = clearBranchDependentFields({
      basedOnType:   basedOnType,
      basedOnNumber: basedOnNum,
      sellerUserId:  sellerUserId,
      lines:         lines,
    });
    setBasedOnType(cleared.basedOnType as typeof basedOnType);
    setBasedOnNum(cleared.basedOnNumber);
    setBasedOnTrigger('');
    setSellerUserId(cleared.sellerUserId);
    setLines(cleared.lines as typeof lines);
    setJournalId(null);
    setJournalWarehouseId(null);
    setDocTypeWarehouseId(null);
    setDocTypeId("");
    setCustomerId(null);
    setCustomerName("");
    setCustSearch("");
    setCustomerType('individual');
    setCustomerTaxNumber("");
    setPaidAmountOverride("");
    setPaymentBreakdown({});
    setInvoiceNumber("");
    // انتخاب دفتر فاتورة المبيعات المرتبط بالفرع تلقائياً
    const warehouseJournals = (journalsQuery.data ?? []).filter((j: any) => j.warehouseId === id && j.docType === "sales_invoice");
    if (warehouseJournals.length >= 1) {
      await handleJournalSelect(warehouseJournals[0].id);
    } else {
      toast.error("لا يوجد دفتر فاتورة مبيعات مرتبط بهذا الفرع");
    }
    // تعيين البائع = المستخدم الحالي فقط إذا كان مفعّلاً كبائع في إعدادات المستخدمين
    if (currentUser?.id && currentUser.canBeSalesperson) {
      setSellerUserId(currentUser.id);
    } else {
      setSellerUserId(null);
    }
    // إنشاء سطر أول فارغ وتفعيله + تركيز حقل كود الصنف
    setTimeout(() => {
      setLines([EMPTY_LINE()]);
      setSelectedLineIdx(0);
      // انتظار إعادة الرسم ثم تركيز حقل كود الصنف في السطر الأول
      requestAnimationFrame(() => {
        cellRefs.current.get("0-0")?.focus();
      });
    }, 0);
  }, [journalsQuery.data, handleJournalSelect, basedOnType, basedOnNum, sellerUserId, lines, currentUser?.id]);

  // اختيار المخزن/الفرع مع تأكيد عند وجود بيانات مدخلة
  // إلغاء تحديد الفرع ومسح جميع البيانات التابعة
  const handleClearWarehouse = useCallback(() => {
    setWarehouseId(null);
    setBranchOpen(false);
    setJournalId(null);
    setJournalWarehouseId(null);
    setDocTypeWarehouseId(null);
    setDocTypeId("");
    setCustomerId(null);
    setCustomerName("");
    setCustSearch("");
    setCustomerType('individual');
    setCustomerTaxNumber("");
    setBasedOnType('');
    setBasedOnNum('');
    setBasedOnTrigger('');
    setSellerUserId(null);
    setLines([]);
    setInvoiceNumber("");
    setPaidAmountOverride("");
    setPaymentBreakdown({});
    setSellerUserId(null);
  }, []);

  const handleWarehouseSelect = useCallback((id: number) => {
    if (id === warehouseId) { setBranchOpen(false); return; }
    // تغيير الفرع مباشرة بدون تأكيد — مع مسح البيانات التابعة
    void doSelectWarehouse(id);
  }, [warehouseId, doSelectWarehouse]);

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
    if (!code.trim()) {
      // مسح الصنف المختار يُمسح كل بيانات السطر
      setLines(prev => {
        const updated = [...prev];
        updated[idx] = { ...EMPTY_LINE(), id: updated[idx].id };
        return updated;
      });
      return;
    }
    const found = (productsQuery.data ?? []).find(
      (p: any) => p.code === code || p.barcode === code || String(p.id) === code
    );
    if (found) {
      const isStock = (found as any).itemType !== "service";
      setLines(prev => {
        const updated = [...prev];
        const l = { ...updated[idx] };
        l.productCode = found.code ?? found.barcode ?? code;
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
        updated[idx] = { ...updated[idx], productId: undefined, isStockItem: undefined, productName: "", unit: "", unitPrice: "", taxPct: "0", total: "0" };
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
          const currentLine = lines[rowIdx];
          const isEmpty = !currentLine?.productId &&
            !currentLine?.productCode.trim() &&
            !currentLine?.productName.trim();
          if (isEmpty) return;
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

  // ── التحقق من اختيار صنف مسجل في حقل الكود عند Enter/Tab/Blur ─────────────────
  const handleProductCodeKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    const line = lines[idx];
    const code = line?.productCode?.trim() ?? "";
    const key = `${idx}-0`;

    // Enter/Tab: اختيار تلقائي إذا كان الكود مطابقًا لصنف مسجل
    if ((e.key === "Enter" || e.key === "Tab") && code) {
      const found = (productsQuery.data ?? []).find(
        (p: any) => p.code === code || p.barcode === code || String(p.id) === code
      );
      if (found) {
        e.preventDefault();
        handleProductCodeChange(idx, code);
        requestAnimationFrame(() => cellRefs.current.get(`${idx}-2`)?.focus());
      } else {
        e.preventDefault();
        rejectInvalidProduct(key);
      }
      return;
    }

    // منع الانتقال من حقل كود الصنف إذا كان النص غير مسجل
    if ((e.key === "Enter" || e.key === "Tab") && !line?.productId && !code) {
      e.preventDefault();
      rejectInvalidProduct(key);
      return;
    }

    handleCellKeyDown(e, idx, 0);
  }, [lines, productsQuery.data, handleCellKeyDown, handleProductCodeChange, rejectInvalidProduct]);

  // ── التحقق من مغادرة حقل كود الصنف بدون اختيار صنف مسجل ──────────────────────
  const handleProductCodeBlur = useCallback((idx: number) => {
    const line = lines[idx];
    if (!line) return;
    const key = `${idx}-0`;
    if (!line.productId && line.productCode.trim()) {
      rejectInvalidProduct(key);
    }
  }, [lines, rejectInvalidProduct]);

  // ── Validation & Save ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const isDraftConversion = savedInvoiceId !== null && invoiceStatus === "draft";

    // فاتورة محفوظة نهائية سابقاً: فتح شاشة الدفع لتسجيل/إكمال الدفع
    if (savedInvoiceId && !isDraftConversion) {
      // الفاتورة النهائية موجودة بالفعل؛ حدّث دفع نفس السجل عند التأكيد فقط.
      // لا يوجد أي create هنا.
      setPendingPayInvoiceId(savedInvoiceId);
      setPendingPayInvoiceNumber(invoiceNumber);
      setPendingPayTotal(netTotal);
      setShowPaymentModal(true);
      return;
    }

    // Validation — throw on failure so the unsaved-changes guard stays open
    if (!journalId) {
      toast.error("يجب اختيار نوع السند قبل الحفظ");
      throw new Error("validation");
    }
    // رقم الفاتورة/المسودة يُولّد في الخادم للمستندات الجديدة؛ للمسودات المحفوظة يُستخدم رقمها المسجّل
    if (savedInvoiceId && invoiceStatus !== "draft" && !invoiceNumber.trim()) {
      toast.error("رقم الفاتورة مطلوب");
      throw new Error("validation");
    }
    const validLines = lines.filter(l => l.productName.trim() !== "" || l.productCode.trim() !== "");
    if (validLines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل في الفاتورة");
      throw new Error("validation");
    }
    // تحقق من أن جميع الأصناف مسجلة في النظام (لا يُقبل نص يدوي بدون productId)
    for (const l of validLines) {
      if (!l.productId) {
        toast.error("الصنف غير مسجل، يرجى اختيار صنف من القائمة.");
        throw new Error("validation");
      }
    }
    // تحقق من البائع: مؤهل للفرع/المخزن المختار ومتاح في قائمة البائعين
    if (sellerUserId && warehouseId) {
      const sellers = salespersonsQuery.data ?? [];
      if (!sellers.some(s => s.id === sellerUserId)) {
        toast.error("البائع المختار غير مُسنَد للفرع/المخزن المختار — اختر بائعاً مؤهلاً");
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
      if (selectedDocType.requireEmployeeCode && !sellerUserId) {
        toast.error("يجب اختيار البائع (مطلوب في نوع المستند المختار)");
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

    // ── التحقق من ربط الدفتر بالمخزن/الفرع قبل الحفظ ─────────────────────
    if (journalId) {
      const selectedJournal = (journalsQuery.data ?? []).find((j: any) => j.id === journalId);
      if (!selectedJournal) {
        toast.error("الدفتر المختار غير موجود — اختر فرعاً آخر");
        throw new Error("journal_missing");
      }
      if (!selectedJournal.warehouseId) {
        toast.error("دفتر فاتورة المبيعات غير مرتبط بمخزن/فرع — أكمل إعداد الدفتر أولاً");
        throw new Error("journal_no_warehouse");
      }
      if (selectedJournal.warehouseId !== warehouseId) {
        toast.error("دفتر الفرع لا يتوافق مع الفرع المختار — اختر الفرع المرتبط بالدفتر");
        throw new Error("journal_warehouse_mismatch");
      }
    }

    // الرقم التسلسلي يُحجَز داخل transaction الحفظ في الخادم؛ المعروض هنا مجرد معاينة
    const finalInvoiceNumber = invoiceNumber;

    const paid = paymentType === "cash" ? fmtDb(netTotal) : paymentType === "partial" ? fmtDb(paidAmount) : fmtDb(paidAmount);
    const remaining = paymentType === "cash" ? "0.0000" : fmtDb(remainingAmount);
    const payMethod = paymentType === "cash" ? "cash" : "credit";
    const status = paymentType === "cash" ? "paid" : (remainingAmount <= 0 ? "paid" : "confirmed");

    if (!warehouseId) { toast.error("يجب اختيار الفرع / المخزن أولاً"); throw new Error("validation"); }
    const payload = {
      invoiceNumber: finalInvoiceNumber,
      invoiceType: "sale" as const,
      invoiceDate,
      dueDate: dueDate || undefined,
      sellerUserId: sellerUserId ?? undefined,
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
      basedOnType: basedOnType || undefined,
      basedOnNumber: basedOnTrigger || undefined,
      sourceDocumentId: basedOnQuery.data && basedOnQuery.data.sourceType !== 'transfer' ? (basedOnQuery.data as any).id ?? undefined : undefined,
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

    // تحويل مسودة إلى مستند نهائي
    if (isDraftConversion) {
      const { invoiceType: _invoiceType, ...basePayload } = payload;

      // جميع طرق الدفع تمر من شاشة الدفع؛ لا يُكتب أي شيء في DB قبل التأكيد.
      // يُستخدم نفس recordId عند تأكيد تحويل المسودة.
      draftIdToFinalizeRef.current = savedInvoiceId;
      pendingCreatePayloadRef.current = { ...basePayload } as any;
      // null يجعل PaymentModal يستدعي onSaveFirst عند التأكيد؛
      // saveForPayment سيستخدم draftIdToFinalizeRef لتحديث نفس المسودة.
      setPendingPayInvoiceId(null);
      setPendingPayInvoiceNumber(invoiceNumber);
      setPendingPayTotal(netTotal);
      setShowPaymentModal(true);
      return;
    }

    // افتح شاشة الدفع أولاً؛ الإنشاء النهائي يتم داخل saveForPayment عند التأكيد فقط.
    pendingCreatePayloadRef.current = payload;
    setPendingPayInvoiceId(null);
    setPendingPayInvoiceNumber(invoiceNumber);
    setPendingPayTotal(netTotal);
    setShowPaymentModal(true);
  }, [
    invoiceNumber, invoiceDate, dueDate, customerId, customerName,
    sellerUserId,
    customerType, customerTaxNumber,
    warehouseId, currency, exchangeRate, paymentType, paidAmount,
    remainingAmount, notes, lines, subtotal, totalDiscount, totalTax,
    netTotal, createMutation, journalId,
    docTypeId, docTypesQuery.data, stockQuery.data, basedOnQuery.data,
  ]);

  // ── Save For Payment (حفظ الفاتورة من شاشة الدفع) ────────────────────────
  // يُستخدم payload المُعدّ مسبقاً من handleSave؛ التحقق من البيانات تم قبل فتح النافذة.
  const saveForPayment = useCallback(async (breakdown: Record<string, number>): Promise<number | null> => {
    const paid = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const remaining = Math.max(0, netTotal - paid);
    const isFullPaid = paid >= netTotal - 0.005;

    // ── مسار المسودة: حوّل المسودة وسجّل الدفع معاً داخل transaction واحدة ──────
    if (draftIdToFinalizeRef.current !== null) {
      const draftId = draftIdToFinalizeRef.current;
      const payload = pendingCreatePayloadRef.current;
      if (!payload) { toast.error("لا توجد بيانات فاتورة جاهزة للحفظ"); return null; }
      try {
        skipUpdateToast.current = true;
        const data = await updateMutation.mutateAsync({
          id: draftId,
          ...(payload as any),
          paidAmount: paid.toFixed(4),
          remainingAmount: remaining.toFixed(4),
          paymentMethod: "cash" as any,
          status: (isFullPaid ? "paid" : "confirmed") as any,
          paymentBreakdown: breakdown,
        });
        draftIdToFinalizeRef.current = null;
        pendingCreatePayloadRef.current = null;
        if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
        setInvoiceStatus(isFullPaid ? "paid" : "confirmed");
        setNavInvoiceId(draftId); // يُحفّز إعادة جلب بيانات الفاتورة المحدّثة
        return draftId;
      } catch (error) {
        skipUpdateToast.current = false;
        console.error("[sales.saveForPayment] draft conversion failed:", error);
        toast.error(`فشل تحويل المسودة: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }

    // ── مسار الفاتورة الجديدة: أنشئ الفاتورة مع تفاصيل الدفع في transaction واحدة ──
    const payload = pendingCreatePayloadRef.current;
    if (!payload) { toast.error("لا توجد بيانات فاتورة جاهزة للحفظ"); return null; }
    try {
      skipSaveToast.current = true;
      const data = await createMutation.mutateAsync({
        ...payload,
        paidAmount: paid.toFixed(4),
        remainingAmount: remaining.toFixed(4),
        paymentMethod: "cash" as any,
        status: (isFullPaid ? "paid" : "confirmed") as any,
        paymentBreakdown: breakdown,
      });
      return data.id ?? null;
    } catch (error) {
      skipSaveToast.current = false;
      console.error("[sales.saveForPayment] invoice creation failed:", error);
      toast.error(`فشل حفظ الفاتورة: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, [updateMutation, createMutation, netTotal]);

  // ── التحقق من أن الفاتورة الجديدة لا تحتوي على أي بيانات مُدخلة ──────────────
  const isInvoiceEmpty = useCallback(() => {
    const hasLine = lines.some(
      l => l.productId || l.productName.trim() || l.productCode.trim() || l.quantity !== "1" || l.unitPrice.trim()
    );
    return !hasLine && !customerName.trim() && !customerId && !warehouseId && !notes.trim() && !basedOnType && !basedOnNum;
  }, [lines, customerName, customerId, warehouseId, notes, basedOnType, basedOnNum]);

  // ── حفظ المسودة — يُستخدم من حوار التنقل عند وجود تعديلات غير محفوظة ────────
  const handleSaveDraft = useCallback(async () => {
    const validLines = lines.filter(l => l.productName.trim() !== "" || l.productCode.trim() !== "");
    if (validLines.length === 0) { toast.error("يجب إضافة صنف واحد على الأقل في المسودة"); return; }
    const payMethod = paymentType === "cash" ? "cash" : "credit";
    try {
      await createMutation.mutateAsync({
        invoiceNumber: "",
        invoiceType: "sale",
        invoiceDate,
        dueDate: dueDate || undefined,
        sellerUserId: sellerUserId ?? undefined,
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
        paidAmount: "0.0000",
        remainingAmount: fmtDb(netTotal),
        paymentMethod: payMethod as any,
        status: "draft",
        notes: notes || undefined,
        docTypeId: docTypeId ? parseInt(docTypeId) : undefined,
        basedOnType: basedOnType || undefined,
        basedOnNumber: basedOnTrigger || undefined,
        sourceDocumentId: basedOnQuery.data && basedOnQuery.data.sourceType !== 'transfer' ? (basedOnQuery.data as any).id ?? undefined : undefined,
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
      setInvoiceStatus("draft");
      toast.success("تم حفظ المسودة");
    } catch {
      throw new Error("draft-save-failed");
    }
  }, [
    invoiceDate, dueDate, customerId, customerName, sellerUserId,
    customerType, customerTaxNumber, warehouseId, currency, exchangeRate,
    paymentType, notes, lines, subtotal, totalDiscount, totalTax, netTotal,
    createMutation, journalId, docTypeId, basedOnType, basedOnTrigger, basedOnQuery.data,
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
    setSellerUserId(currentUser?.id ?? null);
    setPaidAmountOverride("");
    setExchangeRate("1.000");
    setErpMode("new");
    setJournalWarehouseId(null);
    setSavedInvoiceId(null);
    setNavInvoiceId(null);
    setIsPosted(false);
    setInvoiceStatus("draft");
    setPaymentBreakdown({});
    setShowPostingPreview(false);
    // إذا كان هناك دفتر محدد، أعد تطبيق مخزنه وعرض الرقم المتوقع
    if (journalId) {
      const j = (journalsQuery.data ?? []).find((x: any) => x.id === journalId);
      if (j?.warehouseId) {
        setWarehouseId(j.warehouseId);
        setJournalWarehouseId(j.warehouseId);
      }
      utils.documentJournals.previewNextNumber.fetch({ journalId }).then(preview => {
        if (preview) setInvoiceNumber(preview);
      }).catch(() => setInvoiceNumber(""));
    } else {
      setInvoiceNumber("");
    }
  }, [journalId, journalsQuery.data, utils]);

  // ── التنقل المركزي بين الفواتير المحفوظة ──────────────────────────────────────
  const {
    handlers: navHandlers,
    hasRecord: navHasRecord,
    hasPrevious: navHasPrevious,
    hasNext: navHasNext,
    showUnsavedDialog: navShowUnsavedDialog,
    unsavedDialogActions: navUnsavedDialogActions,
    isSavingDraft: navIsSavingDraft,
  } = useDocumentNavigation({
    records: (allInvoicesQuery.data ?? []).filter((i: any) => i.invoiceType === "sale"),
    currentId: navInvoiceId ?? savedInvoiceId,
    setCurrentId: id => setNavInvoiceId(id),
    isDirty,
    isEmpty: isInvoiceEmpty,
    saveAsDraft: handleSaveDraft,
    onBeforeNavigate: () => setErpMode("view" as ERPMode),
  });

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
          salesperson: sellerUserId ? ((salespersonsQuery.data ?? []).find(u => u.id === sellerUserId)?.name ?? undefined) : undefined,
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
  }, [invoiceNumber, invoiceDate, customerName, customerCode, customerTaxNumber, sellerUserId, salespersonsQuery.data,
      paymentType, currency, notes, lines, subtotal, totalDiscount, totalTax, netTotal,
      paidAmount, remainingAmount, orgQuery.data, qrSettingsQuery.data, templateConfig]);

  // ── Unified Toolbar ──────────────────────────────────────────────────────────
  const _sipRef = useRef<any>({});
  _sipRef.current = { erpMode, isDirty, savedInvoiceId, isPosted, handleNew, handleSave, handleSaveDraft, handleDelete, handleDuplicate, handleRepost, createMutation, unpostMutation, allInvoicesQuery, navInvoiceId, setNavInvoiceId, setErpMode, requestWorkClose, setShowPostingPreview, setShowPrintModal, setShowSendPanel, nextNumberQuery };

  // handlers مستقرة ([] deps) — جميع الوصولات عبر _sipRef.current
  const sipHandlers = useMemo<CommandHandlers>(() => ({
    save:      () => { _sipRef.current.handleSave(); },
    draft:     () => { _sipRef.current.handleSaveDraft(); },
    new:       () => { const s = _sipRef.current; s.handleNew(); s.setErpMode("new" as ERPMode); },
    duplicate: () => { _sipRef.current.handleDuplicate(); },
    edit:      () => { _sipRef.current.setErpMode("edit" as ERPMode); toast.info("وضع التعديل"); },
    delete:    () => { _sipRef.current.handleDelete(); },
    first:     navHandlers.first,
    previous:  navHandlers.previous,
    next:      navHandlers.next,
    last:      navHandlers.last,
    approve:   () => { toast.success("تم الاعتماد"); },
    unapprove: () => { const s = _sipRef.current; if (!s.savedInvoiceId) return; if (window.confirm("هل أنت متأكد من إلغاء ترحيل هذه الفاتورة؟")) s.unpostMutation.mutate({ invoiceId: s.savedInvoiceId }); },
    preview:   () => { const s = _sipRef.current; if (!s.savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً"); return; } s.setShowPostingPreview(true); },
    send:      () => { const s = _sipRef.current; if (!s.savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً قبل الإرسال"); return; } s.setShowSendPanel(true); },
    print:     () => { _sipRef.current.setShowPrintModal(true); },
    exit:      () => {
      _sipRef.current.requestWorkClose();
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // حالة الشاشة — تتغير مع كل تحديث حقيقي
  const sipState = useMemo<ScreenState>(() => ({
    mode: (erpMode === "search" ? "view" : erpMode) as ScreenState["mode"],
    isDirty,
    isSaveable: !createMutation.isPending && (erpMode === "new" || erpMode === "edit"),
    hasRecord:  navHasRecord,
    // التنقل مبني على وجود سجلات والموقع الحالي (يعمل حتى من فاتورة جديدة فارغة)
    hasPrevious: navHasPrevious,
    hasNext:     navHasNext,
    isApproved: isPosted,
    isBusy:     createMutation.isPending || updateMutation.isPending,
  }), [erpMode, isDirty, savedInvoiceId, isPosted, createMutation.isPending, updateMutation.isPending]);

  const toolbarTools = useMemo(() => {
    const hasSaved = savedInvoiceId !== null;
    return [
      { id: "post",        label: "ترحيل الفاتورة",        enabled: hasSaved && !isPosted,  disabledReason: !hasSaved ? "احفظ الفاتورة أولًا" : isPosted ? "الفاتورة مرحّلة بالفعل" : undefined, onClick: () => { const s = _sipRef.current; if (!s.savedInvoiceId) { toast.warning("يجب حفظ الفاتورة أولاً"); return; } s.setShowPostingPreview(true); } },
      { id: "unpost",      label: "إلغاء ترحيل الفاتورة",  enabled: hasSaved && isPosted,   disabledReason: !isPosted ? "الفاتورة غير مرحّلة" : undefined, onClick: () => { const s = _sipRef.current; if (!s.savedInvoiceId) return; if (window.confirm("هل أنت متأكد من إلغاء ترحيل هذه الفاتورة؟")) s.unpostMutation.mutate({ invoiceId: s.savedInvoiceId }); } },
      { id: "repost",      label: "إعادة الترحيل",          enabled: hasSaved && isPosted,   disabledReason: !isPosted ? "الفاتورة غير مرحّلة" : undefined, onClick: () => _sipRef.current.handleRepost() },
      { id: "suspend",     label: "تعليق الترحيل",          enabled: false, disabledReason: "قريباً" },
      { id: "activity",    label: "نشاط المستخدمين", separatorBefore: true as const, enabled: false, disabledReason: "قريباً" },
      { id: "attachments", label: "إرفاق المستندات",         enabled: false, disabledReason: "قريباً" },
    ];
  }, [savedInvoiceId, isPosted]);

  useRegisterCommands(sipHandlers, sipState, toolbarTools);

  // ─── Render ───────────────────────────────────────────────────────────────
  const handleWorkKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["Enter", "Tab"].includes(e.key) || e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-line-item]")) return;

    // التاريخ مكوّن داخلي من عدة inputs، لكنه حقل واحد في تنقل رأس الفاتورة.
    const current = target.closest<HTMLElement>("[data-date-field], [data-enter-nav]") ??
      (target.matches("input:not([disabled]):not([readonly]), textarea:not([disabled])") ? target : null);
    if (!current) return;

    e.preventDefault();
    e.stopPropagation();

    const fields = Array.from(
      workRootRef.current?.querySelectorAll<HTMLElement>(
        "[data-date-field], [data-enter-nav], input:not([disabled]):not([readonly]):not([data-date-segment]), textarea:not([disabled])"
      ) ?? []
    ).filter(el =>
      el.offsetParent !== null &&
      el.tabIndex !== -1 &&
      !(el as HTMLButtonElement).disabled &&
      !el.closest("[data-line-item]") &&
      !fieldsExcludedFromHeader(el)
    );
    const index = fields.indexOf(current);
    if (index < 0) return;
    const direction = e.key === "Tab" && e.shiftKey ? -1 : 1;
    const next = fields[index + direction];
    if (next) focusHeaderField(next, direction < 0);
  }, []);

  return (
    <div
      ref={workRootRef}
      onKeyDownCapture={handleWorkKeyDown}
      className={`${styles.screenContainer} flex flex-col h-full text-[#1a1a1a] select-none`}
      style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: "var(--work-font-size, 12px)", background: "var(--background)" }}
      dir="rtl"
    >
      {/* ── Main Content: outer flex row (left-col + summary) ──────────── */}
      <div className="flex-1 flex overflow-hidden" dir="rtl">
      <div className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: 1400, marginInline: "auto", width: "100%" }}>

      {/* ── Header Form ─────────────────────────────────────────────────── */}
      <div className="border-b border-[#b0a89a] px-3 pt-2 pb-2" style={{ background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
        {/* ثوابت مشتركة لجميع الحقول — ارتفاع موحد 26px + عرض label موحد */}
        <div className={styles.formGrid} style={{ columnGap: 10, rowGap: 5, alignItems: "center" }}>

          {/* ══ صف 1 (من اليمين): الفرع ← رقم الفاتورة ← بناءً على ══ */}

          {/* col 1 (يمين): الفرع — أول حقل إلزامي ══ */}
          {(() => {
            const whs = warehousesQuery.data ?? [];
            const selWh = whs.find((w: any) => w.id === warehouseId);
            const wName = (w: any): string => isAr ? (w.name ?? w.nameEn ?? "") : (w.nameEn || (w.name ?? ""));
            return (
              <div className="flex items-center w-full min-w-0 relative" style={{ gap: 3 }}>
                <label style={compactHeaderLabelStyle}>
                  {isAr ? "الفـــــــرع" : "Branch"}
                </label>
                <div className="flex relative flex-1 min-w-0" style={{ height: "var(--work-field-h, 26px)" }}>
                  <button
                    data-enter-nav="true"
                    onClick={() => { if (erpMode !== "view") setBranchOpen(o => !o); }}
                    disabled={erpMode === "view"}
                    className="flex items-center gap-1 classic-input"
                    style={{
                      height: "var(--work-field-h, 26px)", flex: 1, minWidth: 120, paddingInline: "6px 4px",
                      background: selWh ? "#f0fff4" : "#fff8e1",
                      border: `2px solid ${selWh ? "#22c55e" : "#f59e0b"}`,
                      borderRadius: "4px 0 0 4px", borderInlineEnd: "none",
                      color: selWh ? "#15803d" : "#b45309", fontSize: "11px", fontWeight: 700,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                    title={selWh ? wName(selWh) : "اختر الفرع (مطلوب)"}
                  >
                    <span className="flex-1 truncate text-start">
                      {selWh ? wName(selWh) : "⚠ اختر الفرع"}
                    </span>
                  </button>
                  <button
                    onClick={() => { if (erpMode !== "view") setBranchOpen(o => !o); }}
                    disabled={erpMode === "view"}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "18px", height: "var(--work-field-h, 26px)", borderRadius: "0 4px 4px 0", background: selWh ? "#22c55e" : "#f59e0b", border: `2px solid ${selWh ? "#16a34a" : "#d97706"}`, borderInlineStart: "none", color: "white", fontSize: "9px" }}
                  >▼</button>

                  {branchOpen && (<>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setBranchOpen(false)} />
                    <div className="absolute top-full z-[9999] mt-1 bg-white rounded-lg overflow-hidden" style={{ insetInlineStart: 0, minWidth: 240, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0" }} dir={isAr ? "rtl" : "ltr"}>
                      <div className="flex items-center justify-between px-3 py-2" style={{ background: "#166534" }}>
                        <span className="text-white text-[11px] font-bold">اختر الفرع</span>
                        <button onClick={() => setBranchOpen(false)} style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>✕</button>
                      </div>
                      {whs.length === 0 ? (
                        <div className="px-4 py-5 text-center text-[11px] text-slate-500">لا توجد فروع مُعرَّفة</div>
                      ) : (
                        <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                          {/* زر إلغاء التحديد — يظهر فقط عند وجود فرع مختار */}
                          {selWh && (
                            <button onClick={() => { handleClearWarehouse(); }} className="w-full flex items-center transition-colors" style={{ textAlign: isAr ? "right" : "left", background: "#FEF2F2", borderBottom: "1px solid #fecaca", padding: "7px 12px" }}>
                              <span style={{ width: 16, color: "#ef4444", fontSize: "11px", flexShrink: 0 }}>✕</span>
                              <div className="flex-1 min-w-0 mx-2">
                                <div className="text-[12px] font-bold truncate" style={{ color: "#dc2626" }}>إلغاء تحديد الفرع</div>
                              </div>
                            </button>
                          )}
                          {whs.map((w: any, idx: number) => {
                            const isSel = w.id === warehouseId;
                            return (
                              <button key={w.id} onClick={() => handleWarehouseSelect(w.id)} className="w-full flex items-center transition-colors" style={{ textAlign: isAr ? "right" : "left", background: isSel ? "#f0fff4" : idx % 2 === 0 ? "#fafafa" : "white", borderBottom: "1px solid #f1f5f9", padding: "7px 12px" }}>
                                <span style={{ width: 16, color: isSel ? "#22c55e" : "transparent", fontSize: "11px", flexShrink: 0 }}>✓</span>
                                <div className="flex-1 min-w-0 mx-2">
                                  <div className="text-[12px] font-semibold truncate" style={{ color: isSel ? "#15803d" : "#1e293b" }}>{wName(w)}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>)}
                </div>
              </div>
            );
          })()}

          {/* col 2: رقم الفاتورة — ملاصق للفرع مباشرة */}
          <div className="flex items-center justify-center" style={{ gap: 4 }}>
            <label style={{ ...headerLabelStyle, color: "#D19C05" }}>
              {isAr ? "رقم الفاتورة" : "Invoice No."}
            </label>
            <input
              value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              className="classic-input text-center font-bold"
              style={{ width: "128px", height: "var(--work-field-h, 26px)", background: journalId ? "#eff6ff" : !warehouseId ? "#f3f4f6" : "#FFFDE7", borderColor: journalId ? "#3b82f6" : "#F59E0B", borderRadius: "4px", color: !warehouseId ? "#9ca3af" : "#1a1a1a", fontSize: "13px", fontWeight: 700 }}
              readOnly={!!journalId || !warehouseId}
              title={!warehouseId ? "اختر الفرع أولاً" : "رقم الفاتورة التسلسلي"}
            />
            {savedInvoiceId !== null && invoiceStatus === "draft" && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ background: "#F59E0B", color: "#fff" }}
              >
                مسودة
              </span>
            )}
          </div>

          {/* col 3-4: بناءً على */}
          <div className="flex items-center w-full min-w-0" style={{ gap: 3, gridColumn: "3/5" }}>
            <label style={compactHeaderLabelStyle}>بناءً على</label>
            <div className="flex flex-1 min-w-0" style={{ gap: 6 }}>
              <div style={{ flexShrink: 0, width: 120, display: "flex" }}>
                <ContextSelectInput
                  value={basedOnType}
                  onChange={v => { if (!warehouseId) { return; } setBasedOnType(v as any); setBasedOnNum(''); setBasedOnTrigger(''); }}
                  options={[
                    { value: "order",    label: "أمر بيع" },
                    { value: "quote",    label: "عرض أسعار" },
                    { value: "transfer", label: "تحويل داخلي" },
                    { value: "sale",     label: "فاتورة مبيعات" },
                  ]}
                  menuTitle="نوع المستند المصدر"
                  placeholder={!warehouseId ? "— —" : "النوع ⊞"}
                  disabled={!warehouseId || erpMode === "view"}
                  style={{ height: "var(--work-field-h, 26px)" }}
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
                disabled={!warehouseId || erpMode === "view"}
              />
            </div>
          </div>

          {/* col 1-3: العميل */}
          <div className="flex items-center" ref={custDropRef} style={{ gap: 3, gridColumn: "1/4", position: "relative" }}>
            <label style={compactHeaderLabelStyle}>العميل</label>
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
                        height: "var(--work-field-h, 26px)",
                        cursor: customerLocked ? "not-allowed" : customerId ? "pointer" : "text",
                        background: customerLocked ? "#f3f4f6" : undefined,
                        paddingLeft: customerId && !customerLocked ? 20 : undefined,
                      }}
                      title={customerId && !customerLocked ? "انقر لتغيير العميل" : undefined}
                    />
                    {/* زر مسح العميل — يظهر فقط قبل الحفظ */}
                    {customerId && !customerLocked && (
                      <button type="button" onClick={clearCustomer}
                        style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", color: "#ef4444", fontSize: "var(--work-font-size, 12px)", lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: "0 2px", zIndex: 2 }}
                        title="تغيير العميل">✕</button>
                    )}
                    {customerId && (
                      <div className="flex items-center flex-shrink-0 px-1.5 rounded text-[10px] font-bold" style={{ height: "var(--work-field-h, 26px)", background: customerType === 'organization' ? '#EFF6FF' : '#F0FDF4', border: `1px solid ${customerType === 'organization' ? '#93C5FD' : '#86EFAC'}`, color: customerType === 'organization' ? '#1D4ED8' : '#15803D' }}>
                        {customerType === 'organization' ? '🏢' : '👤'}
                      </div>
                    )}
                  </>
                );
              })()}
              <button type="button"
                onClick={() => { if (!(savedInvoiceId || isPosted) && !customerId) { setCustSearch(""); setShowCustDrop(v => !v); } }}
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: "var(--work-field-h, 26px)", height: "var(--work-field-h, 26px)", borderRadius: 3, background: (savedInvoiceId || isPosted) ? "#9ca3af" : "#6B7280", color: "white", fontSize: "11px", border: "1px solid #4B5563", cursor: (savedInvoiceId || isPosted) ? "not-allowed" : "pointer" }}>▾</button>
              <button type="button"
                onClick={async () => {
                  setNewCustName(custSearch.trim()); setNewCustCode(""); setNewCustPhone(""); setNewCustEmail(""); setNewCustAddr("");
                  setNewCustType('individual'); setNewCustTaxNum(""); setNewCustRegNum("");
                  setNewCustShortAddr(""); setNewCustBuilding(""); setNewCustAdditional(""); setNewCustPostal(""); setNewCustCity("");
                  if (journalCustomersJournalId) { try { const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: journalCustomersJournalId }); if (preview) setNewCustCode(preview); } catch {} }
                  setShowAddCustomer(true); setShowCustDrop(false);
                }}
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: "var(--work-field-h, 26px)", height: "var(--work-field-h, 26px)", borderRadius: 3, background: "#D19C05", color: "white", fontSize: "15px", fontWeight: 700, border: "1px solid #9A7203" }}
                title="إضافة عميل جديد">+</button>
              {customerId && (
                <div className="flex items-center flex-shrink-0 px-2 rounded text-[10px] font-bold whitespace-nowrap"
                  style={{
                    height: "var(--work-field-h, 26px)",
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
                        <span style={{ fontSize: "13px" }}>{(c as any).customerType === 'organization' ? '🏢' : '👤'}</span>
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

          {/* col 4: العملة — بجانب العميل، والبائع تحتها */}
          <div className="flex items-center w-full min-w-0" style={{ gap: 3, gridColumn: "4" }}>
            <label style={compactHeaderLabelStyle}>العملة</label>
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
              style={{ height: "var(--work-field-h, 26px)", flex: 1, minWidth: 0, width: "100%" }}
            />
          </div>

          {/* col 1: المخزن */}
          <div className="flex items-center" style={{ gap: 3, gridColumn: "1" }}>
            <label style={compactHeaderLabelStyle}>المخزن</label>
            {(() => {
              const activeWh = journalWarehouseId ?? docTypeWarehouseId ?? warehouseId;
              const whFromList = warehousesQuery.data?.find(w => w.id === activeWh);
              const whName = whFromList?.name ?? warehouseDisplayName ?? "";
              const whOptions = activeWh ? [{ value: String(activeWh), label: whName }] : [];
              return (
                <ContextSelectInput
                  value={warehouseId ? String(warehouseId) : ""}
                  onChange={() => {}}
                  options={whOptions}
                  menuTitle="المخزن"
                  placeholder={activeWh ? "يُحدَّد من الفرع" : "اختر الفرع أولاً"}
                  disabled={true}
                  title={activeWh ? `المخزن: ${whName}` : "اختر الفرع أولاً"}
                   style={{ height: "var(--work-field-h, 26px)", flex: 1, minWidth: 0 }}
                />
              );
            })()}
          </div>

          {/* col 2: تاريخ التحرير — حاوية موحدة بحد واحد */}
          <div className="flex items-center w-full min-w-0" style={{ gap: 3, gridColumn: "2" }}>
            <label style={compactHeaderLabelStyle}>تاريخ التحرير</label>
            <div data-date-field className="flex min-w-0" style={{ flex: "0 0 112px", width: 112, transform: "translateX(-5px)", height: "var(--work-field-h, 26px)", border: "1px solid #d1d5db", borderRadius: 4, overflow: "hidden" }}>
              <DateSegmentInput value={invoiceDate} onChange={setInvoiceDate} style={{ flex: 1, minWidth: 0, width: "100%", height: "var(--work-field-h, 26px)", border: "none", borderRadius: 0, justifyContent: "center", textAlign: "center", paddingInline: 2 }} />
              <button type="button" onClick={() => invoiceDatePickerRef.current?.showPicker()} className="flex items-center justify-center flex-shrink-0" style={{ height: "var(--work-field-h, 26px)", width: "26px", background: "#f3f4f6", border: "none", borderInlineStart: "1px solid #d1d5db", color: "#555", cursor: "pointer", fontSize: "var(--work-font-size, 12px)" }}>📅</button>
              <input ref={invoiceDatePickerRef} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} tabIndex={-1} aria-hidden="true" />
            </div>
          </div>

          {/* col 3: تاريخ الدفع — حاوية موحدة بحد واحد */}
          <div className="flex items-center w-full min-w-0" style={{ gap: 3, gridColumn: "3" }}>
            <label style={compactHeaderLabelStyle}>تاريخ الدفع</label>
            <div data-date-field className="flex min-w-0" style={{ flex: "0 0 112px", width: 112, transform: "translateX(-5px)", height: "var(--work-field-h, 26px)", border: "1px solid #d1d5db", borderRadius: 4, overflow: "hidden" }}>
              <DateSegmentInput value={dueDate} onChange={setDueDate} style={{ flex: 1, minWidth: 0, width: "100%", height: "var(--work-field-h, 26px)", border: "none", borderRadius: 0, justifyContent: "center", textAlign: "center", paddingInline: 2 }} />
              <button type="button" onClick={() => dueDatePickerRef.current?.showPicker()} className="flex items-center justify-center flex-shrink-0" style={{ height: "var(--work-field-h, 26px)", width: "26px", background: "#f3f4f6", border: "none", borderInlineStart: "1px solid #d1d5db", color: "#555", cursor: "pointer", fontSize: "var(--work-font-size, 12px)" }}>📅</button>
              <input ref={dueDatePickerRef} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} tabIndex={-1} aria-hidden="true" />
            </div>
          </div>

          {/* col 4: البائع — تلقائيًا = المستخدم الحالي؛ يمكن تغييره فقط للمدير */}
          {(() => {
            const sellers = salespersonsQuery.data ?? [];
            const sellerObj = sellers.find(s => s.id === sellerUserId) ?? (currentUser && sellerUserId === currentUser.id ? currentUser : null);
            const sellerName = sellerObj ? (sellerObj.name || sellerObj.username) : (currentUser?.name || currentUser?.username || "");
            const sellerDisabled = !warehouseId || erpMode === "view" || !canChangeSeller;
            return (
              <div className="flex items-center relative w-full min-w-0" style={{ gap: 3, gridColumn: "4" }}>
                <label style={compactHeaderLabelStyle}>البائع</label>
                  <div className="flex relative flex-1 min-w-0 w-full" style={{ flexBasis: 0, height: "var(--work-field-h, 26px)" }}>
                  <button
                    onClick={() => { if (!sellerDisabled) setSellerOpen(o => !o); }}
                    disabled={sellerDisabled}
                    data-enter-nav="true"
                    className="flex items-center gap-1 classic-input"
                     style={{
                       flex: 1, minWidth: 0, width: "100%", boxSizing: "border-box", height: "var(--work-field-h, 26px)", paddingInline: "6px 4px",
                      background: sellerObj ? "#faf5ff" : !warehouseId ? "#f3f4f6" : "#fafafa",
                      border: `1px solid ${sellerObj ? "#7c3aed" : "#c9c4bb"}`,
                      borderRadius: "4px 0 0 4px", borderInlineEnd: "none",
                      color: sellerObj ? "#5b21b6" : !warehouseId ? "#9ca3af" : "#888",
                      fontSize: "11px", fontWeight: sellerObj ? 700 : 400,
                      cursor: sellerDisabled ? "not-allowed" : "pointer",
                    }}
                    title={!warehouseId ? "اختر الفرع/المخزن أولاً" : !canChangeSeller ? `البائع: ${sellerName} (لا يمكن تغييره)` : "اختر البائع"}
                  >
                    <span className="flex-1 truncate text-start">
                      {sellerName || (!warehouseId ? "—" : "— اختر البائع —")}
                    </span>
                  </button>
                  <button
                    onClick={() => { if (!sellerDisabled) setSellerOpen(o => !o); }}
                    disabled={sellerDisabled}
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: "18px", height: "var(--work-field-h, 26px)", borderRadius: "0 4px 4px 0", background: sellerObj ? "#7c3aed" : "#e5e0d8", border: `1px solid ${sellerObj ? "#6d28d9" : "#c9c4bb"}`, color: sellerObj ? "white" : "#666", fontSize: "9px" }}
                  >▼</button>

                  {sellerOpen && warehouseId && canChangeSeller && (<>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setSellerOpen(false)} />
                    <div className="absolute top-full z-[9999] mt-1 bg-white rounded-lg overflow-hidden" style={{ insetInlineStart: 0, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e2e8f0" }} dir={isAr ? "rtl" : "ltr"}>
                      <div className="px-3 py-2" style={{ background: "#4c1d95" }}>
                        <span className="text-white text-[11px] font-bold">اختر البائع</span>
                      </div>
                      {sellers.length === 0 ? (
                        <div className="px-4 py-4 text-center text-[11px] text-slate-500">لا يوجد بائعون مؤهلون لهذا الفرع/المخزن</div>
                      ) : (
                        <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                          {sellers.map((s, idx) => {
                            const isSel = s.id === sellerUserId;
                            return (
                              <button key={s.id} onClick={() => { setSellerUserId(s.id); setSellerOpen(false); }} className="w-full flex items-center transition-colors" style={{ textAlign: isAr ? "right" : "left", background: isSel ? "#f5f3ff" : idx % 2 === 0 ? "#fafafa" : "white", borderBottom: "1px solid #f1f5f9", padding: "6px 12px" }}>
                                <span style={{ width: 16, color: isSel ? "#7c3aed" : "transparent", fontSize: "11px", flexShrink: 0 }}>✓</span>
                                <div className="flex-1 min-w-0 mx-2">
                                  <div className="text-[12px] font-semibold truncate" style={{ color: isSel ? "#5b21b6" : "#1e293b" }}>{s.name || s.username}</div>
                                  {(s as any).code && <div className="text-[10px] text-slate-400">كود: {(s as any).code}</div>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {sellerUserId && (
                        <div className="px-3 py-1.5" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                          <button onClick={() => { setSellerUserId(null); setSellerOpen(false); }} className="text-[9px] text-red-400 hover:text-red-600">إلغاء الاختيار</button>
                        </div>
                      )}
                    </div>
                  </>)}
                </div>
              </div>
            );
          })()}
          {/* ══ صف 4: ملحوظة ══ */}
          <div className="flex items-center w-full min-w-0" style={{ gap: 3, gridColumn: "1/-1" }}>
            <label style={compactHeaderLabelStyle}>ملاحظة</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="classic-input flex-1" style={{ height: "var(--work-field-h, 26px)" }} />
          </div>

        </div>
      </div>

      {/* ── Main Tab Bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #b0a89a", background: "#F2F0EC", padding: "0 10px" }}>
        {[
          { id: "invoice", label: "📋 بيانات الفاتورة" },
          { id: "zatca",   label: "🏛️ الهيئة (ZATCA)", disabled: !currentInvId },
        ].map(t => (
          <button key={t.id} onClick={() => !t.disabled && setActiveMainTab(t.id as "invoice" | "zatca")}
            style={{ height: "var(--work-btn-h, 30px)", padding: "0 14px", border: "none", borderBottom: activeMainTab === t.id ? "2px solid #D19C05" : "2px solid transparent", background: "transparent", color: activeMainTab === t.id ? "#D19C05" : t.disabled ? "#bbb" : "#4a4a4a", fontWeight: activeMainTab === t.id ? 800 : 600, fontSize: "11px", cursor: t.disabled ? "not-allowed" : "pointer", fontFamily: "'Cairo', Tahoma, Arial, sans-serif", marginBottom: -1 }}>
            {t.label}
            {t.id === "zatca" && currentInvId && zatcaQuery.data?.zatcaStatus === "cleared" && (
              <span style={{ marginRight: 4, fontSize: 9, color: "#16a34a" }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ZATCA Panel ──────────────────────────────────────────────────── */}
      {activeMainTab === "zatca" && currentInvId && (
        <div className="flex-1 overflow-auto p-4" style={{ background: "#FFFFFF" }} dir="rtl">
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
                  <div style={{ padding: "14px 18px", borderRadius: "10px", background: st.bg, border: `1px solid ${st.color}44`, marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: 24 }}>{st.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "14px", color: st.color }}>{st.label}</div>
                      {zatcaQuery.data.zatcaClearedAt && (
                        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: 2 }}>
                          تاريخ التخليص: {new Date(zatcaQuery.data.zatcaClearedAt).toLocaleString('ar-SA')}
                        </div>
                      )}
                    </div>
                    <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
                      {zatcaQuery.data.zatcaStatus !== "cleared" && (
                        <button onClick={() => zatcaSubmitMut.mutate({ invoiceId: currentInvId })} disabled={zatcaSubmitMut.isPending} style={{ height: "var(--work-btn-h, 30px)", padding: "0 16px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: "var(--work-font-size, 12px)", cursor: "pointer", opacity: zatcaSubmitMut.isPending ? 0.6 : 1 }}>
                          {zatcaSubmitMut.isPending ? "جارٍ الإرسال..." : "🏛️ إرسال للهيئة"}
                        </button>
                      )}
                      {zatcaQuery.data.zatcaStatus === "rejected" && (
                        <button onClick={() => zatcaSubmitMut.mutate({ invoiceId: currentInvId, forceResend: true })} disabled={zatcaSubmitMut.isPending} style={{ height: "var(--work-btn-h, 30px)", padding: "0 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: "var(--work-font-size, 12px)", cursor: "pointer" }}>
                          إعادة الإرسال
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* التفاصيل التقنية */}
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "10px 16px", fontWeight: 800, fontSize: "var(--work-font-size, 12px)", color: "#374151", borderBottom: "1px solid #e2e8f0" }}>
                  🔑 البيانات التقنية
                </div>
                <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "140px 1fr", rowGap: "10px", alignItems: "start", fontSize: "var(--work-font-size, 12px)" }}>
                  {[
                    { label: "UUID الفاتورة",      value: zatcaQuery.data.zatcaUuid },
                    { label: "Hash التشفيري",       value: zatcaQuery.data.zatcaHash },
                    { label: "PIH (الفاتورة السابقة)", value: zatcaQuery.data.zatcaPih },
                    { label: "رقم تسلسلي (Counter)", value: zatcaQuery.data.zatcaInvoiceCounter?.toString() },
                  ].map(row => row.value ? (
                    <React.Fragment key={row.label}>
                      <div style={{ fontWeight: 700, color: "#6b7280", paddingLeft: 8 }}>{row.label}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#1e293b", background: "#f8fafc", padding: "3px 8px", borderRadius: 4, wordBreak: "break-all" }}>{row.value}</div>
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
                  <div style={{ fontWeight: 700, fontSize: "var(--work-font-size, 12px)", color: "#374151", marginBottom: 10 }}>📱 QR Code الهيئة</div>
                  <img src={`data:image/png;base64,${zatcaQuery.data.zatcaQrCode}`} alt="ZATCA QR" style={{ width: "140px", height: "140px" }} />
                </div>
              )}

              {/* استجابة الهيئة */}
              {zatcaQuery.data.zatcaResponse && (
                <div style={{ marginTop: 16, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "10px 16px", fontWeight: 700, fontSize: "var(--work-font-size, 12px)", color: "#374151", borderBottom: "1px solid #e2e8f0" }}>
                    📋 استجابة الهيئة
                  </div>
                  <div style={{ padding: "14px" }}>
                    <pre style={{ fontFamily: "monospace", fontSize: "10px", background: "#1e293b", color: "#e2e8f0", borderRadius: "6px", padding: "10px 14px", overflow: "auto", maxHeight: 200, margin: 0 }}>
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
        <table className="w-full border-collapse" style={{ fontSize: "var(--work-font-size, 12px)" }}>
          {/* Column widths — sourced centrally from INVOICE_TABLE_COLS via InvoiceTableColgroup */}
          <InvoiceTableColgroup />
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "#DAD271", color: "#4A3800" }}>
              <th className="inv-th text-center">#</th>
              <th className="inv-th">رقم الصنف</th>
              <th className="inv-th">اسم الصنف</th>
              <th className="inv-th text-center">الكمية</th>
              <th className="inv-th text-center">الوحدة</th>
              <th className="inv-th text-center">السعر</th>
              <th className="inv-th text-center">خصم%</th>
              <th className="inv-th text-center">الخصم ﷼</th>
              <th className="inv-th text-center">ض%</th>
              <th className="inv-th text-center font-bold">الإجمالي</th>
              <th className="inv-th"></th>
            </tr>
          </thead>
          <tbody data-nav-internal="true">
            {lines.map((line, rowIdx) => (
              <tr
                key={line.id}
                data-line-item="true"
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
                    onChange={e => { if (!line.productId) handleProductCodeChange(rowIdx, e.target.value); }}
                    onFocus={() => setSelectedLineIdx(rowIdx)}
                    onBlur={() => handleProductCodeBlur(rowIdx)}
                    onKeyDown={e => handleProductCodeKeyDown(e, rowIdx)}
                    className="inv-cell"
                    placeholder={line.productId ? "" : "كود / بحث..."}
                    readOnly={!!line.productId}
                    title={line.productId ? "كود الصنف لا يمكن تعديله" : "اكتب كود الصنف واضغط Enter"}
                    style={line.productId ? { background: "#f5f5f3", color: "#555", cursor: "default" } : undefined}
                  />
                </td>

                <td className="inv-td p-0">
                  <ProductNameCell
                    rowIdx={rowIdx}
                    value={line.productName}
                    products={productsQuery.data ?? []}
                    cellRefs={cellRefs}
                    isStockItem={line.isStockItem}
                    productId={line.productId}
                     onSelect={(name, code, id, unit, price, tax, itemType) => {
                      setLines(prev => {
                        const updated = [...prev];
                        const l = { ...updated[rowIdx], productName: name, productCode: code, productId: id, unit, unitPrice: price, taxPct: tax, isStockItem: itemType !== "service" };
                        l.total = calcLineTotal(l);
                        updated[rowIdx] = l;
                        return updated;
                      });
                       requestAnimationFrame(() => cellRefs.current.get(`${rowIdx}-2`)?.focus());
                    }}
                    onChange={v => {
                      // السماح بتغيير الوصف/الاسم للصنف الخدمة فقط داخل السطر
                      if (line.isStockItem) return;
                      setLines(prev => {
                        const updated = [...prev];
                        updated[rowIdx] = { ...updated[rowIdx], productName: v };
                        return updated;
                      });
                    }}
                    onBlur={() => {
                      // عند مغادرة حقل الاسم بدون صنف مُختار: مسح بيانات السطر
                      if (!line.productId && line.productName.trim()) {
                        setLines(prev => {
                          const updated = [...prev];
                          updated[rowIdx] = { ...EMPTY_LINE(), id: updated[rowIdx].id };
                          return updated;
                        });
                      }
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

                <td className="inv-td text-center font-bold" style={{ color: "#003399", fontSize: "var(--work-font-size, 12px)" }}>
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
        style={{ width: "320px", minWidth: "320px", background: "#F4F1EC" }}
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
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleSave();
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
                type="button"
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
          padding: 2px 5px;
          height: var(--work-field-h, 24px);
          font-size: var(--work-font-size, 12px);
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
          text-align: center;
          vertical-align: middle;
          font-weight: 700;
          font-size: calc(var(--work-font-size, 12px) - 1px);
          white-space: nowrap;
          font-family: 'Cairo', Tahoma, sans-serif;
          height: var(--work-row-h, 27px);
        }
        .inv-td {
          border: 1px solid #e8e4dc;
          padding: 1px 3px;
          height: var(--work-row-h, 27px);
          text-align: center;
          vertical-align: middle;
        }
        .inv-cell {
          border: none;
          outline: none;
          padding: 2px 4px;
          height: var(--work-cell-h, 25px);
          font-size: var(--work-font-size, 12px);
          font-family: 'Cairo', Tahoma, Arial, sans-serif;
          background: transparent;
          width: 100%;
          text-align: center;
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
          onClose={() => {
            // إذا أُلغيت شاشة الدفع دون تأكيد، احتفظ بالمسودة كما هي ولا تُحدِث DB
            draftIdToFinalizeRef.current = null;
            pendingCreatePayloadRef.current = null;
            setShowPaymentModal(false);
          }}
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
            salesperson: sellerUserId ? ((salespersonsQuery.data ?? []).find(u => u.id === sellerUserId)?.name ?? undefined) : undefined,
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
                    style={{ height: "28px", fontSize: "13px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم الجوال</label>
                  <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="classic-input w-full" placeholder="05xxxxxxxx" style={{ height: "28px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">البريد الإلكتروني</label>
                  <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)}
                    className="classic-input w-full" placeholder="example@domain.com" style={{ height: "28px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">العنوان</label>
                  <input value={newCustAddr} onChange={e => setNewCustAddr(e.target.value)}
                    className="classic-input w-full" placeholder="العنوان..." style={{ height: "28px" }} />
                </div>
              </>)}

              {/* ── حقول المؤسسة ── */}
              {newCustType === 'organization' && (<>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">اسم المؤسسة <span className="text-red-500">*</span></label>
                  <input autoFocus value={newCustName} onChange={e => setNewCustName(e.target.value)}
                    className="classic-input w-full" placeholder="اسم الشركة أو المؤسسة..."
                    style={{ height: "28px", fontSize: "13px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم الجوال</label>
                  <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)}
                    className="classic-input w-full" placeholder="05xxxxxxxx" style={{ height: "28px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">البريد الإلكتروني</label>
                  <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)}
                    className="classic-input w-full" placeholder="example@domain.com" style={{ height: "28px" }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold" style={{ color: '#DC2626' }}>
                    الرقم الضريبي <span className="text-red-500">*</span>
                  </label>
                  <input value={newCustTaxNum} onChange={e => setNewCustTaxNum(e.target.value)}
                    className="classic-input w-full" placeholder="3xxxxxxxxxxxxxxxxx"
                    style={{ height: "28px", borderColor: newCustTaxNum.trim() ? '#86EFAC' : '#FCA5A5', background: newCustTaxNum.trim() ? '#F0FDF4' : '#FFF5F5' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">رقم السجل التجاري</label>
                  <input value={newCustRegNum} onChange={e => setNewCustRegNum(e.target.value)}
                    className="classic-input w-full" placeholder="1010xxxxxx" style={{ height: "28px" }} />
                </div>
                {/* صف: العنوان المختصر + المدينة */}
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">العنوان المختصر</label>
                    <input value={newCustShortAddr} onChange={e => setNewCustShortAddr(e.target.value)}
                      className="classic-input w-full" placeholder="مثال: ABCD" style={{ height: "28px" }} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">المدينة</label>
                    <input value={newCustCity} onChange={e => setNewCustCity(e.target.value)}
                      className="classic-input w-full" placeholder="الرياض" style={{ height: "28px" }} />
                  </div>
                </div>
                {/* صف: رقم المبنى + الرقم الفرعي */}
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">رقم المبنى</label>
                    <input value={newCustBuilding} onChange={e => setNewCustBuilding(e.target.value)}
                      className="classic-input w-full" placeholder="1234" style={{ height: "28px" }} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[11px] font-bold text-gray-600">الرقم الفرعي</label>
                    <input value={newCustAdditional} onChange={e => setNewCustAdditional(e.target.value)}
                      className="classic-input w-full" placeholder="5678" style={{ height: "28px" }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-600">الرمز البريدي</label>
                  <input value={newCustPostal} onChange={e => setNewCustPostal(e.target.value)}
                    className="classic-input w-full" placeholder="12345" style={{ height: "28px" }} />
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
        onSaveAsDraft={() => dirtyConfirmSave(handleSaveDraft)}
        onDiscard={dirtyConfirmDiscard}
        onCancel={dirtyConfirmCancel}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* ── حوار التنقل عند وجود تعديلات غير محفوظة ── */}
      <UnsavedChangesDialog
        open={navShowUnsavedDialog}
        onSaveAsDraft={navUnsavedDialogActions.onSaveAsDraft}
        onDiscard={navUnsavedDialogActions.onDiscard}
        onCancel={navUnsavedDialogActions.onCancel}
        isSaving={navIsSavingDraft}
      />

      {/* ── نافذة تأكيد تغيير العميل (بناءً على مستند من عميل مختلف) ── */}
      {pendingSourceDoc && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.55)",
            zIndex: 99999,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            width: "min(460px,92vw)",
            direction: "rtl",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              padding: "12px 18px",
              background: "linear-gradient(135deg,#b45309,#92400e)",
              color: "#fff", fontWeight: 700, fontSize: "13px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              تغيير العميل
            </div>
            {/* Body */}
            <div style={{ padding: "18px 20px", fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>
              <p>
                المستند <strong style={{ fontFamily: "monospace", color: "#1a3f6f" }}>{pendingSourceDoc.number}</strong> يخصّ العميل:
              </p>
              <p style={{
                background: "#fef3c7", border: "1px solid #f59e0b",
                borderRadius: 6, padding: "6px 12px", margin: "8px 0",
                fontWeight: 700, color: "#92400e",
              }}>
                {pendingSourceDoc.customerName ?? "—"}
              </p>
              <p>
                بينما الفاتورة الحالية تحتوي على العميل:
                <strong style={{ color: "#374151", marginRight: 4 }}>{customerName}</strong>
              </p>
              <p style={{ marginTop: "10px", color: "#6b7280", fontSize: "var(--work-font-size, 12px)" }}>
                هل تريد تغيير العميل في الفاتورة إلى عميل المستند المصدر؟
              </p>
            </div>
            {/* Footer */}
            <div style={{
              padding: "10px 20px 14px",
              display: "flex", gap: "8px", justifyContent: "flex-start",
            }}>
              <button
                type="button"
                onClick={() => {
                  const src = pendingSourceDoc;
                  setPendingSourceDoc(null);
                  applySourceDoc(src);
                }}
                style={{
                  padding: "6px 20px",
                  background: "linear-gradient(135deg,#b45309,#92400e)",
                  color: "#fff", border: "none",
                  borderRadius: 6, fontSize: "var(--work-font-size, 12px)", fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                نعم، غيّر العميل
              </button>
              <button
                type="button"
                onClick={() => {
                  // رفض التحميل — إلغاء كامل للمستند المصدر
                  setPendingSourceDoc(null);
                  setBasedOnNum("");
                  setBasedOnTrigger("");
                }}
                style={{
                  padding: "6px 20px",
                  background: "#e5e7eb",
                  color: "#374151", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: "var(--work-font-size, 12px)", fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                لا، إلغاء التحميل
              </button>
            </div>
          </div>
        </div>
      )}

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
      <span style={{ fontSize: "11px", color: "#555", whiteSpace: "nowrap" }}>{label}</span>
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
  rowIdx, value, products, cellRefs, onSelect, onChange, onKeyDown, onFocus, onBlur, isStockItem, productId,
}: {
  rowIdx: number;
  value: string;
  products: any[];
  cellRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  onSelect: (name: string, code: string, id: number, unit: string, price: string, tax: string, itemType: string) => void;
  onChange?: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur?: () => void;
  isStockItem?: boolean;
  productId?: number;
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
    // للصنف الخدمة: نسمح بتعديل الوصف/الاسم داخل السطر فقط دون تغيير كوده أو productId
    if (!isStockItem) onChange?.(v);
    if (v.length >= 1) {
      const term = v.toLowerCase();
      const f = products.filter(p =>
        p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
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
    onSelect(p.name, p.code ?? p.barcode ?? "", p.id, p.unit ?? "", p.salePrice ? String(p.salePrice) : "", p.taxRate ? String(p.taxRate) : "0", p.itemType ?? "stock");
  };

  const tryExactMatch = () => {
    const term = search.trim();
    if (!term) return null;
    return products.find(p =>
      p.name === term || p.code === term || p.barcode === term
    ) ?? null;
  };

  const rejectAndStay = useCallback(() => {
    playProductBeep();
    toast.error("الصنف غير مسجل، يرجى اختيار صنف من القائمة.");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const handleBlur = () => {
    if (!productId && search.trim()) {
      // لا يوجد صنف مسجل مُختار والحقل غير فارغ → نبقي النص ونرجّع التركيز
      rejectAndStay();
    }
    onBlur?.();
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
        onChange={e => { handleChange(e.target.value); }}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return; }
            if (e.key === "Enter" && filtered[highlighted]) { e.preventDefault(); handleSelect(filtered[highlighted]); return; }
            if (e.key === "Escape") { setOpen(false); return; }
          }
          // Enter بدون قائمة مفتوحة: اختيار تلقائي عند وجود تطابق تام
          if (e.key === "Enter") {
            const exact = tryExactMatch();
            if (exact) { e.preventDefault(); handleSelect(exact); return; }
            if (search.trim() && !productId) { e.preventDefault(); rejectAndStay(); return; }
            if (!search.trim() && !productId) { e.preventDefault(); rejectAndStay(); return; }
          }
          // Tab: لا ينتقل إلا بعد اختيار صنف حقيقي
          if (e.key === "Tab" && !productId) {
            e.preventDefault();
            rejectAndStay();
            return;
          }
          onKeyDown(e);
        }}
        className="inv-cell w-full"
        placeholder={productId ? (isStockItem ? "" : "وصف الخدمة...") : "اسم الصنف / بحث..."}
        autoComplete="off"
        readOnly={isStockItem}
        title={isStockItem ? "اسم الصنف المخزني لا يمكن تعديله" : (productId ? "يمكن تعديل وصف الخدمة داخل السطر فقط" : "ابحث واختر صنف مسجل")}
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
            fontSize: "var(--work-font-size, 12px)",
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
              <span style={{ color: "#D19C05", fontWeight: 600, minWidth: 60 }}>{p.code ?? ""}</span>
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ color: "#16A34A", fontWeight: 600 }}>{p.salePrice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
