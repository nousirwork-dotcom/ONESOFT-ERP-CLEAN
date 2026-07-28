/**
 * DocumentInvoicePage.tsx — صفحة مستندات متعددة الأغراض
 * تعمل مع: فاتورة مبيعات/مشتريات، مردود، عرض سعر، أمر بيع/شراء
 */
import React, { useState, useRef, useCallback, useEffect, useMemo, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { useToolbarActions } from "@/components/unified-toolbar/ToolbarActionsContext";
import type { ToolbarActionMap } from "@/components/unified-toolbar/toolbar.types";
import { useDocumentNavigation } from "@/components/unified-toolbar/useDocumentNavigation";
type ERPMode = "view" | "new" | "edit" | "search";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import PostingPreviewModal from "@/shared/components/PostingPreviewModal";
import InvoicePrintModal, { type DocTemplateConfig } from "@/shared/components/InvoicePrintModal";
import styles from "@/components/responsive-layout/ResponsiveLayout.module.css";
import { InvoiceTableColgroup } from "@/components/responsive-layout";
import "./purchase-invoice-header.css";

// ─── Config ────────────────────────────────────────────────────────────────────
export interface DocPageConfig {
  pageTitle: string;
  docCategory: "sales" | "purchase";
  invoiceType: string;
  journalDocType: string;
  docTypeFilter: string;
  partyLabel: string;
  numberPrefix: string;
  journalDropdownTitle: string;
  basedOnOptions?: Array<{ value: string; label: string }>;
  canPost?: boolean;
  themeColor?: string;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  batchNumber: string;
  expiryDate: string;
  productId?: number;
}

type PaymentType = "cash" | "credit";

const EMPTY_LINE = (): InvoiceLine => ({
  id: crypto.randomUUID(),
  productCode: "", productName: "", quantity: "1", unit: "",
  unitPrice: "", discountPct: "0", discountAmt: "0", taxPct: "0", taxAmt: "0", total: "0",
  batchNumber: "", expiryDate: "",
});

const COL_FIELDS: (keyof InvoiceLine)[] = [
  "productCode", "productName", "quantity", "unit", "unitPrice",
  "discountPct", "discountAmt", "taxPct", "taxAmt", "batchNumber", "expiryDate",
];

function calcLineTotal(line: InvoiceLine): string {
  const qty   = parseFloat(line.quantity)   || 0;
  const price = parseFloat(line.unitPrice)  || 0;
  const disc  = parseFloat(line.discountPct) || 0;
  const tax   = parseFloat(line.taxPct)     || 0;
  const base  = qty * price;
  const afterDisc = base - base * (disc / 100);
  return (afterDisc + afterDisc * (tax / 100)).toFixed(3);
}

function fmt(n: number) { return n.toFixed(3); }

// ─── Helper: Header Field ──────────────────────────────────────────────────────
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

function PurchaseField({
  label,
  children,
  alignStart = false,
}: {
  label: string;
  children: React.ReactNode;
  alignStart?: boolean;
}) {
  return (
    <div className={`purchase-field-row${alignStart ? " purchase-field-row-start" : ""}`}>
      <label>{label}</label>
      <div className="purchase-field-control">{children}</div>
    </div>
  );
}

// ─── Helper: Total Field ───────────────────────────────────────────────────────
function TF({ label, value, highlight, big, color }: {
  label: string; value: string; highlight?: boolean; big?: boolean; color?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap" }}>{label}</span>
      <input readOnly value={value} className="classic-input text-center"
        style={{
          width: big ? 100 : 88,
          background: highlight ? "#FFFDE7" : "#F5F3EF",
          fontWeight: highlight || big ? 700 : 400,
          color: color ?? (highlight ? "#003399" : "#333"),
          fontSize: big ? 13 : 12,
          borderColor: highlight ? "#F59E0B" : "#c0bab2",
        }} />
    </div>
  );
}

// ─── Helper: Product Name Cell ─────────────────────────────────────────────────
function ProductNameCell({
  rowIdx, value, products, cellRefs, onSelect, onKeyDown, onFocus,
}: {
  rowIdx: number; value: string; products: any[];
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
      setFiltered(f); setOpen(f.length > 0); setHighlighted(0);
    } else { setOpen(false); }
  };

  const handleSelect = (p: any) => {
    setSearch(p.name); setOpen(false);
    onSelect(p.name, p.sku ?? p.barcode ?? p.code ?? "", p.id, p.unit ?? "", p.salePrice ? String(p.salePrice) : "", p.taxRate ? String(p.taxRate) : "0");
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) setOpen(false);
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
            if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return; }
            if (e.key === "Enter" && filtered[highlighted]) { e.preventDefault(); handleSelect(filtered[highlighted]); return; }
            if (e.key === "Escape")    { setOpen(false); return; }
          }
          onKeyDown(e);
        }}
        className="inv-cell w-full" placeholder="اسم الصنف..." autoComplete="off"
      />
      {open && (
        <div ref={dropRef} style={{
          position: "absolute", top: "100%", right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #a0a0a0",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          width: 280, maxHeight: 200, overflowY: "auto", fontSize: "12px",
        }}>
          {filtered.map((p, i) => (
            <div key={p.id}
              style={{ padding: "4px 8px", background: i === highlighted ? "#D4E3F7" : (i % 2 === 0 ? "#fff" : "#FAFAF8"), cursor: "pointer", borderBottom: "1px solid #f0f0f0", display: "flex", gap: 8 }}
              onMouseDown={() => handleSelect(p)} onMouseEnter={() => setHighlighted(i)}>
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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DocumentInvoicePage({ config }: { config: DocPageConfig }) {
  const themeColor = config.themeColor ?? "#406B93";

  // ── State ──────────────────────────────────────────────────────────────────
  const [invoiceNumber, setInvoiceNumber]             = useState("");
  const [invoiceDate, setInvoiceDate]                 = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate]                         = useState("");
  const [partyId, setPartyId]                         = useState<number | null>(null);
  const [partyName, setPartyName]                     = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [branchId, setBranchId]                         = useState<number | null>(null);
  const [warehouseId, setWarehouseId]                 = useState<number | null>(null);
  const [warehouseDisplayName, setWarehouseDisplayName] = useState<string>("");
  const [journalWarehouseId, setJournalWarehouseId]   = useState<number | null>(null);
  const [docTypeWarehouseId, setDocTypeWarehouseId]   = useState<number | null>(null);
  const [paymentType, setPaymentType]                 = useState<PaymentType>("cash");
  const [docTypeId, setDocTypeId]                     = useState<string>("");
  const [currency, setCurrency]                       = useState("SAR");
  const [exchangeRate, setExchangeRate]               = useState("1.000");
  const [salesperson, setSalesperson]                 = useState("");
  const [basedOnType, setBasedOnType]                 = useState<string>("");
  const [basedOnNum, setBasedOnNum]                   = useState("");
  const [basedOnTrigger, setBasedOnTrigger]           = useState("");
  const [notes, setNotes]                             = useState("");
  const [paidAmountOverride, setPaidAmountOverride]   = useState<string>("");

  const [lines, setLines]               = useState<InvoiceLine[]>([EMPTY_LINE()]);
  const [selectedLineIdx, setSelectedLineIdx] = useState(0);
  const [copiedLine, setCopiedLine]     = useState<InvoiceLine | null>(null);

  const [journalId, setJournalId]       = useState<number | null>(null);
  const [journalOpen, setJournalOpen]   = useState(false);

  const [savedInvoiceId, setSavedInvoiceId]       = useState<number | null>(null);
  const [navInvoiceId, setNavInvoiceId]           = useState<number | null>(null);
  const [isPosted, setIsPosted]                   = useState(false);
  const [showPostingPreview, setShowPostingPreview] = useState(false);

  const [erpMode, setErpMode] = useState<ERPMode>("new");
  const isDirty = erpMode === "new" || erpMode === "edit";
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── Queries ────────────────────────────────────────────────────────────────
  const customersQuery  = trpc.customers.list.useQuery(undefined, { enabled: config.docCategory === "sales" });
  const suppliersQuery  = trpc.suppliers.list.useQuery(undefined, { enabled: config.docCategory === "purchase" });
  const parties = config.docCategory === "sales"
    ? (customersQuery.data ?? [])
    : (suppliersQuery.data ?? []);

  const warehousesQuery = trpc.warehouses.list.useQuery();
  const branchesQuery   = trpc.branches.list.useQuery(undefined, {
    enabled: config.docCategory === "purchase",
    retry: 2,
    refetchOnMount: "always",
  });
  const productsQuery   = trpc.products.list.useQuery({});
  const journalsQuery   = trpc.documentJournals.list.useQuery({ docType: config.journalDocType });
  const docTypesQuery   = trpc.documentTypes.list.useQuery({ typeId: config.docTypeFilter });
  const purchaseBranchOptions = useMemo(() => {
    if (config.docCategory !== "purchase") return [];

    const branches = branchesQuery.data ?? [];
    const warehouses = warehousesQuery.data ?? [];
    const journals = journalsQuery.data ?? [];
    const options: Array<{ value: string; label: string; branchId: number | null; warehouseId: number; journalId: number }> = [];
    const usedWarehouses = new Set<number>();

    // Prefer the normal branch → warehouse → purchase journal relationship.
    for (const branch of branches as any[]) {
      const warehouse = warehouses.find((item: any) => item.branchId === branch.id);
      const journal = warehouse
        ? journals.find((item: any) => item.warehouseId === warehouse.id)
        : undefined;
      if (warehouse && journal) {
        options.push({
          value: `branch:${branch.id}`,
          label: branch.name,
          branchId: branch.id,
          warehouseId: warehouse.id,
          journalId: journal.id,
        });
        usedWarehouses.add(warehouse.id);
      }
    }

    // Some existing organizations have purchase journals linked to warehouses
    // whose branch_id is empty. Keep those selectable instead of hiding them.
    for (const journal of journals as any[]) {
      if (!journal.warehouseId || usedWarehouses.has(journal.warehouseId)) continue;
      const warehouse = warehouses.find((item: any) => item.id === journal.warehouseId);
      if (!warehouse) continue;
      options.push({
        value: `journal:${journal.id}`,
        label: journal.name || warehouse.name,
        branchId: warehouse.branchId ?? (branches[0]?.id ?? null),
        warehouseId: warehouse.id,
        journalId: journal.id,
      });
    }

    // If no journal has been configured yet, still show the actual branches.
    if (options.length === 0) {
      return (branches as any[]).map((branch: any) => ({
        value: `branch:${branch.id}`,
        label: branch.name,
        branchId: branch.id,
        warehouseId: 0,
        journalId: 0,
      }));
    }
    return options;
  }, [config.docCategory, branchesQuery.data, warehousesQuery.data, journalsQuery.data]);

  const selectedPurchaseBranchValue = useMemo(() => {
    if (config.docCategory !== "purchase" || !branchId) return "";
    const byJournal = journalId
      ? purchaseBranchOptions.find(option => option.journalId === journalId)
      : undefined;
    const byBranch = purchaseBranchOptions.find(option => option.branchId === branchId);
    return (byJournal ?? byBranch)?.value ?? "";
  }, [config.docCategory, branchId, journalId, purchaseBranchOptions]);

  const salesNextNumberQuery = trpc.salesInvoices.nextNumber.useQuery(
    { prefix: config.numberPrefix },
    { enabled: config.docCategory === "sales" }
  );
  const purchaseNextNumberQuery = trpc.purchases.nextNumber.useQuery(
    { prefix: config.numberPrefix },
    { enabled: config.docCategory === "purchase" }
  );

  const listQuery = config.docCategory === "sales"
    ? trpc.salesInvoices.list.useQuery({ invoiceType: (config.invoiceType === "invoice" ? "sale" : config.invoiceType) as any })
    : trpc.purchases.list.useQuery({ invoiceType: config.invoiceType });

  const navInvoiceQuery = config.docCategory === "sales"
    ? trpc.salesInvoices.get.useQuery({ id: navInvoiceId! }, { enabled: !!navInvoiceId })
    : trpc.purchases.get.useQuery({ id: navInvoiceId! }, { enabled: !!navInvoiceId });

  // تحميل المستند المختار بالتنقل
  useEffect(() => {
    const inv = navInvoiceQuery.data as any;
    if (!inv) return;
    setInvoiceNumber(inv.invoiceNumber || "");
    setInvoiceDate(inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split("T")[0] : "");
    setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split("T")[0] : "");
    setPartyId(inv.customerId ?? inv.supplierId ?? null);
    setPartyName(inv.customerName ?? inv.supplierName ?? "");
    setSupplierInvoiceNumber(inv.supplierInvoiceNumber || "");
    setWarehouseId(inv.warehouseId ?? null);
    setBranchId(
      inv.branchId ??
      warehousesQuery.data?.find((warehouse: any) => warehouse.id === inv.warehouseId)?.branchId ??
      null,
    );
    setWarehouseDisplayName(
      inv.warehouseName ??
      warehousesQuery.data?.find((warehouse: any) => warehouse.id === inv.warehouseId)?.name ??
      "",
    );
    setJournalId(inv.journalId ?? null);
    setJournalWarehouseId(
      inv.journalId
        ? (journalsQuery.data ?? []).find((journal: any) => journal.id === inv.journalId)?.warehouseId ?? null
        : null,
    );
    setCurrency(inv.currency ?? "SAR");
    setExchangeRate(inv.exchangeRate ?? "1.000");
    setPaymentType((inv.paymentMethod ?? "cash") as PaymentType);
    setNotes(inv.notes ?? "");
    setPaidAmountOverride(inv.paidAmount ?? "");
    setSavedInvoiceId(inv.id);
    setIsPosted(inv.isPosted ?? false);
    setErpMode("view");
    if (inv.items && inv.items.length > 0) {
      setLines(inv.items.map((item: any) => ({
        id: crypto.randomUUID(),
        productCode: item.productCode ?? "",
        productName: item.productName,
        unit: item.unit ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPct: item.discountPercent ?? "0",
        discountAmt: item.discountAmount ?? "0",
        taxPct: item.taxPercent ?? "0",
        taxAmt: item.taxAmount ?? "0",
        total: item.total,
         batchNumber: item.batchNumber ?? "",
         expiryDate: item.expiryDate ?? "",
        productId: item.productId ?? undefined,
      })));
    } else {
      setLines([EMPTY_LINE()]);
    }
  }, [navInvoiceQuery.data, warehousesQuery.data, journalsQuery.data]);

  const stockQuery = trpc.reports.stockByWarehouse.useQuery(
    { warehouseId: warehouseId! },
    { enabled: !!warehouseId }
  );

  // نوع الفاتورة للطباعة
  const isPrintEnabled =
    (config.docCategory === "purchase" && ["invoice", "order", "return"].includes(config.invoiceType)) ||
    (config.docCategory === "sales"    && config.invoiceType === "return");

  const printDocType: string =
    config.docCategory === "purchase" && config.invoiceType === "order"  ? "purchase_order"  :
    config.docCategory === "purchase" && config.invoiceType === "return" ? "purchase_return" :
    config.docCategory === "purchase"                                    ? "purchase_invoice" :
    "sales_invoice";

  const orgQuery             = trpc.orgs.currentOrg.useQuery();
  const qrSettingsQuery      = trpc.qrSettings.get.useQuery();
  const defaultTemplateQuery = trpc.documentTemplates.getDefault.useQuery(
    { docType: printDocType },
    { enabled: isPrintEnabled },
  );

  const nextJournalNumberMutation = trpc.documentJournals.nextNumber.useMutation();
  const utils = trpc.useUtils();

  const basedOnQuery = trpc.salesInvoices.getByNumber.useQuery(
    { type: basedOnType as any, number: basedOnTrigger },
    { enabled: config.docCategory === "sales" && !!basedOnType && !!basedOnTrigger }
  );

  // Set initial invoice number
  useEffect(() => {
    const n = config.docCategory === "sales" ? salesNextNumberQuery.data : purchaseNextNumberQuery.data;
    if (config.docCategory === "sales" && n && !invoiceNumber) setInvoiceNumber(n);
  }, [config.docCategory, salesNextNumberQuery.data, purchaseNextNumberQuery.data, invoiceNumber]);

  // تحديث اسم المخزن الظاهر عند تحميل قائمة المخازن أو تغير المخزن المختار
  useEffect(() => {
    if (!warehouseId) return;
    const wh = warehousesQuery.data?.find(w => w.id === warehouseId);
    if (wh?.name) setWarehouseDisplayName(wh.name);
  }, [warehouseId, warehousesQuery.data]);

  // For purchases, branch is the UI selector while warehouse remains the
  // single operational source of truth in the invoice payload.
  useEffect(() => {
    if (config.docCategory !== "purchase" || !warehouseId) return;
    const warehouse = warehousesQuery.data?.find((item: any) => item.id === warehouseId);
    if (warehouse?.branchId && warehouse.branchId !== branchId) setBranchId(warehouse.branchId);
  }, [config.docCategory, warehouseId, warehousesQuery.data, branchId]);

  // Fill from source doc (بناءً على)
  useEffect(() => {
    const src = basedOnQuery.data;
    if (!src) return;
    if (src.customerName) setPartyName(src.customerName);
    if (src.customerId)   setPartyId(src.customerId);
    if (src.warehouseId && !journalWarehouseId) setWarehouseId(src.warehouseId ?? null);
    if (src.currency) setCurrency(src.currency);
    if (src.notes)    setNotes(src.notes ?? "");
    if (src.items.length > 0) {
      setLines(src.items.map(i => ({
        id: crypto.randomUUID(),
        productCode: i.productCode, productName: i.productName, unit: i.unit || "",
        quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct,
        discountAmt: i.discountAmt, taxPct: i.taxPct, taxAmt: i.taxAmt,
        total: i.total, productId: i.productId ?? undefined,
      })));
    }
    toast.success(`✓ تم استيراد بيانات المستند ${src.number}`);
  }, [basedOnQuery.data]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const pendingNavRef = useRef<(() => void) | null>(null);

  const salesCreateMutation = trpc.salesInvoices.create.useMutation({
    onSuccess: (data) => {
      const autoPosted = (data as any).isPosted === true;
      toast.success(`✓ تم حفظ المستند ${data.invoiceNumber} بنجاح`, {
        description: autoPosted
          ? `الإجمالي: ${fmt(netTotal)} ${currency} — تم الترحيل المحاسبي تلقائياً ✓`
          : `الإجمالي: ${fmt(netTotal)} ${currency} — اضغط "ترحيل" لترحيل القيد`,
        duration: 5000,
      });
      setSavedInvoiceId(data.id ?? null);
      setIsPosted(autoPosted);
      setErpMode("view");
      pendingNavRef.current?.();
      pendingNavRef.current = null;
    },
    onError: (e) => { toast.error(`خطأ في الحفظ: ${e.message}`); pendingNavRef.current = null; },
  });

  const purchaseCreateMutation = trpc.purchases.create.useMutation({
    onSuccess: (data) => {
      toast.success(`✓ تم حفظ المستند ${data.invoiceNumber} بنجاح`, {
        description: `الإجمالي: ${fmt(netTotal)} ${currency}`,
        duration: 5000,
      });
      setSavedInvoiceId(data.id);
      setIsPosted(false);
      setErpMode("view");
      pendingNavRef.current?.();
      pendingNavRef.current = null;
    },
    onError: (e) => { toast.error(`خطأ في الحفظ: ${e.message}`); pendingNavRef.current = null; },
  });

  const isSaving = config.docCategory === "sales"
    ? salesCreateMutation.isPending
    : purchaseCreateMutation.isPending;

  const postMutation = trpc.posting.postSalesInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`✓ تم الترحيل — قيد رقم ${data.entryNumber}`);
      setIsPosted(true);
      setShowPostingPreview(false);
    },
    onError: (e) => toast.error(`خطأ في الترحيل: ${e.message}`),
  });

  const purchasePostMutation = trpc.posting.postPurchaseInvoice.useMutation({
    onSuccess: (data) => {
      toast.success(`✓ تم الترحيل — قيد رقم ${data.entryNumber}`);
      setIsPosted(true);
      setShowPostingPreview(false);
    },
    onError: (e) => toast.error(`خطأ في ترحيل فاتورة المشتريات: ${e.message}`),
  });

  const unpostMutation = trpc.posting.unpostSalesInvoice.useMutation({
    onSuccess: () => { toast.success("تم إلغاء الترحيل"); setIsPosted(false); },
    onError: (e) => toast.error(`خطأ في إلغاء الترحيل: ${e.message}`),
  });

  const purchaseUnpostMutation = trpc.posting.unpostPurchaseInvoice.useMutation({
    onSuccess: () => { toast.success("تم إلغاء ترحيل فاتورة المشتريات"); setIsPosted(false); },
    onError: (e) => toast.error(`خطأ في إلغاء ترحيل فاتورة المشتريات: ${e.message}`),
  });

  const activePostMutation = config.docCategory === "purchase"
    ? purchasePostMutation
    : postMutation;
  const activeUnpostMutation = config.docCategory === "purchase"
    ? purchaseUnpostMutation
    : unpostMutation;

  // ── Calculations ───────────────────────────────────────────────────────────
  const subtotal = lines.reduce((s, l) =>
    s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);

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
  const paidAmount = paymentType === "cash" ? netTotal : parseFloat(paidAmountOverride || "0");
  const remainingAmount = Math.max(0, netTotal - paidAmount);

  // ── Line Ops ───────────────────────────────────────────────────────────────
  const updateLine = useCallback((idx: number, field: keyof InvoiceLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      if (["discountPct", "quantity", "unitPrice"].includes(field)) {
        const qty   = parseFloat(field === "quantity"   ? value : line.quantity)   || 0;
        const price = parseFloat(field === "unitPrice"  ? value : line.unitPrice)  || 0;
        const disc  = parseFloat(field === "discountPct"? value : line.discountPct)|| 0;
        line.discountAmt = (qty * price * disc / 100).toFixed(3);
      }
      if (["taxPct", "quantity", "unitPrice", "discountPct"].includes(field)) {
        const qty   = parseFloat(line.quantity)  || 0;
        const price = parseFloat(line.unitPrice) || 0;
        const disc  = parseFloat(line.discountPct) || 0;
        const tax   = parseFloat(field === "taxPct" ? value : line.taxPct) || 0;
        const base  = qty * price;
        const afterDisc = base - base * (disc / 100);
        line.taxAmt = (afterDisc * tax / 100).toFixed(3);
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

  const handleProductCodeChange = useCallback((idx: number, code: string) => {
    updateLine(idx, "productCode", code);
    if (!code) return;
    const found = (productsQuery.data ?? []).find(p =>
      (p as any).sku === code || p.barcode === code || String(p.id) === code);
    if (found) {
      setLines(prev => {
        const u = [...prev];
        const l = { ...u[idx] };
        l.productCode = (found as any).sku ?? found.barcode ?? code;
        l.productName = found.name;
        l.productId   = found.id;
        l.unit        = found.unit ?? "";
        l.unitPrice   = found.salePrice ? String(found.salePrice) : "";
        l.taxPct      = found.taxRate ? String(found.taxRate) : "0";
        l.total       = calcLineTotal(l);
        u[idx] = l;
        return u;
      });
    }
  }, [productsQuery.data]);

  const handleCellKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number
  ) => {
    const totalCols = COL_FIELDS.length;
    const totalRows = lines.length;
    if (e.ctrlKey && e.code === "KeyC") {
      e.preventDefault(); setCopiedLine({ ...lines[rowIdx] }); toast.info(`تم نسخ السطر ${rowIdx + 1}`); return;
    }
    if (e.ctrlKey && e.code === "KeyV") {
      e.preventDefault();
      if (!copiedLine) { toast.warning("لا يوجد سطر منسوخ"); return; }
      setLines(prev => { const u = [...prev]; u.splice(rowIdx + 1, 0, { ...copiedLine, id: crypto.randomUUID() }); return u; });
      setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50); return;
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
      } else if (rowIdx + 1 < totalRows) {
        setSelectedLineIdx(rowIdx + 1);
        cellRefs.current.get(`${rowIdx + 1}-0`)?.focus();
      } else {
        addLine();
        setTimeout(() => cellRefs.current.get(`${rowIdx + 1}-0`)?.focus(), 50);
      }
      return;
    }
    if (e.ctrlKey && e.key === "Delete") { e.preventDefault(); deleteLine(rowIdx); }
  }, [lines, copiedLine, addLine, deleteLine]);

  // ── Journal Select ─────────────────────────────────────────────────────────
  const handleJournalSelect = useCallback(async (id: number) => {
    setJournalId(id); setJournalOpen(false);
    const j = (journalsQuery.data ?? []).find((x: any) => x.id === id);
    if (j) {
      if (j.warehouseId) {
        setWarehouseId(j.warehouseId);
        setJournalWarehouseId(j.warehouseId);
        const whName = warehousesQuery.data?.find((w: any) => w.id === j.warehouseId)?.name ?? "";
        setWarehouseDisplayName(whName);
        if (config.docCategory === "purchase") {
          const branch = warehousesQuery.data?.find((w: any) => w.id === j.warehouseId)?.branchId;
          if (branch) setBranchId(branch);
        }
      } else {
        setJournalWarehouseId(null);
        setWarehouseDisplayName("");
        if (config.docCategory === "purchase") {
          setBranchId(null);
          setWarehouseId(null);
        }
      }
      if (j.defaultCurrency) setCurrency(j.defaultCurrency);
      if (j.defaultPayMethod) setPaymentType(j.defaultPayMethod as any);
    }
    setDocTypeId(prev => {
      const filtered = (docTypesQuery.data ?? []).filter((dt: any) => dt.journal === String(id));
      return filtered.some((dt: any) => String(dt.id) === prev) ? prev : "";
    });
    setDocTypeWarehouseId(null);
    try {
      const preview = await utils.documentJournals.previewNextNumber.fetch({ journalId: id });
      if (preview) setInvoiceNumber(preview);
    } catch { toast.error("تعذّر جلب رقم المستند من الدفتر"); }
  }, [config.docCategory, journalsQuery.data, warehousesQuery.data, docTypesQuery.data, utils]);

  const handlePurchaseBranchSelect = useCallback(async (selection: string) => {
    if (config.docCategory !== "purchase") return;
    const selected = purchaseBranchOptions.find(option => option.value === selection);
    const nextBranchId = selected?.branchId ?? null;
    if (
      branchId &&
      nextBranchId &&
      branchId !== nextBranchId &&
      lines.some(line => line.productName.trim() || line.productId)
    ) {
      const accepted = window.confirm(
        "تغيير الفرع سيؤدي إلى تغيير المخزن ورقم المستند، وقد تتغير كميات الأصناف المتاحة. هل تريد المتابعة؟",
      );
      if (!accepted) return;
    }
    if (!nextBranchId) {
      setBranchId(null);
      setWarehouseId(null);
      setWarehouseDisplayName("");
      setJournalId(null);
      setJournalWarehouseId(null);
      setInvoiceNumber("");
      return;
    }
    const warehouse = selected?.warehouseId
      ? (warehousesQuery.data ?? []).find((item: any) => item.id === selected.warehouseId)
      : (warehousesQuery.data ?? []).find((item: any) => item.branchId === nextBranchId);
    if (!warehouse) {
      toast.error("لا يوجد مخزن مرتبط بالفرع المحدد.");
      return;
    }
    const journal = selected?.journalId
      ? (journalsQuery.data ?? []).find((item: any) => item.id === selected.journalId)
      : (journalsQuery.data ?? []).find((item: any) => item.warehouseId === warehouse.id);
    if (!journal) {
      toast.error("لا يوجد دفتر مشتريات مرتبط بالفرع المحدد.");
      return;
    }
    setBranchId(nextBranchId);
    setWarehouseId(warehouse.id);
    setWarehouseDisplayName(warehouse.name);
    setJournalId(journal.id);
    setJournalWarehouseId(warehouse.id);
    setDocTypeId(prev => {
      const filtered = (docTypesQuery.data ?? []).filter((dt: any) => dt.journal === String(journal.id));
      return filtered.some((dt: any) => String(dt.id) === prev)
        ? prev
        : (filtered[0] ? String(filtered[0].id) : "");
    });
    if (journal.defaultCurrency) setCurrency(journal.defaultCurrency);
    if (journal.defaultPayMethod) setPaymentType(journal.defaultPayMethod as any);
    try {
      // Reserve the exact number shown to the user. Saving must not reserve
      // another number and silently replace the visible document number.
      const reserved = await nextJournalNumberMutation.mutateAsync({ journalId: journal.id });
      setInvoiceNumber(reserved);
    } catch {
      setInvoiceNumber("");
      toast.error("تعذّر جلب رقم المستند من دفتر الفرع");
    }
  }, [
    config.docCategory,
    branchId,
    lines,
    purchaseBranchOptions,
    warehousesQuery.data,
    journalsQuery.data,
    docTypesQuery.data,
    utils,
    nextJournalNumberMutation,
  ]);

  const clearPurchaseBranchSelection = useCallback(() => {
    setBranchId(null);
    setWarehouseId(null);
    setWarehouseDisplayName("");
    setJournalId(null);
    setJournalWarehouseId(null);
    setDocTypeId("");
    setDocTypeWarehouseId(null);
    setInvoiceNumber("");
  }, []);

  const handleDocTypeSelect = useCallback((id: string) => {
    setDocTypeId(id);
    if (!id) { setDocTypeWarehouseId(null); return; }
    const dt = (docTypesQuery.data ?? []).find((d: any) => String(d.id) === id);
    const wStr = dt?.warehouse;
    if (wStr && wStr !== "all" && wStr !== "none" && wStr !== "") {
      const wId = parseInt(wStr);
      if (!isNaN(wId)) { setDocTypeWarehouseId(wId); if (!journalWarehouseId) setWarehouseId(wId); return; }
    }
    setDocTypeWarehouseId(null);
  }, [docTypesQuery.data, journalWarehouseId]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (config.docCategory === "purchase" && !branchId) {
      toast.error("يجب اختيار الفرع أولًا لتحديد المخزن ودفتر المستند");
      return;
    }
    if (!invoiceNumber.trim()) { toast.error("رقم المستند مطلوب"); return; }
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) { toast.error("يجب إضافة صنف واحد على الأقل"); return; }
    for (const l of validLines) {
      if (!l.unitPrice || parseFloat(l.unitPrice) === 0) {
        toast.error(`سعر الصنف "${l.productName}" يجب أن يكون أكبر من صفر`); return;
      }
      if (!l.quantity || parseFloat(l.quantity) === 0) {
        toast.error(`كمية الصنف "${l.productName}" يجب أن تكون أكبر من صفر`); return;
      }
    }
    const selectedDocType = docTypeId
      ? (docTypesQuery.data ?? []).find((dt: any) => String(dt.id) === docTypeId)
      : null;
    if (selectedDocType) {
      if (selectedDocType.requireNote && !notes.trim()) { toast.error("يجب إدخال ملاحظة للمستند"); return; }
      if (selectedDocType.requireCustomerCode && !partyId) { toast.error(`يجب اختيار ${config.partyLabel}`); return; }
      if (selectedDocType.requireEmployeeCode && !salesperson.trim()) { toast.error("يجب إدخال كود الموظف"); return; }
      if (selectedDocType.noStockDispatch && warehouseId) {
        for (const line of validLines) {
          if (!line.productId) continue;
          const inv = (stockQuery.data ?? []).find((s: any) => s.productId === line.productId);
          const available = Number(inv?.totalQuantity ?? 0);
          const requested = parseFloat(line.quantity) || 0;
          if (requested > available) {
            toast.error(`⛔ لا يوجد رصيد كافٍ للصنف "${line.productName}"\nالمتاح: ${available.toFixed(3)} — المطلوب: ${requested.toFixed(3)}`); return;
          }
        }
      }
    }
    let finalInvoiceNumber = invoiceNumber;
    if (journalId && config.docCategory !== "purchase") {
      try {
        finalInvoiceNumber = await nextJournalNumberMutation.mutateAsync({ journalId });
        setInvoiceNumber(finalInvoiceNumber);
      } catch { toast.error("تعذّر حجز رقم المستند من الدفتر"); return; }
    }
    const paid      = paymentType === "cash" ? fmt(netTotal) : fmt(paidAmount);
    const remaining = paymentType === "cash" ? "0.000" : fmt(remainingAmount);
    const payMethod = paymentType === "cash" ? "cash" : "credit";
    const status    = paymentType === "cash" ? "paid" : (remainingAmount <= 0 ? "paid" : "confirmed");
    const itemsPayload = validLines.map((l, idx) => ({
      productId: l.productId, productCode: l.productCode || undefined, productName: l.productName,
      unit: l.unit || undefined, quantity: l.quantity, unitPrice: l.unitPrice,
      discountPercent: l.discountPct, discountAmount: l.discountAmt,
       taxPercent: l.taxPct, taxAmount: l.taxAmt, total: l.total,
       ...(config.docCategory === "purchase" ? { batchNumber: l.batchNumber || undefined, expiryDate: l.expiryDate || undefined } : {}),
       sortOrder: idx,
    }));
    const common = {
      invoiceNumber: finalInvoiceNumber, invoiceType: config.invoiceType, invoiceDate,
      dueDate: dueDate || undefined, warehouseId: warehouseId ?? undefined,
      journalId: journalId ?? undefined, currency, exchangeRate,
      subtotal: fmt(subtotal), discountAmount: fmt(totalDiscount),
      taxAmount: fmt(totalTax), total: fmt(netTotal),
      paidAmount: paid, remainingAmount: remaining,
      paymentMethod: payMethod as any, status: status as any,
      notes: notes || undefined, items: itemsPayload,
    };
    if (config.docCategory === "sales") {
      salesCreateMutation.mutate({ ...common, customerId: partyId ?? undefined, customerName: partyName || undefined } as any);
    } else {
      purchaseCreateMutation.mutate({
        ...common,
        supplierId: partyId ?? undefined,
        supplierName: partyName || undefined,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
      });
    }
  }, [
    invoiceNumber, invoiceDate, dueDate, partyId, partyName, supplierInvoiceNumber,
    warehouseId, currency, exchangeRate, paymentType, paidAmount, remainingAmount,
    notes, lines, subtotal, totalDiscount, totalTax, netTotal,
    salesCreateMutation, purchaseCreateMutation, journalId, nextJournalNumberMutation,
     docTypeId, docTypesQuery.data, salesperson, stockQuery.data, config, branchId,
  ]);

  /* ── نسخة مماثلة ── */
  const handleDuplicate = useCallback(() => {
    if (!savedInvoiceId) { toast.warning("لا يوجد مستند محفوظ للنسخ — احفظ أولاً"); return; }
    setSavedInvoiceId(null); setNavInvoiceId(null); setIsPosted(false); setShowPostingPreview(false);
    setErpMode("new");
    setBasedOnType(""); setBasedOnNum(""); setBasedOnTrigger("");
    setPaidAmountOverride("");
    if (journalId) {
      utils.documentJournals.previewNextNumber.fetch({ journalId })
        .then(p => { if (p) setInvoiceNumber(p); })
        .catch(() => setInvoiceNumber(""));
    } else setInvoiceNumber("");
    toast.success("تم إنشاء نسخة مماثلة — راجع البيانات ثم احفظ");
  }, [savedInvoiceId, journalId, utils]);

  const handleNew = useCallback(() => {
    setLines([EMPTY_LINE()]); setSelectedLineIdx(0);
    setPartyId(null); setPartyName(""); setSupplierInvoiceNumber("");
     setWarehouseId(null); setBranchId(null); setPaymentType("cash");
    setBasedOnType(""); setBasedOnNum(""); setBasedOnTrigger("");
    setNotes(""); setDueDate(""); setSalesperson(""); setPaidAmountOverride("");
    setErpMode("new"); setJournalWarehouseId(null);
    setSavedInvoiceId(null); setNavInvoiceId(null); setIsPosted(false); setShowPostingPreview(false);
    if (journalId) {
      utils.documentJournals.previewNextNumber.fetch({ journalId }).then(p => {
        if (p) setInvoiceNumber(p);
      }).catch(() => setInvoiceNumber(""));
    } else setInvoiceNumber("");
  }, [journalId, utils]);

  // ── التحقق من أن المستند الجديد لا يحتوي على بيانات مُدخلة ───────────────────
  const isDocumentEmpty = useCallback(() => {
    const hasLine = lines.some(
      l => l.productId || l.productName.trim() || l.productCode.trim() || l.quantity !== "1" || l.unitPrice.trim()
    );
    return !hasLine && !partyName.trim() && !partyId && !warehouseId && !notes.trim() && !basedOnType && !basedOnNum;
  }, [lines, partyName, partyId, warehouseId, notes, basedOnType, basedOnNum]);

  // ── حفظ المسودة — يُستخدم من حوار التنقل عند وجود تعديلات غير محفوظة ───────
  const handleSaveDraft = useCallback(async () => {
    const validLines = lines.filter(l => l.productName.trim() !== "");
    if (validLines.length === 0) { toast.error("يجب إضافة صنف واحد على الأقل"); return; }
    const itemsPayload = validLines.map((l, idx) => ({
      productId: l.productId, productCode: l.productCode || undefined, productName: l.productName,
      unit: l.unit || undefined, quantity: l.quantity, unitPrice: l.unitPrice,
      discountPercent: l.discountPct, discountAmount: l.discountAmt,
       taxPercent: l.taxPct, taxAmount: l.taxAmt, total: l.total,
       ...(config.docCategory === "purchase" ? { batchNumber: l.batchNumber || undefined, expiryDate: l.expiryDate || undefined } : {}),
       sortOrder: idx,
    }));
    const common = {
      invoiceNumber: `DRAFT-${Date.now()}`,
      invoiceType: config.invoiceType,
      invoiceDate,
      dueDate: dueDate || undefined,
      warehouseId: warehouseId ?? undefined,
      journalId: journalId ?? undefined,
      currency,
      exchangeRate,
      subtotal: fmt(subtotal), discountAmount: fmt(totalDiscount),
      taxAmount: fmt(totalTax), total: fmt(netTotal),
      paidAmount: "0.000", remainingAmount: fmt(netTotal),
      paymentMethod: "credit" as any,
      status: "draft" as any,
      notes: notes || undefined,
      items: itemsPayload,
    };
    try {
      if (config.docCategory === "sales") {
        await salesCreateMutation.mutateAsync({ ...common, customerId: partyId ?? undefined, customerName: partyName || undefined } as any);
      } else {
        await purchaseCreateMutation.mutateAsync({
          ...common,
          supplierId: partyId ?? undefined,
          supplierName: partyName || undefined,
          supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        });
      }
    } catch {
      throw new Error("draft-save-failed");
    }
  }, [
    invoiceDate, dueDate, partyId, partyName, supplierInvoiceNumber, warehouseId,
    currency, exchangeRate, notes, lines, subtotal, totalDiscount, totalTax, netTotal,
    salesCreateMutation, purchaseCreateMutation, journalId, config.docCategory, config.invoiceType,
  ]);

  // ── التنقل المركزي بين المستندات المحفوظة ────────────────────────────────────
  const {
    handlers: navHandlers,
    hasRecord: navHasRecord,
    hasPrevious: navHasPrevious,
    hasNext: navHasNext,
    showUnsavedDialog: navShowUnsavedDialog,
    unsavedDialogActions: navUnsavedDialogActions,
    isSavingDraft: navIsSavingDraft,
  } = useDocumentNavigation({
    records: (listQuery.data as any) as Array<{ id: number }> | undefined,
    currentId: navInvoiceId ?? savedInvoiceId,
    setCurrentId: id => { setNavInvoiceId(id); },
    isDirty,
    isEmpty: isDocumentEmpty,
    saveAsDraft: handleSaveDraft,
    onBeforeNavigate: () => setErpMode("view" as ERPMode),
  });

  // ── Unified Toolbar ──────────────────────────────────────────────────────────
  const _tbRef = useRef<any>({});
  _tbRef.current = { erpMode, isSaving, savedInvoiceId, isPosted, isPrintEnabled, config, handleSave, handleNew, handleDuplicate, setErpMode, setPendingNav, setShowUnsaved, setShowPrintModal, setShowPostingPreview, unpostMutation: activeUnpostMutation };
  const toolbarActions = useMemo(() => {
    const canPost = config.canPost !== false;
    const hasSaved = savedInvoiceId !== null;
    const isDirtyMode = erpMode === "new" || erpMode === "edit";
    return ({
      save: { supported: true as const, allowed: true, loading: isSaving, stateEnabled: !isSaving && isDirtyMode, disabledReason: isDirtyMode ? undefined : "وضع العرض — اضغط تعديل أولًا", onClick: () => { _tbRef.current.handleSave(); } },
      new: { supported: true as const, allowed: true, stateEnabled: true, onClick: () => { const s = _tbRef.current; const dirty = s.erpMode === "new" || s.erpMode === "edit"; const doNew = () => { s.handleNew(); s.setErpMode("new"); }; if (dirty) { s.setPendingNav(() => doNew); s.setShowUnsaved(true); } else doNew(); } },
      duplicate: { supported: true as const, allowed: true, stateEnabled: hasSaved, disabledReason: "احفظ المستند أولًا لنسخه", onClick: () => _tbRef.current.handleDuplicate() },
      edit: { supported: true as const, allowed: true, stateEnabled: erpMode === "view", disabledReason: erpMode !== "view" ? "المستند في وضع التعديل بالفعل" : undefined, onClick: () => { _tbRef.current.setErpMode("edit"); toast.info("وضع التعديل"); } },
      delete: { supported: false as const, disabledReason: "حذف المستند غير متاح في هذه الشاشة" },
      draft: { supported: false as const, disabledReason: "المسودة غير مستخدمة" },
      first:    { supported: true as const, stateEnabled: navHasRecord, disabledReason: "لا توجد سجلات", onClick: navHandlers.first },
      previous: { supported: true as const, stateEnabled: navHasPrevious, disabledReason: "لا يوجد سجل سابق", onClick: navHandlers.previous },
      next:     { supported: true as const, stateEnabled: navHasNext, disabledReason: "لا يوجد سجل تالي", onClick: navHandlers.next },
      last:     { supported: true as const, stateEnabled: navHasRecord, disabledReason: "لا توجد سجلات", onClick: navHandlers.last },
      approve: { supported: true as const, allowed: true, stateEnabled: hasSaved, disabledReason: "احفظ المستند أولًا للاعتماد", onClick: () => toast.success("تم الاعتماد") },
      unapprove: { supported: canPost, allowed: true, stateEnabled: hasSaved && isPosted, disabledReason: !hasSaved ? "احفظ المستند أولًا" : !isPosted ? "المستند غير مرحّل" : undefined, onClick: () => { const s = _tbRef.current; if (!s.savedInvoiceId) return; if (window.confirm("هل أنت متأكد من إلغاء ترحيل هذا المستند؟")) s.unpostMutation.mutate({ invoiceId: s.savedInvoiceId! }); } },
      preview: { supported: true as const, allowed: true, stateEnabled: hasSaved, disabledReason: "احفظ المستند أولًا للمطالعة", onClick: () => { const s = _tbRef.current; if (s.savedInvoiceId) s.setErpMode("view"); else toast.info("لا يوجد سجل محفوظ للمطالعة"); } },
      tools: { supported: true as const, allowed: true, stateEnabled: hasSaved, disabledReason: "احفظ المستند أولًا" },
      send: { supported: false as const, disabledReason: "الإرسال غير متاح في هذه الشاشة" },
      print: { supported: true as const, allowed: true, stateEnabled: hasSaved, disabledReason: "احفظ المستند أولًا للطباعة", onClick: () => { const s = _tbRef.current; if (s.isPrintEnabled) s.setShowPrintModal(true); else toast.info("جاري الطباعة..."); } },
      exit: { supported: true as const, allowed: true, stateEnabled: true, onClick: () => { const s = _tbRef.current; const dirty = s.erpMode === "new" || s.erpMode === "edit"; const doExit = () => toast.info("أغلق التبويب لإغلاق الشاشة"); if (dirty) { s.setPendingNav(() => doExit); s.setShowUnsaved(true); } else doExit(); } },
    }) as unknown as ToolbarActionMap;
  }, [erpMode, isSaving, savedInvoiceId, isPosted, isPrintEnabled, config, navHasRecord, navHasPrevious, navHasNext, navHandlers]);
  const toolbarTools = useMemo(() => {
    const canPost = config.canPost !== false;
    const hasSaved = savedInvoiceId !== null;
    return [
      { id: "post", label: "ترحيل المستند", enabled: canPost && hasSaved && !isPosted, disabledReason: !canPost ? "الترحيل غير متاح لهذا النوع" : !hasSaved ? "احفظ المستند أولًا" : isPosted ? "المستند مرحّل بالفعل" : undefined, onClick: () => { if (!_tbRef.current.savedInvoiceId) { toast.warning("يجب حفظ المستند أولاً"); return; } _tbRef.current.setShowPostingPreview(true); } },
      { id: "unpost", label: "إلغاء ترحيل المستند", enabled: canPost && hasSaved && isPosted, disabledReason: !canPost ? "غير متاح" : !isPosted ? "المستند غير مرحّل" : undefined, onClick: () => { const s = _tbRef.current; if (!s.savedInvoiceId) return; if (window.confirm("هل أنت متأكد من إلغاء ترحيل هذا المستند؟")) s.unpostMutation.mutate({ invoiceId: s.savedInvoiceId! }); } },
      { id: "suspend", label: "تعليق الترحيل", enabled: false, disabledReason: "قريباً" },
      { id: "activity", label: "نشاط المستخدمين", separatorBefore: true as const, enabled: false, disabledReason: "قريباً" },
      { id: "attachments", label: "إرفاق المستندات", enabled: false, disabledReason: "قريباً" },
    ];
  }, [config, savedInvoiceId, isPosted]);
  useToolbarActions(toolbarActions, toolbarTools);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`${styles.screenContainer} flex flex-col h-full text-[#2d241e] select-none ${config.docCategory === "purchase" ? "purchase-invoice-page" : ""}`}
      style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: "12px", background: config.docCategory === "purchase" ? "#f7f2e9" : "var(--background)" }}
      dir="rtl"
    >
      {/* ── Unsaved Changes Guard ──────────────────────────────────────────────── */}
      <UnsavedChangesDialog
        open={showUnsaved}
        isSaving={isSaving}
        onSave={() => {
          pendingNavRef.current = pendingNav;
          setShowUnsaved(false);
          setPendingNav(null);
          handleSave();
        }}
        onDiscard={() => {
          setShowUnsaved(false);
          pendingNav?.();
          setPendingNav(null);
        }}
        onCancel={() => { setShowUnsaved(false); setPendingNav(null); }}
      />

      {/* ── حوار التنقل عند وجود تعديلات غير محفوظة ── */}
      <UnsavedChangesDialog
        open={navShowUnsavedDialog}
        onSaveAsDraft={navUnsavedDialogActions.onSaveAsDraft}
        onDiscard={navUnsavedDialogActions.onDiscard}
        onCancel={navUnsavedDialogActions.onCancel}
        isSaving={navIsSavingDraft}
      />

      {/* ── Header Form ───────────────────────────────────────────────────── */}
      <div
        className={config.docCategory === "purchase" ? "purchase-invoice-header" : "border-b px-3 pt-2 pb-1.5"}
        style={{
          background: config.docCategory === "purchase" ? "#fbf8f3" : "#fff",
          borderColor: config.docCategory === "purchase" ? "#d8c7b5" : "#b0a89a",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >

        {config.docCategory === "purchase" ? (
          <div
            className="purchase-header-columns"
            style={{ direction: "rtl" }}
            data-testid="purchase-invoice-three-column-header"
          >
            {/* العمود الأول من اليمين: بيانات المستند */}
            <div className="purchase-header-column">
              <PurchaseField label="الفرع">
                <div className="flex items-center gap-1">
                  <select
                    value={selectedPurchaseBranchValue}
                    onChange={e => handlePurchaseBranchSelect(e.target.value)}
                    className="classic-input w-full font-bold"
                    style={{ borderColor: "#c8ad93", color: "#4b3424", background: "#fffdf8" }}
                  >
                    <option value="">
                      {branchesQuery.isLoading || warehousesQuery.isLoading || journalsQuery.isLoading
                        ? "جاري تحميل الفروع..."
                        : branchesQuery.error || warehousesQuery.error || journalsQuery.error
                          ? "تعذّر تحميل الفروع"
                          : "— اختر الفرع أولًا —"}
                    </option>
                    {purchaseBranchOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {(branchId || warehouseId || journalId || invoiceNumber) && (
                    <button
                      type="button"
                      onClick={clearPurchaseBranchSelection}
                      className="shrink-0 rounded border border-[#c8ad93] px-1.5 text-[11px] font-bold text-[#76533a] hover:bg-[#f3e8dc]"
                      title="مسح الفرع والمخزن والدفتر ورقم المستند"
                      aria-label="مسح اختيار الفرع"
                    >
                      ×
                    </button>
                  )}
                </div>
              </PurchaseField>
              <PurchaseField label="رقم المستند">
                <input
                  value={branchId ? invoiceNumber : ""}
                  readOnly
                  placeholder="يظهر بعد اختيار الفرع"
                  className="classic-input w-full text-center font-bold"
                  style={{ borderColor: "#c8ad93", background: "#f8f1e8", color: "#4b3424" }}
                />
              </PurchaseField>
              <PurchaseField label="المخزن">
                <input
                  value={branchId ? warehouseDisplayName : ""}
                  readOnly
                  placeholder="يحدد تلقائيًا من الفرع"
                  className="classic-input w-full"
                  style={{ borderColor: "#c8ad93", background: "#f8f1e8", color: "#4b3424" }}
                />
              </PurchaseField>
              <PurchaseField label="تاريخ التحرير">
                <DateSegmentInput value={invoiceDate} onChange={setInvoiceDate} standalone className="classic-input w-full" />
              </PurchaseField>
              <PurchaseField label="تاريخ الاستحقاق">
                <DateSegmentInput value={dueDate} onChange={setDueDate} standalone className="classic-input w-full" />
              </PurchaseField>
            </div>

            {/* العمود الأوسط: المورد وبياناته */}
            <div className="purchase-header-column">
              <PurchaseField label="اسم المورد">
                <select value={partyId ?? ""} onChange={e => {
                  const id = parseInt(e.target.value);
                  setPartyId(isNaN(id) ? null : id);
                  const supplier = (parties as any[]).find((item: any) => item.id === id);
                  setPartyName(supplier?.name ?? "");
                }} className="classic-input w-full">
                  <option value="">-- اختر المورد --</option>
                  {(parties as any[]).map((party: any) => <option key={party.id} value={party.id}>{party.name}</option>)}
                </select>
              </PurchaseField>
              <PurchaseField label="رقم فاتورة المورد">
                <input value={supplierInvoiceNumber} onChange={e => setSupplierInvoiceNumber(e.target.value)} className="classic-input w-full" />
              </PurchaseField>
              <PurchaseField label="ملاحظة" alignStart>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="classic-input w-full resize-none" style={{ height: 62 }} />
              </PurchaseField>
            </div>

            {/* العمود الثالث من اليمين: المرجع والعملة والضريبة */}
            <div className="purchase-header-column">
              <PurchaseField label="بناءً على">
                <input disabled className="classic-input w-full" placeholder="—" />
              </PurchaseField>
              <PurchaseField label="رقم المستند">
                <input value={basedOnNum} onChange={e => setBasedOnNum(e.target.value)} className="classic-input w-full" placeholder="رقم المستند..." />
              </PurchaseField>
              <PurchaseField label="العملة">
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="classic-input w-full">
                  <option value="SAR">ريال (SAR)</option><option value="USD">دولار (USD)</option>
                  <option value="EUR">يورو (EUR)</option><option value="AED">درهم (AED)</option>
                </select>
              </PurchaseField>
              <PurchaseField label="سعر الصرف">
                <input value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="classic-input w-full text-center" />
              </PurchaseField>
              <PurchaseField label="نوع السند">
                {(() => {
                  const allDocTypes = docTypesQuery.data ?? [];
                  const filteredDocTypes = journalId ? allDocTypes.filter((dt: any) => dt.journal === String(journalId)) : allDocTypes;
                  return allDocTypes.length > 0 ? (
                    <select value={docTypeId} onChange={e => handleDocTypeSelect(e.target.value)} className="classic-input w-full">
                      <option value="">— اختر نوع السند —</option>
                      {filteredDocTypes.map((dt: any) => <option key={dt.id} value={String(dt.id)}>{dt.codeAr ? `${dt.codeAr} — ${dt.nameAr}` : dt.nameAr}</option>)}
                    </select>
                  ) : (
                    <select value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)} className="classic-input w-full">
                      <option value="cash">نقدًا</option><option value="credit">آجل</option>
                    </select>
                  );
                })()}
              </PurchaseField>
            </div>
          </div>
        ) : (
        <>
        {/* Row 1: رقم المستند + 5-col grid */}
        <div className="flex items-start gap-2 mb-1.5">

          {/* ─ رقم المستند مع منتقي الدفتر ─ */}
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
              <div className="flex flex-col gap-0.5 flex-shrink-0 relative" style={{ minWidth: 176 }}>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-bold text-[#406B93] uppercase tracking-wide">رقم المستند</label>
                  {selected && (
                    <span className="text-[9px] px-1 py-0 rounded font-medium cursor-pointer"
                      style={{ background: "#dbeafe", color: "#1d4ed8", lineHeight: "14px" }}
                      onClick={() => setJournalId(null)} title="إلغاء الدفتر">
                      {selected.name} ✕
                    </span>
                  )}
                </div>
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
                    }} title="كليك يمين أو F4 لاختيار الدفتر" />
                  <button onClick={() => setJournalOpen(o => !o)}
                    className="flex items-center justify-center transition-colors"
                    style={{
                      width: 22, borderRadius: "0 4px 4px 0",
                      background: selected ? "#3b82f6" : "#F59E0B",
                      border: `1px solid ${selected ? "#2563eb" : "#d97706"}`,
                      color: "white", fontSize: "9px",
                    }} title="اختيار الدفتر">▼</button>
                </div>
                {journalOpen && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setJournalOpen(false)} />
                    <div className="absolute top-full right-0 z-[9999] mt-1 bg-white rounded-lg overflow-hidden"
                      style={{ minWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)", border: "1px solid #e2e8f0" }} dir="rtl">
                      <div className="flex items-center justify-between px-3 py-2" style={{ background: "#1e40af" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-[11px] font-bold">{config.journalDropdownTitle}</span>
                          {journals.length > 0 && (
                            <span className="text-[9px] px-1.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>{journals.length}</span>
                          )}
                        </div>
                        <button onClick={() => setJournalOpen(false)} style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>✕</button>
                      </div>
                      {journals.length === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <div className="text-[20px] mb-1">📒</div>
                          <div className="text-[11px] text-slate-500 font-medium">لا توجد دفاتر مُعرَّفة</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">أضف دفاتر من إعدادات المستندات</div>
                        </div>
                      ) : (
                        <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                          {journals.map((j: any, idx: number) => {
                            const isSel = j.id === journalId;
                            return (
                              <button key={j.id} onClick={() => handleJournalSelect(j.id)}
                                className="w-full flex items-center text-right transition-colors"
                                style={{ background: isSel ? "#eff6ff" : idx % 2 === 0 ? "#fafafa" : "white", borderBottom: "1px solid #f1f5f9", padding: "6px 12px" }}>
                                <span style={{ width: 16, color: isSel ? "#3b82f6" : "transparent", fontSize: "11px", flexShrink: 0 }}>✓</span>
                                <div className="flex-1 min-w-0 mx-2">
                                  <div className="text-[12px] font-semibold truncate" style={{ color: isSel ? "#1d4ed8" : "#1e293b" }}>
                                    {config.pageTitle} – {j.name}
                                  </div>
                                  {j.description && <div className="text-[10px] text-slate-400 truncate">{j.description}</div>}
                                </div>
                                <div className="shrink-0">
                                  <div className="font-mono text-[11px] font-bold px-2 py-0.5 rounded"
                                    style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                                    {previewNum(j)}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                        <span className="text-[9px] text-slate-400">كليك يمين أو F4 لفتح القائمة</span>
                        {journalId && (
                          <button onClick={() => { setJournalId(null); setJournalOpen(false); }} className="text-[9px] text-red-400 hover:text-red-600">
                            إلغاء اختيار الدفتر
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* ─ 5-col main fields ─ */}
          <div className={`${styles.formGrid5} gap-x-2 gap-y-1`}>
            <HF label={config.partyLabel}>
              <select value={partyId ?? ""} onChange={e => {
                const id = parseInt(e.target.value);
                setPartyId(isNaN(id) ? null : id);
                const p = (parties as any[]).find((x: any) => x.id === id);
                setPartyName(p?.name ?? "");
              }} className="classic-input w-full">
                <option value="">-- اختر {config.partyLabel} --</option>
                {(parties as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </HF>
            <HF label="تاريخ التحرير">
              <DateSegmentInput value={invoiceDate} onChange={setInvoiceDate} standalone className="classic-input w-full" />
            </HF>
            <HF label="تاريخ الاستحقاق">
              <DateSegmentInput value={dueDate} onChange={setDueDate} standalone className="classic-input w-full" />
            </HF>
            <HF label="المخزن">
              {(() => {
                const lockedWh = journalWarehouseId ?? docTypeWarehouseId;
                const whFromList = warehousesQuery.data?.find(w => w.id === (lockedWh ?? warehouseId));
                const whName = whFromList?.name ?? warehouseDisplayName ?? "";
                return (
                  <select value={warehouseId ?? ""}
                    onChange={e => !lockedWh && setWarehouseId(parseInt(e.target.value) || null)}
                     className="classic-input w-full" disabled={!!lockedWh}
                    title={lockedWh ? `المخزن: ${whName}` : undefined}>
                    <option value="">-- اختر مخزن --</option>
                    {(lockedWh
                      ? warehousesQuery.data?.filter(w => w.id === lockedWh)
                      : warehousesQuery.data
                    )?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    {lockedWh && !whFromList && warehouseId && (
                      <option key={warehouseId} value={warehouseId}>{whName}</option>
                    )}
                  </select>
                );
              })()}
            </HF>
            <HF label="البائع / المندوب">
              <input value={salesperson} onChange={e => setSalesperson(e.target.value)} className="classic-input w-full" />
            </HF>
          </div>
        </div>

        {/* Row 2 */}
        <div className={`${styles.formGrid6} gap-x-2 gap-y-1`}>

          {/* نوع السند */}
          <HF label="نوع السند">
            {(() => {
              const allDocTypes = docTypesQuery.data ?? [];
              const filteredDocTypes = journalId ? allDocTypes.filter((dt: any) => dt.journal === String(journalId)) : allDocTypes;
              const selectedDT = docTypeId ? allDocTypes.find((dt: any) => String(dt.id) === docTypeId) : null;
              if (allDocTypes.length > 0) {
                return (
                  <div className="relative w-full">
                    {selectedDT && (
                      <div className="absolute inset-0 flex items-center px-2 pointer-events-none z-10">
                        <span className="font-bold text-blue-800 text-[12px] truncate">{selectedDT.codeAr || selectedDT.nameAr}</span>
                      </div>
                    )}
                    <select value={docTypeId} onChange={e => handleDocTypeSelect(e.target.value)}
                      className="classic-input w-full"
                      style={{ fontWeight: 600, color: selectedDT ? "transparent" : undefined }}>
                      <option value="">— اختر نوع السند —</option>
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
                <select value={paymentType} onChange={e => { setPaymentType(e.target.value as PaymentType); setPaidAmountOverride(""); }}
                  className="classic-input w-full"
                  style={{ background: paymentType === "cash" ? "#F0FDF4" : "#FFF7ED", borderColor: paymentType === "cash" ? "#16A34A" : "#D97706", fontWeight: 700, color: paymentType === "cash" ? "#15803D" : "#B45309" }}>
                  <option value="cash">نقدًا</option>
                  <option value="credit">آجل</option>
                </select>
              );
            })()}
          </HF>

          <HF label="العملة">
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="classic-input w-full">
              <option value="SAR">ريال (SAR)</option>
              <option value="USD">دولار (USD)</option>
              <option value="EUR">يورو (EUR)</option>
              <option value="AED">درهم (AED)</option>
            </select>
          </HF>

          <HF label="سعر الصرف">
            <input value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="classic-input w-full text-center" />
          </HF>

          {/* بناءً على (sales) | رقم فاتورة المورد (purchase) */}
          <HF label="بناءً على">
            {(config.basedOnOptions && config.basedOnOptions.length > 0) ? (
              <div className="flex gap-1 w-full">
                <select value={basedOnType}
                  onChange={e => { setBasedOnType(e.target.value); setBasedOnNum(""); setBasedOnTrigger(""); }}
                  className="classic-input" style={{ minWidth: 100, flex: "0 0 auto" }}>
                  <option value="">-- النوع --</option>
                  {config.basedOnOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className="relative flex-1">
                  <input value={basedOnNum} onChange={e => setBasedOnNum(e.target.value)}
                    onBlur={() => { if (basedOnType && basedOnNum.trim()) setBasedOnTrigger(basedOnNum.trim()); }}
                    onKeyDown={e => { if (e.key === "Enter" && basedOnType && basedOnNum.trim()) setBasedOnTrigger(basedOnNum.trim()); }}
                    placeholder={basedOnType ? "رقم المستند..." : ""} disabled={!basedOnType}
                    className="classic-input w-full" />
                  {basedOnQuery.isFetching && <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-blue-500">⏳</span>}
                  {basedOnTrigger && !basedOnQuery.isFetching && basedOnQuery.data === null && <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-red-500">✗</span>}
                  {basedOnTrigger && !basedOnQuery.isFetching && basedOnQuery.data && <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-green-600">✓</span>}
                </div>
              </div>
            ) : (
              <input disabled className="classic-input w-full" placeholder="—" />
            )}
          </HF>

          <HF label="ملحوظة">
            <input value={notes} onChange={e => setNotes(e.target.value)} className="classic-input w-full" />
          </HF>

          <div />
        </div>
        </>
        )}
      </div>

      {/* ── Lines Table ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white border-b border-[#b0a89a]">
        <table className="w-full border-collapse" style={{ fontSize: config.docCategory === "purchase" ? "13px" : "12px" }}>
          {/* Column widths — sourced centrally from INVOICE_TABLE_COLS via InvoiceTableColgroup */}
          <InvoiceTableColgroup />
          <thead className="sticky top-0 z-10">
            <tr style={{
              background: config.docCategory === "purchase"
                ? "linear-gradient(to bottom, #6b7075, #4d5257)"
                : `linear-gradient(to bottom, ${themeColor}, #365E80)`,
              color: "#fff",
            }}>
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
              {config.docCategory === "purchase" && <th className="inv-th text-center">التشغيلة</th>}
              {config.docCategory === "purchase" && <th className="inv-th text-center">تاريخ الصلاحية</th>}
              <th className="inv-th"></th>
            </tr>
          </thead>
          <tbody data-nav-internal="true">
            {lines.map((line, rowIdx) => (
              <tr key={line.id}
                className={`border-b border-[#e8e4dc] ${selectedLineIdx === rowIdx ? "bg-[#EEF4FA]" : rowIdx % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]"}`}
                onClick={() => setSelectedLineIdx(rowIdx)}>
                <td className="inv-td text-center text-[#999] text-[11px]">{rowIdx + 1}</td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-0`, el); }}
                    value={line.productCode} onChange={e => handleProductCodeChange(rowIdx, e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)} onKeyDown={e => handleCellKeyDown(e, rowIdx, 0)}
                    className="inv-cell" placeholder="كود..." />
                </td>
                <td className="inv-td p-0">
                  <ProductNameCell rowIdx={rowIdx} value={line.productName} products={productsQuery.data ?? []} cellRefs={cellRefs}
                    onSelect={(name, code, id, unit, price, tax) => {
                      setLines(prev => {
                        const u = [...prev];
                        const l = { ...u[rowIdx], productName: name, productCode: code, productId: id, unit, unitPrice: price, taxPct: tax };
                        l.total = calcLineTotal(l); u[rowIdx] = l; return u;
                      });
                    }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 1)} onFocus={() => setSelectedLineIdx(rowIdx)} />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-2`, el); }} type="number"
                    value={line.quantity} onChange={e => updateLine(rowIdx, "quantity", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }} onKeyDown={e => handleCellKeyDown(e, rowIdx, 2)}
                    className="inv-cell text-center" min="0" />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-3`, el); }}
                    value={line.unit} onChange={e => updateLine(rowIdx, "unit", e.target.value)}
                    onFocus={() => setSelectedLineIdx(rowIdx)} onKeyDown={e => handleCellKeyDown(e, rowIdx, 3)}
                    className="inv-cell text-center" placeholder="وحدة" />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-4`, el); }} type="number"
                    value={line.unitPrice} onChange={e => updateLine(rowIdx, "unitPrice", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }} onKeyDown={e => handleCellKeyDown(e, rowIdx, 4)}
                    className="inv-cell text-center" min="0" />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-5`, el); }} type="number"
                    value={line.discountPct} onChange={e => updateLine(rowIdx, "discountPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }} onKeyDown={e => handleCellKeyDown(e, rowIdx, 5)}
                    className="inv-cell text-center" min="0" max="100" />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-6`, el); }} type="number"
                    value={line.discountAmt} onChange={e => updateLine(rowIdx, "discountAmt", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }} onKeyDown={e => handleCellKeyDown(e, rowIdx, 6)}
                    className="inv-cell text-center" min="0" />
                </td>
                <td className="inv-td p-0">
                  <input ref={el => { if (el) cellRefs.current.set(`${rowIdx}-7`, el); }} type="number"
                    value={line.taxPct} onChange={e => updateLine(rowIdx, "taxPct", e.target.value)}
                    onFocus={e => { setSelectedLineIdx(rowIdx); e.target.select(); }} onKeyDown={e => handleCellKeyDown(e, rowIdx, 7)}
                    className="inv-cell text-center" min="0" max="100" />
                </td>
                <td className="inv-td text-center font-bold" style={{ color: "#003399", fontSize: "12px" }}>
                  {parseFloat(line.total).toFixed(3)}
                </td>
                {config.docCategory === "purchase" && (
                  <>
                    <td className="inv-td p-0">
                      <input
                        ref={el => { if (el) cellRefs.current.set(`${rowIdx}-8`, el); }}
                        value={line.batchNumber}
                        onChange={e => updateLine(rowIdx, "batchNumber", e.target.value)}
                        onFocus={() => setSelectedLineIdx(rowIdx)}
                        onKeyDown={e => handleCellKeyDown(e, rowIdx, 8)}
                        className="inv-cell text-center"
                        placeholder="تشغيلة"
                      />
                    </td>
                    <td className="inv-td p-0">
                      <input
                        ref={el => { if (el) cellRefs.current.set(`${rowIdx}-9`, el); }}
                        value={line.expiryDate}
                        onChange={e => updateLine(rowIdx, "expiryDate", e.target.value)}
                        onFocus={() => setSelectedLineIdx(rowIdx)}
                        onKeyDown={e => handleCellKeyDown(e, rowIdx, 9)}
                        className="inv-cell text-center"
                        placeholder="YYYY-MM-DD"
                        maxLength={10}
                      />
                    </td>
                  </>
                )}
                <td className="inv-td text-center">
                  <button onClick={() => deleteLine(rowIdx)} className="text-red-400 hover:text-red-600 transition-colors" title="حذف السطر (Ctrl+Del)">
                    <X className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-2 py-1.5 border-t border-[#e8e4dc]">
          <button onClick={addLine} className="flex items-center gap-1 text-[11px] text-[#406B93] hover:text-[#2d4f6e] hover:underline transition-colors">
            <Plus className="w-3 h-3" />
            إضافة سطر جديد
            <span className="text-[#aaa] mr-1">(Enter في آخر سطر)</span>
          </button>
        </div>
      </div>

      {/* ── Totals / payment summary ─────────────────────────────────────── */}
      {config.docCategory === "purchase" ? (
        <div className="purchase-sales-like-totals" dir="rtl">
          <div className="purchase-total-group">
            <span>إجمالي قبل الخصم</span><strong>{fmt(subtotal)}</strong>
            <span>إجمالي الخصم</span><strong className="purchase-negative">{fmt(totalDiscount)}</strong>
            <span>إجمالي بعد الخصم</span><strong>{fmt(subtotal - totalDiscount)}</strong>
            <span>إجمالي الضريبة</span><strong>{fmt(totalTax)}</strong>
            <span>صافي الفاتورة</span><strong>{fmt(netTotal)}</strong>
          </div>
          <div className="purchase-net-total">
            <span>صافي الفاتورة</span>
            <strong>{fmt(netTotal)}</strong>
            <small>{currency === "SAR" ? "ريال سعودي" : currency}</small>
          </div>
        </div>
      ) : (
        <div style={{ background: "#E8E4DC", borderTop: "1px solid #b0a89a" }}>
          <div className="flex items-center gap-0 px-3 py-1.5">
            <div className="flex items-center gap-3 flex-1">
              <TF label="إجمالي" value={fmt(subtotal)} />
              <span className="text-[#aaa]">−</span>
              <TF label="الخصم" value={fmt(totalDiscount)} color="#C0392B" />
              <span className="text-[#aaa]">+</span>
              <TF label="الضريبة" value={fmt(totalTax)} />
            </div>
            <div style={{ width: 1, height: 28, background: "#b0a89a", margin: "0 12px" }} />
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
                    <input type="number" value={paidAmountOverride} onChange={e => setPaidAmountOverride(e.target.value)}
                      placeholder="0.000" className="classic-input text-center w-24"
                      style={{ background: "#FFF7ED", borderColor: "#D97706" }} min="0" />
                  </div>
                  <TF label="المتبقي" value={fmt(remainingAmount)} color={remainingAmount > 0 ? "#C0392B" : "#16A34A"} />
                </>
              )}
              <div style={{ width: 1, height: 28, background: "#b0a89a", margin: "0 4px" }} />
              <TF label="الإجمالي الكلي" value={fmt(netTotal)} highlight big />
            </div>
          </div>
        </div>
      )}

      {/* ── Styles ────────────────────────────────────────────────────────── */}
       <style>{`
         .classic-input {
           border: 1px solid #a0a0a0; padding: 2px 6px; height: ${config.docCategory === "purchase" ? "25px" : "22px"}; font-size: ${config.docCategory === "purchase" ? "13px" : "12px"};
          font-family: 'Cairo', Tahoma, Arial, sans-serif; background: #fff; outline: none; border-radius: 1px;
        }
          .classic-input:focus { border: 2px solid ${config.docCategory === "purchase" ? "#8a5a2b" : "#406B93"}; background: ${config.docCategory === "purchase" ? "#fffdf8" : "#F0F6FF"}; box-shadow: 0 0 0 2px ${config.docCategory === "purchase" ? "rgba(138,90,43,0.2)" : "rgba(64,107,147,0.2)"}; }
         .classic-input::placeholder, .inv-cell::placeholder { color: ${config.docCategory === "purchase" ? "#766558" : "#888"}; opacity: 1; }
         .inv-th { border: 1px solid rgba(255,255,255,0.15); border-bottom: 2px solid rgba(0,0,0,0.15); padding: ${config.docCategory === "purchase" ? "6px 6px" : "4px 6px"}; text-align: right; font-weight: 800; font-size: ${config.docCategory === "purchase" ? "12px" : "11px"}; line-height: 16px; white-space: nowrap; font-family: 'Cairo', Tahoma, sans-serif; }
         .inv-td { border: 1px solid #e8e4dc; padding: 1px 3px; height: ${config.docCategory === "purchase" ? "27px" : "24px"}; vertical-align: middle; }
         .inv-cell { border: none; outline: none; padding: 2px 4px; height: ${config.docCategory === "purchase" ? "25px" : "22px"}; font-size: ${config.docCategory === "purchase" ? "13px" : "12px"}; font-weight: ${config.docCategory === "purchase" ? "600" : "400"}; font-family: 'Cairo', Tahoma, Arial, sans-serif; color: ${config.docCategory === "purchase" ? "#241b15" : "inherit"}; background: transparent; width: 100%; }
          .inv-cell:focus { background: ${config.docCategory === "purchase" ? "#fffdf8" : "#FFFFF0"}; border: 2px solid ${config.docCategory === "purchase" ? "#8a5a2b" : "#406B93"}; box-shadow: inset 0 0 0 1px ${config.docCategory === "purchase" ? "rgba(138,90,43,0.15)" : "rgba(64,107,147,0.15)"}; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* ── Posting Preview ───────────────────────────────────────────────── */}
      {showPostingPreview && savedInvoiceId && (
        <PostingPreviewModal
          invoiceId={savedInvoiceId}
          docCategory={config.docCategory}
          onClose={() => setShowPostingPreview(false)}
          onConfirmPost={() => activePostMutation.mutate({ invoiceId: savedInvoiceId! })}
          isPosting={activePostMutation.isPending}
        />
      )}

      {/* ── Print Modal (Purchase Invoice / Sales Return) ──────────────────── */}
      {showPrintModal && isPrintEnabled && (
        <InvoicePrintModal
          open={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          docType={printDocType as "sales_invoice" | "purchase_invoice" | "purchase_order" | "purchase_return"}
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
            customerName: partyName || (config.docCategory === "purchase" ? "المورد" : "العميل"),
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
    </div>
  );
}
