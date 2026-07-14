/**
 * RePurchasesPage.tsx -- البيان التفصيلي للمشتريات (Phase 3c)
 * تبسيط الإدخال: إجمالي شامل فقط قابل للتعديل، باقي الحقول محسوب تلقائيًا
 * استيراد Excel مع معاينة وتحقق وكشف تكرار
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  ReceiptText, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2, Eye,
  Printer, FileSpreadsheet, Upload, AlertTriangle, X, Calendar, FileText,
  SortAsc, SortDesc, Copy, ArrowUpRight, ChevronLeft, Save, Ban,
  CheckCircle2, FileDown, Download,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, isAdminRole } from "@/shared/lib/hsPermissions";
import * as XLSX from "xlsx";

const C = { primary: "#406B93", border: "#D0D0D0", bgAlt: "#FAFAFA", header: "#E8EEF4", danger: "#C0392B", warn: "#F59E0B", success: "#16A34A", dupBg: "#FEF3C7", errBg: "#FEE2E2" };

// ─── تنسيق الأرقام ──────────────────────────────────────────────────────────────────────
function toEnDigits(str: string): string {
  return str.replace(/[٠-٩]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 0x0030));
}
function sanitizeNum(str: string): string {
  let s = toEnDigits(str);
  s = s.replace(/[^0-9.\-]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  const hasMinus = s.startsWith('-');
  s = s.replace(/-/g, '');
  if (hasMinus) s = '-' + s;
  return s;
}
function parseNum(str: string): number {
  const n = parseFloat(sanitizeNum(str));
  return isNaN(n) ? 0 : n;
}
function fmtN(n: number): string {
  return (n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtD(d: string | Date | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
}
function fmtDateExcel(d: string | Date | null): Date | null {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? null : dt;
}

// ─── Types ──────────────────────────────────────────────────────────────────────────────────
interface StmtForm {
  id?: number; name: string; project: string; dateFrom: string; dateTo: string;
  defaultTaxRate: string; notes: string;
}
const EMPTY_STMT: StmtForm = {
  name: "", project: "", dateFrom: new Date().toISOString().split("T")[0], dateTo: new Date().toISOString().split("T")[0],
  defaultTaxRate: "15", notes: ""
};

interface InvForm {
  id?: number; supplierName: string; supplierTaxId: string; invoiceDate: string; invoiceNumber: string;
  totalValue: string; // Phase 3c: إجمالي شامل فقط قابل للتعديل
  notes: string; attachmentUrl: string;
}
const EMPTY_INV: InvForm = {
  supplierName: "", supplierTaxId: "", invoiceDate: new Date().toISOString().split("T")[0], invoiceNumber: "",
  totalValue: "", notes: "", attachmentUrl: ""
};

// Excel import row type
interface ImportRow {
  index: number;
  supplierName: string;
  supplierTaxId: string | null;
  invoiceDate: string;
  invoiceNumber: string;
  totalValue: number;
  preTaxValue: number;
  taxAmount: number;
  taxRate: number;
  notes: string | null;
  errors: string[];
  dupInfo: any;
  valid: boolean;
}

type View = "statements" | "detail" | "stmtForm";
type InvSortCol = "sequence" | "supplierName" | "supplierTaxId" | "invoiceDate" | "invoiceNumber" | "preTaxValue" | "taxAmount" | "totalValue" | "id";

export default function RePurchasesPage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const utils = trpc.useContext();

  const isAdmin = isAdminRole(user?.role);
  const canView = canViewHsScreen(user, "hs_re_purchases");
  const canAdd = isAdmin || user?.extraPermissions?.['hs_re_purchases_add'] === true;
  const canEdit = isAdmin || user?.extraPermissions?.['hs_re_purchases_edit'] === true;
  const canDelete = isAdmin || user?.extraPermissions?.['hs_re_purchases_delete'] === true;
  const canPrint = isAdmin || user?.extraPermissions?.['hs_re_purchases_print'] === true;
  const canExport = isAdmin || user?.extraPermissions?.['hs_re_purchases_export'] === true;
  const canImport = isAdmin || user?.extraPermissions?.['hs_re_purchases_import'] === true;

  // ─── View state ───────────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("statements");
  const [selectedStmtId, setSelectedStmtId] = useState<number | null>(null);

  // ─── Statement form ─────────────────────────────────────────────────────
  const [stmtForm, setStmtForm] = useState<StmtForm>({ ...EMPTY_STMT });
  const [stmtEditId, setStmtEditId] = useState<number | null>(null);
  const [showTaxRateConfirm, setShowTaxRateConfirm] = useState(false);
  const [stmtOriginalTaxRate, setStmtOriginalTaxRate] = useState<string | null>(null);

  // ─── Invoice dialog ───────────────────────────────────────────────────────────
  const [showInvDialog, setShowInvDialog] = useState(false);
  const [invDialogForm, setInvDialogForm] = useState<InvForm>({ ...EMPTY_INV });
  const [invDialogEditId, setInvDialogEditId] = useState<number | null>(null);
  const [invDialogAllowDup, setInvDialogAllowDup] = useState(false);
  const [invDialogDupInfo, setInvDialogDupInfo] = useState<any>(null);

  // ─── Inline editing ───────────────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState<number | "new" | null>(null);
  const [inlineForm, setInlineForm] = useState<InvForm>({ ...EMPTY_INV });
  const [inlineAllowDup, setInlineAllowDup] = useState(false);
  const [inlineDupInfo, setInlineDupInfo] = useState<any>(null);

  // ─── Excel Import states ───────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [importTaxRate, setImportTaxRate] = useState(15);
  const [importSkipDups, setImportSkipDups] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── List filters ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stmtSortBy, setStmtSortBy] = useState<"name" | "project" | "dateFrom" | "id">("id");
  const [stmtSortDir, setStmtSortDir] = useState<"asc" | "desc">("desc");

  // ─── Invoice sorting ───────────────────────────────────────────────────────
  const [invSortBy, setInvSortBy] = useState<InvSortCol>("sequence");
  const [invSortDir, setInvSortDir] = useState<"asc" | "desc">("asc");

  // ─── Duplicate tracking ─────────────────────────────────────────────────────────
  const [dupMap, setDupMap] = useState<Record<number, any>>({});

  // ─── TRPC queries ───────────────────────────────────────────────────────────
  const listStmtQ = trpc.rePurchases.listStatements.useQuery(
    { search: search || undefined, project: filterProject || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, sortBy: stmtSortBy, sortDir: stmtSortDir },
    { enabled: canView }
  );
  const listInvQ = trpc.rePurchases.listInvoices.useQuery(
    { statementId: selectedStmtId!, sortBy: invSortBy, sortDir: invSortDir },
    { enabled: canView && !!selectedStmtId && view === "detail" }
  );
  const getStmtQ = trpc.rePurchases.getStatement.useQuery(
    { id: selectedStmtId! },
    { enabled: canView && !!selectedStmtId }
  );

  // ─── Mutations ──────────────────────────────────────────────────────────────────────────────────
  const createStmtMut = trpc.rePurchases.createStatement.useMutation({
    onSuccess: () => { toast.success(ar ? "تم إنشاء البيان" : "Statement created"); listStmtQ.refetch(); setView("statements"); setStmtForm({ ...EMPTY_STMT }); },
    onError: (e) => toast.error(e.message),
  });
  const updateStmtMut = trpc.rePurchases.updateStatement.useMutation({
    onSuccess: () => { toast.success(ar ? "تم تعديل البيان" : "Statement updated"); listStmtQ.refetch(); setView("statements"); setStmtForm({ ...EMPTY_STMT }); setStmtEditId(null); setShowTaxRateConfirm(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteStmtMut = trpc.rePurchases.deleteStatement.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الحذف" : "Deleted"); listStmtQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const copyStmtMut = trpc.rePurchases.copyStatement.useMutation({
    onSuccess: () => { toast.success(ar ? "تم النسخ بنجاح" : "Copied"); listStmtQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const createInvMut = trpc.rePurchases.createInvoice.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الحفظ" : "Saved"); listInvQ.refetch(); resetInvDialog(); resetInline(); refreshDupMap(); },
    onError: handleInvError,
  });
  const updateInvMut = trpc.rePurchases.updateInvoice.useMutation({
    onSuccess: () => { toast.success(ar ? "تم التعديل" : "Updated"); listInvQ.refetch(); resetInvDialog(); resetInline(); refreshDupMap(); },
    onError: handleInvError,
  });
  const deleteInvMut = trpc.rePurchases.deleteInvoice.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الحذف" : "Deleted"); listInvQ.refetch(); refreshDupMap(); },
    onError: (e) => toast.error(e.message),
  });

  // Phase 3c: import mutations
  const previewImportMut = trpc.rePurchases.previewImport.useMutation({
    onSuccess: (data) => {
      setImportPreview(data.preview as ImportRow[]);
      setImportSummary(data.summary);
      setImportTaxRate(data.taxRate);
      setShowImportModal(true);
      setImportLoading(false);
    },
    onError: (e) => { toast.error(e.message); setImportLoading(false); },
  });
  const executeImportMut = trpc.rePurchases.executeImport.useMutation({
    onSuccess: (data) => {
      toast.success(ar ? `تم استيراد ${data.imported} فاتورة` : `Imported ${data.imported} invoices`);
      setShowImportModal(false);
      setImportPreview([]); setImportSummary(null);
      listInvQ.refetch(); refreshDupMap();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleInvError(e: any) {
    if (e.data?.code === "CONFLICT" || e.message?.includes("تنبيه:")) {
      toast.error(e.message, { duration: 8000 });
    } else {
      toast.error(e.message);
    }
  }

  function resetInvDialog() {
    setShowInvDialog(false); setInvDialogForm({ ...EMPTY_INV }); setInvDialogEditId(null); setInvDialogAllowDup(false); setInvDialogDupInfo(null);
  }
  function resetInline() {
    setInlineEditId(null); setInlineForm({ ...EMPTY_INV }); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  // ─── Tax rate from statement ─────────────────────────────────────────────────────────────
  function getStatementTaxRate(): number {
    return +(getStmtQ.data?.defaultTaxRate ?? 15);
  }
  function calcFromTotal(total: number, taxRate: number) {
    const rate = taxRate / 100;
    const preTax = +(total / (1 + rate)).toFixed(4);
    const tax = +(total - preTax).toFixed(4);
    return { preTax, tax, total };
  }
  function recalcFromTotal(form: InvForm): { preTax: number; tax: number; total: number } {
    const total = parseNum(form.totalValue);
    return calcFromTotal(total, getStatementTaxRate());
  }
  function formatTotalOnBlur(form: InvForm): string {
    const n = parseNum(form.totalValue);
    return n > 0 ? n.toFixed(2) : form.totalValue;
  }

  // ─── Duplicate check ─────────────────────────────────────────────────────────────────────────
  async function checkDuplicateNow(taxId: string, invNum: string, excludeId?: number) {
    if (!taxId || !invNum) return null;
    try {
      return await utils.rePurchases.checkDuplicate.fetch({ supplierTaxId: taxId, invoiceNumber: invNum, excludeId });
    } catch { return null; }
  }

  async function refreshDupMap() {
    if (!listInvQ.data?.rows) return;
    const newMap: Record<number, any> = {};
    const rows = listInvQ.data.rows as any[];
    for (const r of rows) {
      if (r.supplier_tax_id && r.invoice_number) {
        const dup = await checkDuplicateNow(r.supplier_tax_id, r.invoice_number, r.id);
        if (dup) newMap[r.id] = dup;
      }
    }
    setDupMap(newMap);
  }

  useEffect(() => {
    refreshDupMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listInvQ.data?.rows?.length]);

  // ─── Navigation ────────────────────────────────────────────────────────────────────────────────
  const goBack = () => openTab("/hs/real-estate", ar ? "المطور العقاري" : "Real Estate", ReceiptText);
  if (!canView) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
      <ReceiptText className="w-10 h-10 opacity-30" /><p className="text-sm font-medium">{ar ? "لا تملك صلاحية" : "No permission"}</p>
      <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5"><BackIcon className="w-3.5 h-3.5" />{ar ? "رجوع" : "Back"}</Button>
    </div>
  );

  // ─── Statement form actions ──────────────────────────────────────────────────────────────
  function openStmtCreate() { setStmtForm({ ...EMPTY_STMT }); setStmtEditId(null); setView("stmtForm"); }
  function openStmtEdit(row: any) {
    setStmtForm({
      id: row.id, name: row.name ?? "", project: row.project ?? "",
      dateFrom: row.date_from ? String(row.date_from).split("T")[0] : "",
      dateTo: row.date_to ? String(row.date_to).split("T")[0] : "",
      defaultTaxRate: row.default_tax_rate != null ? String(+row.default_tax_rate) : "15",
      notes: row.notes ?? "",
    });
    setStmtEditId(row.id);
    setStmtOriginalTaxRate(row.default_tax_rate != null ? String(+row.default_tax_rate) : "15");
    setView("stmtForm");
  }
  function handleSaveStmt(applyToAll = false) {
    if (!stmtForm.name.trim()) { toast.error(ar ? "اسم البيان مطلوب" : "Statement name required"); return; }
    if (!stmtForm.dateFrom || !stmtForm.dateTo) { toast.error(ar ? "الفترة مطلوبة" : "Date range required"); return; }
    const payload = {
      name: stmtForm.name, project: stmtForm.project || null, dateFrom: stmtForm.dateFrom, dateTo: stmtForm.dateTo,
      defaultTaxRate: parseNum(stmtForm.defaultTaxRate), notes: stmtForm.notes || null
    };
    if (stmtEditId) {
      updateStmtMut.mutate({ id: stmtEditId, data: payload, applyToAll });
    } else {
      createStmtMut.mutate({ data: payload });
    }
  }

  // ─── Invoice dialog actions (Phase 3c: total-only editable) ──────────────────────────────────────
  function openInvDialog(row?: any) {
    if (!selectedStmtId) { toast.error(ar ? "اختر بياناً أولاً" : "Select a statement first"); return; }
    if (row) {
      setInvDialogForm({
        id: row.id, supplierName: row.supplier_name ?? "", supplierTaxId: row.supplier_tax_id ?? "",
        invoiceDate: row.invoice_date ? String(row.invoice_date).split("T")[0] : "", invoiceNumber: row.invoice_number ?? "",
        totalValue: row.total_value ? String(+row.total_value) : "",
        notes: row.notes ?? "", attachmentUrl: row.attachment_url ?? "",
      });
      setInvDialogEditId(row.id);
    } else {
      setInvDialogForm({ ...EMPTY_INV });
      setInvDialogEditId(null);
    }
    setInvDialogAllowDup(false); setInvDialogDupInfo(null); setShowInvDialog(true);
  }

  async function handleSaveInvDialog(andNew = false) {
    if (!selectedStmtId) return;
    const f = invDialogForm;
    if (!f.supplierName.trim()) { toast.error(ar ? "اسم المورد مطلوب" : "Supplier name required"); return; }
    if (!f.invoiceNumber.trim()) { toast.error(ar ? "رقم الفاتورة مطلوب" : "Invoice number required"); return; }
    if (!f.invoiceDate) { toast.error(ar ? "تاريخ الفاتورة مطلوب" : "Date required"); return; }
    if (f.supplierTaxId && !invDialogAllowDup) {
      const dup = await checkDuplicateNow(f.supplierTaxId, f.invoiceNumber, invDialogEditId ?? undefined);
      if (dup) { setInvDialogDupInfo(dup); return; }
    }
    const payload = {
      supplierName: f.supplierName, supplierTaxId: f.supplierTaxId || null, invoiceDate: f.invoiceDate, invoiceNumber: f.invoiceNumber,
      totalValue: parseNum(f.totalValue), notes: f.notes || null, attachmentUrl: f.attachmentUrl || null,
    };
    if (invDialogEditId) {
      updateInvMut.mutate({ id: invDialogEditId, data: payload, allowDuplicate: invDialogAllowDup });
    } else {
      createInvMut.mutate({ statementId: selectedStmtId, data: payload, allowDuplicate: invDialogAllowDup }, {
        onSuccess: () => { if (andNew) { setInvDialogForm({ ...EMPTY_INV }); setInvDialogEditId(null); setInvDialogAllowDup(false); setInvDialogDupInfo(null); } }
      });
    }
  }

  // ─── Inline invoice actions ─────────────────────────────────────────────────────────────────────────
  async function saveInline() {
    if (!selectedStmtId) return;
    const f = inlineForm;
    if (!f.supplierName.trim() || !f.invoiceNumber.trim() || !f.invoiceDate) {
      if (!f.supplierName.trim() && !f.invoiceNumber.trim()) { resetInline(); return; }
      toast.error(ar ? "املأ الحقول المطلوبة" : "Fill required fields"); return;
    }
    if (f.supplierTaxId && !inlineAllowDup) {
      const dup = await checkDuplicateNow(f.supplierTaxId, f.invoiceNumber, inlineEditId !== "new" ? inlineEditId ?? undefined : undefined);
      if (dup) { setInlineDupInfo(dup); return; }
    }
    const payload = {
      supplierName: f.supplierName, supplierTaxId: f.supplierTaxId || null, invoiceDate: f.invoiceDate, invoiceNumber: f.invoiceNumber,
      totalValue: parseNum(f.totalValue), notes: f.notes || null, attachmentUrl: f.attachmentUrl || null,
    };
    if (inlineEditId === "new") {
      createInvMut.mutate({ statementId: selectedStmtId, data: payload, allowDuplicate: inlineAllowDup });
    } else if (inlineEditId && typeof inlineEditId === "number") {
      updateInvMut.mutate({ id: inlineEditId, data: payload, allowDuplicate: inlineAllowDup });
    }
  }

  function startInlineEdit(row: any) {
    setInlineForm({
      id: row.id, supplierName: row.supplier_name ?? "", supplierTaxId: row.supplier_tax_id ?? "",
      invoiceDate: row.invoice_date ? String(row.invoice_date).split("T")[0] : "", invoiceNumber: row.invoice_number ?? "",
      totalValue: row.total_value ? String(+row.total_value) : "",
      notes: row.notes ?? "", attachmentUrl: row.attachment_url ?? "",
    });
    setInlineEditId(row.id); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  function startInlineNew() {
    setInlineForm({ ...EMPTY_INV });
    setInlineEditId("new"); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  // ─── Shared invoice input handlers (Phase 3c: only total editable) ────────────────────────────────
  function makeNumProps(form: InvForm, setForm: (f: InvForm) => void, allowDup: boolean, setAllowDup: (v: boolean) => void, dupInfo: any, setDupInfo: (v: any) => void, excludeId?: number, isInline = false) {
    return {
      onChangeSupplierName: (v: string) => setForm({ ...form, supplierName: v }),
      onChangeTaxId: (v: string) => {
        const clean = sanitizeNum(v);
        setForm({ ...form, supplierTaxId: clean });
        if (clean && form.invoiceNumber) checkDuplicateNow(clean, form.invoiceNumber, excludeId).then(d => { if (d) setDupInfo(d); else setDupInfo(null); });
      },
      onChangeInvoiceNumber: (v: string) => {
        setForm({ ...form, invoiceNumber: v });
        if (form.supplierTaxId && v) checkDuplicateNow(form.supplierTaxId, v, excludeId).then(d => { if (d) setDupInfo(d); else setDupInfo(null); });
      },
      onChangeDate: (v: string) => setForm({ ...form, invoiceDate: v }),
      onChangeTotal: (v: string) => {
        const clean = sanitizeNum(v);
        setForm({ ...form, totalValue: clean });
      },
      onBlurTotal: () => {
        const fmt = formatTotalOnBlur(form);
        setForm({ ...form, totalValue: fmt });
      },
      onChangeNotes: (v: string) => setForm({ ...form, notes: v }),
      onChangeAttachment: (v: string) => setForm({ ...form, attachmentUrl: v }),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (isInline) saveInline();
          else handleSaveInvDialog(false);
        }
      },
      onToggleAllowDup: () => setAllowDup(!allowDup),
      dupInfo, allowDup,
    };
  }

  // ─── Print / Excel / PDF ─────────────────────────────────────────────────────────────────────────────
  function doPrint() {
    const stmt = getStmtQ.data;
    const rows = listInvQ.data?.rows ?? [];
    const totals = listInvQ.data?.totals ?? { preTax: 0, tax: 0, total: 0, count: 0 };
    const orgName = user?.orgName ?? (ar ? "المؤسسة" : "Organization");
    const now = new Date().toLocaleString("ar-SA");
    const taxRate = getStatementTaxRate();
    const html = `
<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${ar ? "البيان التفصيلي للمشتريات" : "Purchase Statement"}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11pt; margin: 0; padding: 0; direction: rtl; }
  .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #406B93; padding-bottom: 8px; }
  .header h1 { margin: 0; font-size: 14pt; color: #406B93; }
  .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 10px; font-size: 10pt; }
  .meta div { flex: 1 1 200px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th { background: #E8EEF4; border: 1px solid #B0B0B0; padding: 5px 8px; font-weight: 700; text-align: right; }
  td { border: 1px solid #B0B0B0; padding: 4px 8px; text-align: right; }
  tr:nth-child(even) { background: #FAFAFA; }
  .totals-row { background: #F2F0EC !important; font-weight: 700; }
  .dup-row { background: #FEF3C7 !important; }
  .footer { display: flex; justify-content: space-between; margin-top: 10px; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
<div class="header">
  <h1>${orgName}</h1>
  <div style="font-size:12pt;font-weight:700;margin-top:4px">${ar ? "البيان التفصيلي للمشتريات" : "Purchase Detail Statement"}</div>
</div>
<div class="meta">
  <div><strong>${ar ? "البيان:" : "Statement:"}</strong> ${stmt?.name ?? ""}</div>
  <div><strong>${ar ? "المشروع:" : "Project:"}</strong> ${stmt?.project ?? (ar ? "—" : "—")}</div>
  <div><strong>${ar ? "الفترة:" : "Period:"}</strong> ${fmtD(stmt?.dateFrom)} → ${fmtD(stmt?.dateTo)}</div>
  <div><strong>${ar ? "نسبة الضريبة:" : "Tax Rate:"}</strong> ${fmtN(taxRate)}%</div>
</div>
<table>
<thead><tr>
  <th>${ar ? "م" : "#"}</th>
  <th>${ar ? "اسم المورد" : "Supplier"}</th>
  <th>${ar ? "الرقم الضريبي" : "Tax ID"}</th>
  <th>${ar ? "التاريخ" : "Date"}</th>
  <th>${ar ? "رقم الفاتورة" : "Invoice #"}</th>
  <th>${ar ? "قبل الضريبة" : "Pre-Tax"}</th>
  <th>${ar ? "الضريبة %" : "Tax %"}</th>
  <th>${ar ? "مبلغ الضريبة" : "Tax Amount"}</th>
  <th>${ar ? "الإجمالي" : "Total"}</th>
  <th>${ar ? "ملاحظات" : "Notes"}</th>
</tr></thead>
<tbody>
${rows.map((r: any, i: number) => {
  const isDup = !!dupMap[r.id];
  return `<tr class="${isDup ? 'dup-row' : ''}">
    <td>${r.sequence ?? (i + 1)}</td>
    <td>${r.supplier_name ?? ""}</td>
    <td style="font-family:monospace">${r.supplier_tax_id ?? "—"}</td>
    <td>${fmtD(r.invoice_date)}</td>
    <td style="font-family:monospace;font-weight:600">${r.invoice_number ?? ""}</td>
    <td>${fmtN(+r.pre_tax_value)}</td>
    <td>${fmtN(+r.tax_rate)}%</td>
    <td>${fmtN(+r.tax_amount)}</td>
    <td style="font-weight:700">${fmtN(+r.total_value)}</td>
    <td>${r.notes ?? ""}</td>
  </tr>`;
}).join('')}
<tr class="totals-row">
  <td colspan="5" style="text-align:left">${ar ? "الإجماليات" : "Totals"}</td>
  <td>${fmtN(totals.preTax)}</td>
  <td>—</td>
  <td>${fmtN(totals.tax)}</td>
  <td>${fmtN(totals.total)}</td>
  <td>${ar ? "عدد الفواتير:" : "Count:"} ${totals.count}</td>
</tr>
</tbody></table>
<div class="footer">
  <span>${ar ? "تاريخ الطباعة:" : "Printed:"} ${now}</span>
  <span>${ar ? "صفحة 1 من 1" : "Page 1 of 1"}</span>
</div>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 300); }
  }

  async function doExportExcel() {
    if (!selectedStmtId) return;
    try {
      const data = await utils.rePurchases.exportStatement.fetch({ statementId: selectedStmtId });
      const stmt = data.statement;
      const invoices = data.invoices as any[];
      const totals = data.totals;
      const taxRate = Number(stmt.defaultTaxRate ?? 15);

      const wsData: (string | number | Date | null)[][] = [];
      wsData.push([ar ? "المؤسسة" : "Organization", data.org?.name ?? ""]);
      wsData.push([ar ? "البيان" : "Statement", stmt.name ?? ""]);
      wsData.push([ar ? "المشروع" : "Project", stmt.project ?? ""]);
      wsData.push([ar ? "الفترة" : "Period", `${fmtD(stmt.dateFrom)} → ${fmtD(stmt.dateTo)}`]);
      wsData.push([ar ? "نسبة الضريبة" : "Tax Rate", taxRate]);
      wsData.push([]);

      wsData.push([
        ar ? "م" : "#",
        ar ? "اسم المورد" : "Supplier",
        ar ? "الرقم الضريبي" : "Tax ID",
        ar ? "تاريخ الفاتورة" : "Invoice Date",
        ar ? "رقم الفاتورة" : "Invoice #",
        ar ? "الإجمالي شامل" : "Total",
        ar ? "قبل الضريبة" : "Pre-Tax",
        ar ? "مبلغ الضريبة" : "Tax Amount",
        ar ? "ملاحظات" : "Notes",
      ]);
      for (const r of invoices) {
        const calc = calcFromTotal(Number(r.totalValue ?? 0), taxRate);
        wsData.push([
          r.sequence ?? "",
          r.supplierName ?? "",
          r.supplierTaxId ?? "",
          fmtDateExcel(r.invoiceDate),
          r.invoiceNumber ?? "",
          Number(r.totalValue ?? 0),
          calc.preTax,
          calc.tax,
          r.notes ?? "",
        ]);
      }
      wsData.push([]);
      wsData.push([ar ? "الإجماليات" : "Totals", "", "", "", "", totals.total, totals.preTax, totals.tax, ar ? `عدد: ${totals.count}` : `Count: ${totals.count}`]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, ar ? "الفواتير" : "Invoices");
      XLSX.writeFile(wb, `${stmt.name ?? "statement"}_invoices.xlsx`);
      toast.success(ar ? "تم تصدير Excel" : "Excel exported");
    } catch (e: any) {
      toast.error(e.message ?? (ar ? "فشل التصدير" : "Export failed"));
    }
  }

  function doExportPDF() { doPrint(); }

  // ─── Excel Import handlers ──────────────────────────────────────────────────────────────────────────
  function downloadTemplate() {
    const headers = [
      ar ? "اسم المورد" : "Supplier Name",
      ar ? "الرقم الضريبي" : "Tax ID",
      ar ? "تاريخ الفاتورة" : "Invoice Date",
      ar ? "رقم الفاتورة" : "Invoice Number",
      ar ? "الإجمالي شامل" : "Total",
      ar ? "ملاحظات" : "Notes",
    ];
    const example = [
      ar ? "شركة الأمثل للتجارة" : "Example Trading Co",
      "300000000100003",
      "2026-01-15",
      "INV-001",
      1150.00,
      ar ? "ملاحظات الفاتورة" : "Invoice notes",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar ? "نموذج" : "Template");
    XLSX.writeFile(wb, ar ? "نموذج_استيراد_الفواتير.xlsx" : "invoice_import_template.xlsx");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedStmtId) { toast.error(ar ? "اختر بياناً أولاً" : "Select a statement first"); return; }
    setImportLoading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (raw.length < 2) { toast.error(ar ? "الملف فارغ" : "File is empty"); setImportLoading(false); return; }

      // Detect header row
      const headerRow = raw[0];
      const colMap: Record<string, number> = {};
      headerRow.forEach((h: any, i: number) => {
        const s = String(h).toLowerCase().trim();
        if (s.includes("مورد") || s.includes("supplier")) colMap.supplierName = i;
        else if (s.includes("ضريبي") || s.includes("tax")) colMap.supplierTaxId = i;
        else if (s.includes("تاريخ") || s.includes("date")) colMap.invoiceDate = i;
        else if (s.includes("رقم") && (s.includes("فاتورة") || s.includes("invoice"))) colMap.invoiceNumber = i;
        else if (s.includes("إجمالي") || s.includes("total")) colMap.totalValue = i;
        else if (s.includes("ملاحظات") || s.includes("notes") || s.includes("note")) colMap.notes = i;
      });

      // Fallback by index if headers not matched
      if (colMap.supplierName === undefined) colMap.supplierName = 0;
      if (colMap.supplierTaxId === undefined) colMap.supplierTaxId = 1;
      if (colMap.invoiceDate === undefined) colMap.invoiceDate = 2;
      if (colMap.invoiceNumber === undefined) colMap.invoiceNumber = 3;
      if (colMap.totalValue === undefined) colMap.totalValue = 4;
      if (colMap.notes === undefined) colMap.notes = 5;

      const rows = raw.slice(1).map((r) => ({
        supplierName: String(r[colMap.supplierName!] ?? "").trim(),
        supplierTaxId: r[colMap.supplierTaxId!] != null ? String(r[colMap.supplierTaxId!]).trim() : undefined,
        invoiceDate: r[colMap.invoiceDate!] != null ? String(r[colMap.invoiceDate!]).trim() : "",
        invoiceNumber: String(r[colMap.invoiceNumber!] ?? "").trim(),
        totalValue: typeof r[colMap.totalValue!] === "number" ? r[colMap.totalValue!] : parseFloat(String(r[colMap.totalValue!] ?? "0").replace(/,/g, "")),
        notes: r[colMap.notes!] != null ? String(r[colMap.notes!]).trim() : undefined,
      })).filter(r => r.supplierName || r.invoiceNumber || r.totalValue > 0);

      previewImportMut.mutate({ statementId: selectedStmtId, rows });
    } catch (err: any) {
      toast.error(err.message ?? (ar ? "فشل قراءة الملف" : "Failed to read file"));
      setImportLoading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function confirmImport() {
    if (!selectedStmtId || importPreview.length === 0) return;
    const rowsToImport = importPreview
      .filter(r => r.valid || (r.dupInfo && !importSkipDups))
      .map(r => ({
        supplierName: r.supplierName,
        supplierTaxId: r.supplierTaxId,
        invoiceDate: r.invoiceDate,
        invoiceNumber: r.invoiceNumber,
        totalValue: r.totalValue,
        notes: r.notes,
        allowDuplicate: !!r.dupInfo,
      }));
    if (rowsToImport.length === 0) { toast.error(ar ? "لا توجد صفوف صالحة للاستيراد" : "No valid rows to import"); return; }
    executeImportMut.mutate({ statementId: selectedStmtId, rows: rowsToImport, skipDuplicates: importSkipDups });
  }

  // ─── Sort helpers ─────────────────────────────────────────────────────────────────────────────────────
  function toggleInvSort(col: InvSortCol) {
    if (invSortBy === col) setInvSortDir(d => d === "asc" ? "desc" : "asc");
    else { setInvSortBy(col); setInvSortDir("asc"); }
  }
  function SortHeader({ col, label, numeric = false }: { col: InvSortCol; label: string; numeric?: boolean }) {
    const active = invSortBy === col;
    return (
      <th onClick={() => toggleInvSort(col)} style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
        <span className="flex items-center gap-1">{label}{active && (invSortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}</span>
      </th>
    );
  }

  // ─── Number input component ────────────────────────────────────────────────────────
  function NumInput({ value, onChange, onBlur, onKeyDown, placeholder, className = "", style = {}, readOnly = false }: any) {
    return (
      <input type="text" inputMode="decimal" dir="ltr" lang="en" value={value} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown}
        placeholder={placeholder} readOnly={readOnly}
        className={`border rounded px-2 text-xs ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''} ${className}`}
        style={{ borderColor: C.border, ...style }} />
    );
  }

  // ─── Render: Statement Form ─────────────────────────────────────────────────────────────────────────
  if (view === "stmtForm") {
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Button variant="ghost" size="sm" onClick={() => { setView("statements"); setStmtForm({ ...EMPTY_STMT }); setStmtEditId(null); }} className="gap-1.5 mb-4 -ms-2"><BackIcon className="w-4 h-4" />{ar ? "قائمة البيانات" : "Statements"}</Button>
          <h1 className="text-lg font-bold mb-4">{stmtEditId ? (ar ? "تعديل البيان" : "Edit Statement") : (ar ? "إضافة بيان جديد" : "Add Statement")}</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "اسم البيان" : "Statement Name"} *</label>
              <input value={stmtForm.name} onChange={e => setStmtForm({ ...stmtForm, name: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} placeholder={ar ? "مثل: مشتريات الربع الأول" : "e.g. Q1 Purchases"} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "المشروع" : "Project"}</label>
              <input value={stmtForm.project} onChange={e => setStmtForm({ ...stmtForm, project: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} placeholder={ar ? "اسم المشروع..." : "Project name..."} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "من تاريخ" : "From Date"} *</label>
                <input type="date" value={stmtForm.dateFrom} onChange={e => setStmtForm({ ...stmtForm, dateFrom: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "إلى تاريخ" : "To Date"} *</label>
                <input type="date" value={stmtForm.dateTo} onChange={e => setStmtForm({ ...stmtForm, dateTo: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "نسبة الضريبة الافتراضية" : "Default Tax Rate"}</label>
              <div className="flex items-center gap-2 flex-wrap">
                {["15", "5", "0"].map(rate => (
                  <button key={rate} onClick={() => setStmtForm({ ...stmtForm, defaultTaxRate: rate })}
                    className={`px-3 py-1.5 rounded text-sm font-semibold border ${stmtForm.defaultTaxRate === rate ? 'bg-primary text-white border-primary' : 'bg-white text-foreground'}`}
                    style={{ borderColor: C.border }}>{rate}%</button>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{ar ? "أخرى:" : "Other:"}</span>
                  <NumInput value={stmtForm.defaultTaxRate} onChange={(e: any) => setStmtForm({ ...stmtForm, defaultTaxRate: sanitizeNum(e.target.value) })} placeholder="15" style={{ width: 60, height: 28 }} />
                </div>
              </div>
              {stmtEditId && (
                <p className="text-xs text-muted-foreground mt-1">{ar ? "عند الحفظ، سيظهر سؤال لتطبيق النسبة على الفواتير الموجودة أو الجديدة فقط" : "On save, you will be asked whether to apply to existing or new invoices only"}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea value={stmtForm.notes} onChange={e => setStmtForm({ ...stmtForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm border rounded-md" style={{ borderColor: C.border }} />
            </div>

            {showTaxRateConfirm && (
              <div className="p-3 rounded border" style={{ background: "#FEF3C7", borderColor: C.warn }}>
                <p className="text-sm font-semibold mb-2" style={{ color: "#92400E" }}>{ar ? "تعديل نسبة الضريبة" : "Tax rate change"}</p>
                <p className="text-xs mb-2">{ar ? "هل تريد تطبيق النسبة الجديدة على الفواتير الموجودة أم فقط الجديدة؟" : "Apply new rate to existing invoices or only new ones?"}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveStmt(true)}>{ar ? "جميع الفواتير" : "All invoices"}</Button>
                  <Button size="sm" variant="outline" onClick={() => handleSaveStmt(false)}>{ar ? "الجديدة فقط" : "New only"}</Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => {
                if (stmtEditId && stmtOriginalTaxRate !== null && stmtForm.defaultTaxRate !== stmtOriginalTaxRate) {
                  setShowTaxRateConfirm(true);
                } else { handleSaveStmt(false); }
              }} disabled={createStmtMut.isPending || updateStmtMut.isPending} className="gap-1.5"><Save className="w-4 h-4" /> {ar ? "حفظ" : "Save"}</Button>
              <Button variant="outline" onClick={() => { setView("statements"); setStmtForm({ ...EMPTY_STMT }); setStmtEditId(null); setShowTaxRateConfirm(false); }} className="gap-1.5"><X className="w-4 h-4" /> {ar ? "إلغاء" : "Cancel"}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Statement Detail ──────────────────────────────────────────────────────────────────────────────
  if (view === "detail" && selectedStmtId) {
    const stmt = getStmtQ.data;
    const rows = listInvQ.data?.rows ?? [];
    const totals = listInvQ.data?.totals ?? { preTax: 0, tax: 0, total: 0, count: 0 };
    const taxRate = getStatementTaxRate();
    const invProps = makeNumProps(inlineForm, setInlineForm, inlineAllowDup, setInlineAllowDup, inlineDupInfo, setInlineDupInfo, inlineEditId !== "new" && typeof inlineEditId === "number" ? inlineEditId : undefined, true);

    return (
      <div className="h-full flex flex-col bg-background" dir={dir}>
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b" style={{ background: "#F8F7F4", borderColor: C.border }}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Button size="sm" variant="ghost" onClick={() => { setView("statements"); setSelectedStmtId(null); }} className="gap-1"><ChevronLeft className="w-4 h-4" /> {ar ? "البيانات" : "Statements"}</Button>
            <span className="text-sm text-muted-foreground">/</span>
            <h1 className="text-sm font-bold">{stmt?.name ?? (ar ? "بيان المشتريات" : "Purchase Statement")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {stmt?.project && <span>{ar ? "المشروع:" : "Project:"} <strong className="text-foreground">{stmt.project}</strong></span>}
            <span>{ar ? "الفترة:" : "Period:"} <strong className="text-foreground">{fmtD(stmt?.dateFrom)} → {fmtD(stmt?.dateTo)}</strong></span>
            <span>{ar ? "الضريبة:" : "Tax:"} <strong className="text-foreground">{fmtN(taxRate)}%</strong></span>
            <span>{ar ? "الفواتير:" : "Invoices:"} <strong className="text-foreground">{totals.count}</strong></span>
            <span>{ar ? "إجمالي:" : "Total:"} <strong className="text-foreground" style={{ color: C.primary }}>{fmtN(totals.total)}</strong></span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {canAdd && <Button size="sm" onClick={() => openInvDialog()} className="gap-1"><Plus className="w-4 h-4" /> {ar ? "+ إضافة فاتورة مشتريات" : "+ Add Purchase Invoice"}</Button>}
            {canEdit && <Button size="sm" variant="outline" onClick={() => stmt && openStmtEdit(stmt)} className="gap-1"><Pencil className="w-3.5 h-3.5" /> {ar ? "تعديل البيان" : "Edit Statement"}</Button>}
            {canPrint && <Button size="sm" variant="outline" onClick={doPrint} className="gap-1"><Printer className="w-4 h-4" /> {ar ? "طباعة" : "Print"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={doExportExcel} className="gap-1"><FileSpreadsheet className="w-4 h-4" /> {ar ? "تصدير Excel" : "Export Excel"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={doExportPDF} className="gap-1"><FileDown className="w-4 h-4" /> {ar ? "تصدير PDF" : "Export PDF"}</Button>}
            {canImport && (
              <>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1"><Upload className="w-4 h-4" /> {ar ? "استيراد Excel" : "Import Excel"}</Button>
                <Button size="sm" variant="ghost" onClick={downloadTemplate} className="gap-1"><Download className="w-4 h-4" /> {ar ? "نموذج" : "Template"}</Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => listInvQ.refetch()} className="gap-1"><Search className="w-4 h-4" /> {ar ? "تحديث" : "Refresh"}</Button>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="flex-1 overflow-auto p-4">
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.header, borderBottom: `2px solid ${C.border}` }}>
                  <SortHeader col="sequence" label={ar ? "مسلسل" : "#"} />
                  <SortHeader col="supplierName" label={ar ? "اسم المورد" : "Supplier"} />
                  <SortHeader col="supplierTaxId" label={ar ? "الرقم الضريبي" : "Tax ID"} />
                  <SortHeader col="invoiceDate" label={ar ? "تاريخ الفاتورة" : "Date"} />
                  <SortHeader col="invoiceNumber" label={ar ? "رقم الفاتورة" : "Invoice #"} />
                  <SortHeader col="totalValue" label={ar ? "الإجمالي شامل" : "Total"} numeric />
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap" }}>{ar ? "قبل الضريبة" : "Pre-Tax"}</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap" }}>{ar ? "مبلغ الضريبة" : "Tax Amount"}</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap" }}>{ar ? "الضريبة %" : "Tax %"}</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap" }}>{ar ? "ملاحظات" : "Notes"}</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap" }}>{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {listInvQ.isLoading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>{Array.from({ length: 11 }).map((_, j) => (<td key={j} style={{ padding: "8px 10px" }}><div style={{ height: 12, background: "#E8E8E8", borderRadius: 4 }} /></td>))}</tr>
                )) : rows.length === 0 && inlineEditId !== "new" ? (
                  <tr><td colSpan={11} style={{ textAlign: "center", padding: "30px 0", color: "#999" }}>
                    <ReceiptText style={{ width: 28, height: 28, margin: "0 auto 6px", opacity: 0.3 }} />
                    <div style={{ fontSize: 13 }}>{ar ? "لا توجد فواتير — اضغط إضافة أو اكتب في الصف الأخير" : "No invoices -- click Add or type in the bottom row"}</div>
                    <Button size="sm" variant="outline" onClick={startInlineNew} className="mt-2 gap-1"><Plus className="w-3.5 h-3.5" /> {ar ? "إضافة صف جديد" : "Add row"}</Button>
                  </td></tr>
                ) : (
                  <>
                    {rows.map((r: any) => {
                      const isEditing = inlineEditId === r.id;
                      const isDup = !!dupMap[r.id];
                      const calc = calcFromTotal(Number(r.total_value ?? 0), taxRate);
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F0F0F0", background: isEditing ? "#FFF9E6" : isDup ? C.dupBg : "white" }}>
                          <td style={{ padding: "6px 10px" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#E0EAF4", color: C.primary }}>{r.sequence ?? "—"}</span>
                            {isDup && <span title={ar ? "فاتورة مكررة" : "Duplicate invoice"} style={{ marginRight: 4, color: C.warn, fontSize: 11 }}>⚠️</span>}
                          </td>

                          {isEditing ? (
                            <>
                              <td style={{ padding: "4px 6px" }}><input value={inlineForm.supplierName} onChange={e => invProps.onChangeSupplierName(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "اسم..." : "Name..."} /></td>
                              <td style={{ padding: "4px 6px" }}><input value={inlineForm.supplierTaxId} onChange={e => invProps.onChangeTaxId(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "الضريبي..." : "Tax..."} /></td>
                              <td style={{ padding: "4px 6px" }}><input type="date" value={inlineForm.invoiceDate} onChange={e => invProps.onChangeDate(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} /></td>
                              <td style={{ padding: "4px 6px" }}><input value={inlineForm.invoiceNumber} onChange={e => invProps.onChangeInvoiceNumber(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "رقم..." : "#..."} /></td>
                              <td style={{ padding: "4px 6px" }}><NumInput value={inlineForm.totalValue} onChange={(e: any) => invProps.onChangeTotal(e.target.value)} onBlur={invProps.onBlurTotal} onKeyDown={invProps.onKeyDown} placeholder="0" className="w-full h-7" /></td>
                              <td style={{ padding: "4px 6px" }}><NumInput value={recalcFromTotal(inlineForm).preTax.toFixed(2)} readOnly className="w-full h-7" /></td>
                              <td style={{ padding: "4px 6px" }}><NumInput value={recalcFromTotal(inlineForm).tax.toFixed(2)} readOnly className="w-full h-7" /></td>
                              <td style={{ padding: "4px 6px" }}><NumInput value={String(taxRate)} readOnly className="w-full h-7" /></td>
                              <td style={{ padding: "4px 6px" }}><input value={inlineForm.notes} onChange={e => invProps.onChangeNotes(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} /></td>
                              <td style={{ padding: "4px 6px" }}>
                                <div className="flex items-center gap-1">
                                  <button onClick={saveInline} title={ar ? "حفظ" : "Save"} className="p-1 rounded hover:bg-green-50"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.success }} /></button>
                                  <button onClick={resetInline} title={ar ? "إلغاء" : "Cancel"} className="p-1 rounded hover:bg-gray-100"><Ban className="w-3.5 h-3.5" style={{ color: "#999" }} /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: "6px 10px" }}>{r.supplier_name}</td>
                              <td style={{ padding: "6px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 11 }}>{r.supplier_tax_id || "—"}</span></td>
                              <td style={{ padding: "6px 10px" }}>{fmtD(r.invoice_date)}</td>
                              <td style={{ padding: "6px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600 }}>{r.invoice_number}</span></td>
                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmtN(+r.total_value)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtN(+r.pre_tax_value)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtN(+r.tax_amount)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtN(+r.tax_rate)}%</td>
                              <td style={{ padding: "6px 10px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span title={r.notes || ""}>{r.notes || "—"}</span></td>
                              <td style={{ padding: "6px 10px" }}>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => startInlineEdit(r)} title={ar ? "تعديل مباشر" : "Edit inline"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Pencil className="w-3.5 h-3.5" style={{ color: C.primary }} /></button>
                                  <button onClick={() => openInvDialog(r)} title={ar ? "تعديل في النافذة" : "Edit in dialog"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ArrowUpRight className="w-3.5 h-3.5" style={{ color: "#666" }} /></button>
                                  <button onClick={() => { if (confirm(ar ? "تأكيد الحذف؟" : "Confirm delete?")) deleteInvMut.mutate({ id: r.id }); }} title={ar ? "حذف" : "Delete"} disabled={!canDelete} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" style={{ color: C.danger }} /></button>
                                  {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" title={ar ? "فتح المرفق" : "Open attachment"} className="p-1 rounded hover:bg-gray-100"><FileText className="w-3.5 h-3.5" style={{ color: "#666" }} /></a>}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* New inline row */}
                    {inlineEditId === "new" ? (
                      <tr style={{ borderBottom: "2px solid #D0D0D0", background: "#FFF9E6" }}>
                        <td style={{ padding: "6px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "#E0EAF4", color: C.primary }}>{rows.length + 1}</span></td>
                        <td style={{ padding: "4px 6px" }}><input value={inlineForm.supplierName} onChange={e => invProps.onChangeSupplierName(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "اسم..." : "Name..."} autoFocus /></td>
                        <td style={{ padding: "4px 6px" }}><input value={inlineForm.supplierTaxId} onChange={e => invProps.onChangeTaxId(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "الضريبي..." : "Tax..."} /></td>
                        <td style={{ padding: "4px 6px" }}><input type="date" value={inlineForm.invoiceDate} onChange={e => invProps.onChangeDate(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} /></td>
                        <td style={{ padding: "4px 6px" }}><input value={inlineForm.invoiceNumber} onChange={e => invProps.onChangeInvoiceNumber(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} placeholder={ar ? "رقم..." : "#..."} /></td>
                        <td style={{ padding: "4px 6px" }}><NumInput value={inlineForm.totalValue} onChange={(e: any) => invProps.onChangeTotal(e.target.value)} onBlur={invProps.onBlurTotal} onKeyDown={invProps.onKeyDown} placeholder="0" className="w-full h-7" /></td>
                        <td style={{ padding: "4px 6px" }}><NumInput value={recalcFromTotal(inlineForm).preTax.toFixed(2)} readOnly className="w-full h-7" /></td>
                        <td style={{ padding: "4px 6px" }}><NumInput value={recalcFromTotal(inlineForm).tax.toFixed(2)} readOnly className="w-full h-7" /></td>
                        <td style={{ padding: "4px 6px" }}><NumInput value={String(taxRate)} readOnly className="w-full h-7" /></td>
                        <td style={{ padding: "4px 6px" }}><input value={inlineForm.notes} onChange={e => invProps.onChangeNotes(e.target.value)} onKeyDown={invProps.onKeyDown} className="w-full h-7 px-2 text-xs border rounded" style={{ borderColor: C.border }} /></td>
                        <td style={{ padding: "4px 6px" }}>
                          <div className="flex items-center gap-1">
                            <button onClick={saveInline} title={ar ? "حفظ" : "Save"} className="p-1 rounded hover:bg-green-50"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: C.success }} /></button>
                            <button onClick={resetInline} title={ar ? "إلغاء" : "Cancel"} className="p-1 rounded hover:bg-gray-100"><Ban className="w-3.5 h-3.5" style={{ color: "#999" }} /></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr style={{ borderBottom: "2px solid #D0D0D0" }}>
                        <td colSpan={11} style={{ padding: "8px 10px" }}>
                          <button onClick={startInlineNew} className="flex items-center gap-1 text-xs font-medium" style={{ color: C.primary }}>
                            <Plus className="w-3.5 h-3.5" /> {ar ? "إضافة صف جديد..." : "Add new row..."}
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Duplicate inline warning */}
        {inlineDupInfo && (
          <div className="shrink-0 px-4 py-2 border-t flex items-center gap-2" style={{ background: "#FEF3C7", borderColor: C.warn, fontSize: 12 }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#92400E" }} />
            <span style={{ color: "#92400E" }}>
              {ar ? "تنبيه: توجد فاتورة مسجلة سابقاً" : "Warning: duplicate invoice found"}
              {inlineDupInfo.statementName && ` (${inlineDupInfo.statementName})`}
            </span>
            <button onClick={() => setInlineAllowDup(true)} className="ms-auto px-2 py-1 rounded text-xs font-semibold" style={{ background: "#F59E0B", color: "white" }}>{ar ? "الحفظ رغم التنبيه" : "Allow save"}</button>
          </div>
        )}

        {/* Totals bar */}
        <div className="shrink-0 px-4 py-2 border-t flex flex-wrap gap-4 items-center" style={{ background: "#F2F0EC", borderColor: C.border, fontSize: 12 }}>
          <span className="font-semibold text-foreground">{ar ? "الإجماليات" : "Totals"}:</span>
          <span>{ar ? "قبل الضريبة" : "Pre-Tax"}: <strong>{fmtN(totals.preTax)}</strong></span>
          <span>{ar ? "الضريبة" : "Tax"}: <strong>{fmtN(totals.tax)}</strong></span>
          <span>{ar ? "الإجمالي شامل" : "Total"}: <strong style={{ color: C.primary }}>{fmtN(totals.total)}</strong></span>
          <span>{ar ? "عدد الفواتير" : "Count"}: <strong>{totals.count}</strong></span>
        </div>

        {/* Invoice Dialog (Phase 3c: total-only editable) */}
        {showInvDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) resetInvDialog(); }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" dir={dir}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: C.border }}>
                <h2 className="text-base font-bold">{invDialogEditId ? (ar ? "تعديل فاتورة" : "Edit Invoice") : (ar ? "إضافة فاتورة" : "Add Invoice")}</h2>
                <button onClick={resetInvDialog} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" style={{ color: "#888" }} /></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                {invDialogDupInfo && (
                  <div className="p-3 rounded border text-sm flex items-start gap-2" style={{ background: "#FEF3C7", borderColor: "#F59E0B", color: "#92400E" }}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{ar ? "تنبيه: فاتورة مكررة مسجلة سابقاً" : "Warning: duplicate invoice found"}</p>
                      {invDialogDupInfo.statementName && <p className="text-xs mt-0.5">{ar ? "البيان:" : "Statement:"} {invDialogDupInfo.statementName}</p>}
                      {invDialogDupInfo.supplierName && <p className="text-xs">{ar ? "المورد:" : "Supplier:"} {invDialogDupInfo.supplierName} | {fmtD(invDialogDupInfo.invoiceDate)}</p>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "اسم المورد" : "Supplier Name"} *</label>
                    <input value={invDialogForm.supplierName} onChange={e => setInvDialogForm({ ...invDialogForm, supplierName: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "الرقم الضريبي" : "Tax ID"}</label>
                    <input value={invDialogForm.supplierTaxId} onChange={e => { setInvDialogForm({ ...invDialogForm, supplierTaxId: e.target.value }); if (e.target.value && invDialogForm.invoiceNumber) checkDuplicateNow(e.target.value, invDialogForm.invoiceNumber, invDialogEditId ?? undefined).then(d => { if (d) setInvDialogDupInfo(d); else setInvDialogDupInfo(null); }); }} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "تاريخ الفاتورة" : "Date"} *</label>
                    <input type="date" value={invDialogForm.invoiceDate} onChange={e => setInvDialogForm({ ...invDialogForm, invoiceDate: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "رقم الفاتورة" : "Invoice #"} *</label>
                    <input value={invDialogForm.invoiceNumber} onChange={e => { setInvDialogForm({ ...invDialogForm, invoiceNumber: e.target.value }); if (invDialogForm.supplierTaxId && e.target.value) checkDuplicateNow(invDialogForm.supplierTaxId, e.target.value, invDialogEditId ?? undefined).then(d => { if (d) setInvDialogDupInfo(d); else setInvDialogDupInfo(null); }); }} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} />
                  </div>
                </div>

                {/* Phase 3c: only Total is editable; preTax/tax/taxRate computed from statement */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "الإجمالي شامل" : "Total"} *</label>
                    <NumInput value={invDialogForm.totalValue}
                      onChange={(e: any) => setInvDialogForm({ ...invDialogForm, totalValue: sanitizeNum(e.target.value) })}
                      onBlur={() => setInvDialogForm({ ...invDialogForm, totalValue: formatTotalOnBlur(invDialogForm) })}
                      className="w-full h-9" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "قبل الضريبة" : "Pre-Tax"}</label>
                    <NumInput value={recalcFromTotal(invDialogForm).preTax.toFixed(2)} readOnly className="w-full h-9" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "مبلغ الضريبة" : "Tax Amount"}</label>
                    <NumInput value={recalcFromTotal(invDialogForm).tax.toFixed(2)} readOnly className="w-full h-9" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "الضريبة %" : "Tax %"}</label>
                    <NumInput value={String(taxRate)} readOnly className="w-full h-9" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "ملاحظات" : "Notes"}</label>
                  <textarea value={invDialogForm.notes} onChange={e => setInvDialogForm({ ...invDialogForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm border rounded-md" style={{ borderColor: C.border }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar ? "المرفق (URL)" : "Attachment (URL)"}</label>
                  <input value={invDialogForm.attachmentUrl} onChange={e => setInvDialogForm({ ...invDialogForm, attachmentUrl: e.target.value })} className="w-full h-9 px-3 text-sm border rounded-md" style={{ borderColor: C.border }} placeholder={ar ? "رابط الملف..." : "File URL..."} />
                </div>

                {invDialogDupInfo && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="allowDupDlg" checked={invDialogAllowDup} onChange={e => setInvDialogAllowDup(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="allowDupDlg" className="text-sm text-amber-700 cursor-pointer">{ar ? "الحفظ رغم التنبيه بالفاتورة المكررة" : "Allow saving despite duplicate warning"}</label>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => handleSaveInvDialog(false)} disabled={createInvMut.isPending || updateInvMut.isPending} className="gap-1.5"><Save className="w-4 h-4" /> {ar ? "حفظ" : "Save"}</Button>
                  {!invDialogEditId && <Button variant="outline" onClick={() => handleSaveInvDialog(true)} disabled={createInvMut.isPending}>{ar ? "حفظ + جديد" : "Save + New"}</Button>}
                  <Button variant="outline" onClick={resetInvDialog} className="gap-1.5"><X className="w-4 h-4" /> {ar ? "إلغاء" : "Cancel"}</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Import Preview Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col" dir={dir}>
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: C.border }}>
                <div>
                  <h2 className="text-base font-bold">{ar ? "معاينة الاستيراد" : "Import Preview"}</h2>
                  {importSummary && (
                    <div className="flex gap-3 text-xs mt-1 text-muted-foreground">
                      <span>{ar ? "الصفوف" : "Rows"}: <strong className="text-foreground">{importSummary.totalRows}</strong></span>
                      <span style={{ color: C.success }}>{ar ? "صالحة" : "Valid"}: <strong>{importSummary.validCount}</strong></span>
                      <span style={{ color: C.danger }}>{ar ? "أخطاء" : "Errors"}: <strong>{importSummary.errorCount}</strong></span>
                      <span style={{ color: C.warn }}>{ar ? "مكررة" : "Dup"}: <strong>{importSummary.dupCount}</strong></span>
                      <span>{ar ? "إجمالي" : "Total"}: <strong>{fmtN(importSummary.totalImported)}</strong></span>
                      <span>{ar ? "الضريبة" : "Tax"}: <strong>{fmtN(importTaxRate)}%</strong></span>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowImportModal(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" style={{ color: "#888" }} /></button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {importPreview.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{ar ? "لا توجد بيانات" : "No data"}</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: C.header, borderBottom: `2px solid ${C.border}` }}>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>#</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "اسم المورد" : "Supplier"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "الرقم الضريبي" : "Tax ID"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "التاريخ" : "Date"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "الإجمالي" : "Total"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "قبل الضريبة" : "Pre-Tax"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "الضريبة" : "Tax"}</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11 }}>{ar ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((r) => (
                        <tr key={r.index} style={{
                          borderBottom: "1px solid #F0F0F0",
                          background: !r.valid ? C.errBg : r.dupInfo ? C.dupBg : "white"
                        }}>
                          <td style={{ padding: "4px 8px" }}>{r.index + 1}</td>
                          <td style={{ padding: "4px 8px" }}>{r.supplierName}</td>
                          <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{r.supplierTaxId || "—"}</td>
                          <td style={{ padding: "4px 8px" }}>{r.invoiceDate}</td>
                          <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{r.invoiceNumber}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700 }}>{fmtN(r.totalValue)}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmtN(r.preTaxValue)}</td>
                          <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmtN(r.taxAmount)}</td>
                          <td style={{ padding: "4px 8px" }}>
                            {r.errors.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {r.errors.map((err, i) => (
                                  <span key={i} className="text-xs" style={{ color: C.danger }}>{err}</span>
                                ))}
                              </div>
                            ) : r.dupInfo ? (
                              <span className="text-xs" style={{ color: C.warn }}>{ar ? "مكررة" : "Duplicate"} {r.dupInfo.statementName ? `(${r.dupInfo.statementName})` : ""}</span>
                            ) : (
                              <span className="text-xs" style={{ color: C.success }}>✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: C.border }}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="skipDups" checked={importSkipDups} onChange={e => setImportSkipDups(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="skipDups" className="text-sm">{ar ? "تجاهل الفواتير المكررة" : "Skip duplicate invoices"}</label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowImportModal(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
                  <Button onClick={confirmImport} disabled={executeImportMut.isPending || importPreview.filter(r => r.valid).length === 0}>
                    {executeImportMut.isPending ? (ar ? "جارٍ..." : "Importing...") : (ar ? "تأكيد الاستيراد" : "Confirm Import")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Statements List ───────────────────────────────────────────────────────────────────────────────
  const stmtRows = listStmtQ.data?.rows ?? [];
  const stmtTotals = listStmtQ.data?.totals ?? { count: 0, preTaxTotal: 0, taxTotal: 0, grandTotal: 0 };

  return (
    <div className="h-full flex flex-col bg-background" dir={dir}>
      <div className="shrink-0 px-4 py-3 border-b flex flex-wrap items-center gap-3" style={{ background: "#F8F7F4", borderColor: C.border }}>
        <Button size="sm" variant="ghost" onClick={goBack} className="gap-1"><BackIcon className="w-4 h-4" /> {ar ? "المطور العقاري" : "Real Estate"}</Button>
        <h1 className="text-sm font-bold">{ar ? "البيان التفصيلي للمشتريات" : "Purchase Detail Statements"}</h1>
        {canAdd && <Button size="sm" onClick={openStmtCreate} className="gap-1 ms-auto"><Plus className="w-4 h-4" /> {ar ? "بيان جديد" : "New Statement"}</Button>}
      </div>

      <div className="shrink-0 px-4 py-2 border-b flex flex-wrap items-center gap-3" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? "بحث..." : "Search..."} className="h-8 px-2 text-sm border rounded" style={{ borderColor: C.border, width: 160 }} />
        </div>
        <div className="flex items-center gap-2">
          <input value={filterProject} onChange={e => setFilterProject(e.target.value)} placeholder={ar ? "المشروع..." : "Project..."} className="h-8 px-2 text-sm border rounded" style={{ borderColor: C.border, width: 140 }} />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{ borderColor: C.border }} />
          <span className="text-muted-foreground text-xs">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{ borderColor: C.border }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.header, borderBottom: `2px solid ${C.border}` }}>
                {[["مسلسل", "#"], ["اسم البيان", "name"], ["المشروع", "project"], ["الفترة", "dateFrom"], ["الفواتير", "invoice_count"], ["قبل الضريبة", "pre_tax_total"], ["الضريبة", "tax_total"], ["الإجمالي", "grand_total"], ["تاريخ الإنشاء", "created_at"], ["إجراءات", "actions"]].map(([h, col]) => {
                  const isSort = stmtSortBy === (col as any);
                  return (
                    <th key={col} onClick={() => { if (!col || col === "#" || col === "actions" || col === "invoice_count") return; if (stmtSortBy === col) setStmtSortDir(d => d === "asc" ? "desc" : "asc"); else { setStmtSortBy(col as any); setStmtSortDir("desc"); } }} style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#2B4A6A", fontSize: 12, whiteSpace: "nowrap", cursor: col && col !== "#" && col !== "actions" && col !== "invoice_count" ? "pointer" : "default" }}>
                      <span className="flex items-center gap-1">{h} {isSort && (stmtSortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {listStmtQ.isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>{Array.from({ length: 10 }).map((_, j) => (<td key={j} style={{ padding: "8px 10px" }}><div style={{ height: 12, background: "#E8E8E8", borderRadius: 4, animation: "pulse 1.5s infinite" }} /></td>))}</tr>
              )) : stmtRows.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                  <ReceiptText style={{ width: 32, height: 32, margin: "0 auto 8px", opacity: 0.3 }} />
                  <div>{ar ? "لا توجد بيانات" : "No statements"}</div>
                  {canAdd && <Button size="sm" variant="outline" onClick={openStmtCreate} className="mt-3 gap-1"><Plus className="w-3.5 h-3.5" /> {ar ? "بيان جديد" : "New Statement"}</Button>}
                </td></tr>
              ) : stmtRows.map((row: any, i: number) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #F0F0F0", background: i % 2 === 1 ? C.bgAlt : "white" }} className="hover:bg-gray-50 transition-colors">
                  <td style={{ padding: "8px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{i + 1}</span></td>
                  <td style={{ padding: "8px 10px" }}>
                    <button onClick={() => { setSelectedStmtId(row.id); setView("detail"); }} className="text-sm font-semibold hover:underline text-left" style={{ color: C.primary }}>{row.name}</button>
                  </td>
                  <td style={{ padding: "8px 10px" }}>{row.project || "—"}</td>
                  <td style={{ padding: "8px 10px" }}><span className="text-xs">{fmtD(row.date_from)} → {fmtD(row.date_to)}</span></td>
                  <td style={{ padding: "8px 10px" }}><span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{row.invoice_count ?? 0}</span></td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtN(+row.pre_tax_total)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmtN(+row.tax_total)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{fmtN(+row.grand_total)}</td>
                  <td style={{ padding: "8px 10px" }}><span className="text-xs text-muted-foreground">{fmtD(row.created_at)}</span></td>
                  <td style={{ padding: "8px 10px" }}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelectedStmtId(row.id); setView("detail"); }} title={ar ? "فتح" : "Open"} className="p-1 rounded hover:bg-gray-100"><Eye className="w-3.5 h-3.5" style={{ color: C.primary }} /></button>
                      {canEdit && <button onClick={() => openStmtEdit(row)} title={ar ? "تعديل" : "Edit"} className="p-1 rounded hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" style={{ color: "#666" }} /></button>}
                      {canEdit && <button onClick={() => copyStmtMut.mutate({ id: row.id })} title={ar ? "نسخ" : "Copy"} className="p-1 rounded hover:bg-gray-100"><Copy className="w-3.5 h-3.5" style={{ color: "#666" }} /></button>}
                      {canDelete && <button onClick={() => { if (confirm(ar ? "تأكيد حذف البيان وجميع فواتيره؟" : "Delete statement and all invoices?")) deleteStmtMut.mutate({ id: row.id }); }} title={ar ? "حذف" : "Delete"} className="p-1 rounded hover:bg-gray-100"><Trash2 className="w-3.5 h-3.5" style={{ color: C.danger }} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 border-t flex flex-wrap gap-4 items-center" style={{ background: "#F2F0EC", borderColor: C.border, fontSize: 12 }}>
        <span className="font-semibold text-foreground">{ar ? "الإجماليات" : "Totals"}:</span>
        <span>{ar ? "البيانات" : "Statements"}: <strong>{stmtTotals.count}</strong></span>
        <span>{ar ? "قبل الضريبة" : "Pre-Tax"}: <strong>{fmtN(stmtTotals.preTaxTotal)}</strong></span>
        <span>{ar ? "الضريبة" : "Tax"}: <strong>{fmtN(stmtTotals.taxTotal)}</strong></span>
        <span>{ar ? "الإجمالي" : "Total"}: <strong style={{ color: C.primary }}>{fmtN(stmtTotals.grandTotal)}</strong></span>
      </div>
    </div>
  );
}
