/**
 * RePurchasesPage.tsx -- البيان التفصيلي للمشتريات (Phase 3)
 * Two-level hierarchy: Statements → Invoices
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  ReceiptText, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2, Eye,
  Printer, FileSpreadsheet, Upload, AlertTriangle, X, Calendar, FileText,
  SortAsc, SortDesc, Copy, ArrowUpRight, ChevronLeft, Save, Ban,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, isAdminRole } from "@/shared/lib/hsPermissions";

const C = { primary:"#406B93", border:"#D0D0D0", bgAlt:"#FAFAFA", header:"#E8EEF4", danger:"#C0392B", warn:"#F59E0B", success:"#16A34A" };
function fmtN(n:number){ return (n??0).toLocaleString("ar-SA",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtD(d:string|Date|null){ if(!d) return "—"; const dt=typeof d==="string"?new Date(d):d; return dt.toLocaleDateString("ar-SA",{year:"numeric",month:"2-digit",day:"2-digit"}); }

// ─── Types ───────────────────────────────────────────────────────────────────────
interface StmtForm {
  id?: number; name:string; project:string; dateFrom:string; dateTo:string; notes:string;
}
const EMPTY_STMT: StmtForm = { name:"", project:"", dateFrom:new Date().toISOString().split("T")[0], dateTo:new Date().toISOString().split("T")[0], notes:"" };

interface InvForm {
  id?: number; supplierName:string; supplierTaxId:string; invoiceDate:string; invoiceNumber:string;
  preTaxValue:string; taxRate:string; taxAmount:string; totalValue:string; notes:string; attachmentUrl:string;
}
const EMPTY_INV: InvForm = { supplierName:"", supplierTaxId:"", invoiceDate:new Date().toISOString().split("T")[0], invoiceNumber:"", preTaxValue:"", taxRate:"15", taxAmount:"", totalValue:"", notes:"", attachmentUrl:"" };

type View = "statements" | "detail" | "stmtForm";

export default function RePurchasesPage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const isAdmin = isAdminRole(user?.role);
  const canView = canViewHsScreen(user, "hs_re_purchases");
  const canAdd = isAdmin || user?.extraPermissions?.['hs_re_purchases_add'] === true;
  const canEdit = isAdmin || user?.extraPermissions?.['hs_re_purchases_edit'] === true;
  const canDelete = isAdmin || user?.extraPermissions?.['hs_re_purchases_delete'] === true;
  const canPrint = isAdmin || user?.extraPermissions?.['hs_re_purchases_print'] === true;
  const canExport = isAdmin || user?.extraPermissions?.['hs_re_purchases_export'] === true;
  const canImport = isAdmin || user?.extraPermissions?.['hs_re_purchases_import'] === true;

  // ─── View state ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("statements");
  const [selectedStmtId, setSelectedStmtId] = useState<number|null>(null);

  // ─── Statement form ──────────────────────────────────────────────────
  const [stmtForm, setStmtForm] = useState<StmtForm>({...EMPTY_STMT});
  const [stmtEditId, setStmtEditId] = useState<number|null>(null);

  // ─── Invoice dialog ──────────────────────────────────────────────────
  const [showInvDialog, setShowInvDialog] = useState(false);
  const [invDialogForm, setInvDialogForm] = useState<InvForm>({...EMPTY_INV});
  const [invDialogEditId, setInvDialogEditId] = useState<number|null>(null);
  const [invDialogAllowDup, setInvDialogAllowDup] = useState(false);
  const [invDialogDupInfo, setInvDialogDupInfo] = useState<any>(null);

  // ─── Inline editing ──────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState<number | "new" | null>(null);
  const [inlineForm, setInlineForm] = useState<InvForm>({...EMPTY_INV});
  const [inlineAllowDup, setInlineAllowDup] = useState(false);
  const [inlineDupInfo, setInlineDupInfo] = useState<any>(null);
  const inlineSaveRef = useRef<(()=>void)|null>(null);

  // ─── List filters ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"name"|"project"|"dateFrom"|"id">("id");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  // ─── TRPC queries ──────────────────────────────────────────────────────
  const listStmtQ = trpc.rePurchases.listStatements.useQuery(
    { search:search||undefined, project:filterProject||undefined, dateFrom:dateFrom||undefined, dateTo:dateTo||undefined, sortBy, sortDir },
    { enabled: canView }
  );

  const listInvQ = trpc.rePurchases.listInvoices.useQuery(
    { statementId: selectedStmtId! },
    { enabled: canView && !!selectedStmtId && view === "detail" }
  );

  const getStmtQ = trpc.rePurchases.getStatement.useQuery(
    { id: selectedStmtId! },
    { enabled: canView && !!selectedStmtId }
  );

  const checkDupQ = trpc.rePurchases.checkDuplicate.useQuery(
    { supplierTaxId: "", invoiceNumber: "" },
    { enabled: false }
  );

  // ─── Mutations ──────────────────────────────────────────────────────────
  const createStmtMut = trpc.rePurchases.createStatement.useMutation({
    onSuccess: () => { toast.success(ar?"تم إنشاء البيان":"Statement created"); listStmtQ.refetch(); setView("statements"); setStmtForm({...EMPTY_STMT}); },
    onError: (e) => toast.error(e.message),
  });
  const updateStmtMut = trpc.rePurchases.updateStatement.useMutation({
    onSuccess: () => { toast.success(ar?"تم تعديل البيان":"Statement updated"); listStmtQ.refetch(); setView("statements"); setStmtForm({...EMPTY_STMT}); setStmtEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteStmtMut = trpc.rePurchases.deleteStatement.useMutation({
    onSuccess: () => { toast.success(ar?"تم الحذف":"Deleted"); listStmtQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const copyStmtMut = trpc.rePurchases.copyStatement.useMutation({
    onSuccess: () => { toast.success(ar?"تم النسخ بنجاح":"Copied"); listStmtQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const createInvMut = trpc.rePurchases.createInvoice.useMutation({
    onSuccess: () => { toast.success(ar?"تم الحفظ":"Saved"); listInvQ.refetch(); resetInvDialog(); resetInline(); },
    onError: handleInvError,
  });
  const updateInvMut = trpc.rePurchases.updateInvoice.useMutation({
    onSuccess: () => { toast.success(ar?"تم التعديل":"Updated"); listInvQ.refetch(); resetInvDialog(); resetInline(); },
    onError: handleInvError,
  });
  const deleteInvMut = trpc.rePurchases.deleteInvoice.useMutation({
    onSuccess: () => { toast.success(ar?"تم الحذف":"Deleted"); listInvQ.refetch(); },
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
    setShowInvDialog(false); setInvDialogForm({...EMPTY_INV}); setInvDialogEditId(null); setInvDialogAllowDup(false); setInvDialogDupInfo(null);
  }
  function resetInline() {
    setInlineEditId(null); setInlineForm({...EMPTY_INV}); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  // ─── Auto-calculation helpers ─────────────────────────────────────────────────
  const recalc = useCallback((field:"preTax"|"tax"|"total", valStr:string, currentForm:InvForm):Partial<InvForm>=>{
    const v = parseFloat(valStr)||0, rate=parseFloat(currentForm.taxRate)||15;
    let pre=parseFloat(currentForm.preTaxValue)||0, tax=parseFloat(currentForm.taxAmount)||0, tot=parseFloat(currentForm.totalValue)||0;
    if(field==="preTax"){ pre=v; tax=+(pre*(rate/100)).toFixed(4); tot=+(pre+tax).toFixed(4); }
    else if(field==="total"){ tot=v; pre=+(tot/(1+rate/100)).toFixed(4); tax=+(tot-pre).toFixed(4); }
    else if(field==="tax"){ tax=v; if(rate>0){ pre=+(tax/(rate/100)).toFixed(4); tot=+(pre+tax).toFixed(4); } }
    return { preTaxValue:pre>0?pre.toFixed(2):"", taxAmount:tax>0?tax.toFixed(2):"", totalValue:tot>0?tot.toFixed(2):"" };
  }, []);

  const recalcRateChange = useCallback((rateStr:string, currentForm:InvForm):Partial<InvForm>=>{
    const rate=parseFloat(rateStr)||15;
    const pre=parseFloat(currentForm.preTaxValue)||0;
    const tax=+(pre*(rate/100)).toFixed(4);
    const tot=+(pre+tax).toFixed(4);
    return { taxRate:rateStr, taxAmount:pre>0?tax.toFixed(2):currentForm.taxAmount, totalValue:pre>0?tot.toFixed(2):currentForm.totalValue };
  }, []);

  // ─── Duplicate check helper ────────────────────────────────────────────────
  async function checkDuplicateNow(taxId:string, invNum:string, excludeId?:number) {
    if(!taxId || !invNum) return null;
    try {
      const res = await checkDupQ.refetch({ queryKey: ["rePurchases.checkDuplicate", { supplierTaxId: taxId, invoiceNumber: invNum, excludeId }] });
      return res.data ?? null;
    } catch { return null; }
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => openTab("/hs/real-estate", ar?"المطور العقاري":"Real Estate", ReceiptText);
  if(!canView) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
      <ReceiptText className="w-10 h-10 opacity-30"/><p className="text-sm font-medium">{ar?"لا تملك صلاحية":"No permission"}</p>
      <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5"><BackIcon className="w-3.5 h-3.5"/>{ar?"رجوع":"Back"}</Button>
    </div>
  );

  // ─── Statement form actions ──────────────────────────────────────────────
  function openStmtCreate() { setStmtForm({...EMPTY_STMT}); setStmtEditId(null); setView("stmtForm"); }
  function openStmtEdit(row:any) {
    setStmtForm({
      id: row.id, name: row.name ?? "", project: row.project ?? "",
      dateFrom: row.date_from ? String(row.date_from).split("T")[0] : "",
      dateTo: row.date_to ? String(row.date_to).split("T")[0] : "",
      notes: row.notes ?? "",
    });
    setStmtEditId(row.id); setView("stmtForm");
  }
  function handleSaveStmt() {
    if(!stmtForm.name.trim()){ toast.error(ar?"اسم البيان مطلوب":"Statement name required"); return; }
    if(!stmtForm.dateFrom || !stmtForm.dateTo){ toast.error(ar?"الفترة مطلوبة":"Date range required"); return; }
    const payload = { name:stmtForm.name, project:stmtForm.project||null, dateFrom:stmtForm.dateFrom, dateTo:stmtForm.dateTo, notes:stmtForm.notes||null };
    if(stmtEditId){ updateStmtMut.mutate({id:stmtEditId, data:payload}); }
    else { createStmtMut.mutate({data:payload}); }
  }

  // ─── Invoice dialog actions ────────────────────────────────────────────────
  function openInvDialog(row?:any) {
    if(!selectedStmtId){ toast.error(ar?"اختر بياناً أولاً":"Select a statement first"); return; }
    if(row) {
      setInvDialogForm({
        id:row.id, supplierName:row.supplier_name??"", supplierTaxId:row.supplier_tax_id??"",
        invoiceDate:row.invoice_date?String(row.invoice_date).split("T")[0]:"", invoiceNumber:row.invoice_number??"",
        preTaxValue:row.pre_tax_value?String(+row.pre_tax_value):"", taxRate:row.tax_rate?String(+row.tax_rate):"15",
        taxAmount:row.tax_amount?String(+row.tax_amount):"", totalValue:row.total_value?String(+row.total_value):"",
        notes:row.notes??"", attachmentUrl:row.attachment_url??"",
      });
      setInvDialogEditId(row.id);
    } else {
      setInvDialogForm({...EMPTY_INV}); setInvDialogEditId(null);
    }
    setInvDialogAllowDup(false); setInvDialogDupInfo(null); setShowInvDialog(true);
  }

  async function handleSaveInvDialog(andNew=false) {
    if(!selectedStmtId) return;
    const f = invDialogForm;
    if(!f.supplierName.trim()){ toast.error(ar?"اسم المورد مطلوب":"Supplier name required"); return; }
    if(!f.invoiceNumber.trim()){ toast.error(ar?"رقم الفاتورة مطلوب":"Invoice number required"); return; }
    if(!f.invoiceDate){ toast.error(ar?"تاريخ الفاتورة مطلوب":"Date required"); return; }

    // Pre-check duplicate
    if(f.supplierTaxId && !invDialogAllowDup) {
      const dup = await checkDuplicateNow(f.supplierTaxId, f.invoiceNumber, invDialogEditId ?? undefined);
      if(dup) { setInvDialogDupInfo(dup); return; }
    }

    const payload = {
      supplierName:f.supplierName, supplierTaxId:f.supplierTaxId||null, invoiceDate:f.invoiceDate, invoiceNumber:f.invoiceNumber,
      preTaxValue:parseFloat(f.preTaxValue)||0, taxRate:parseFloat(f.taxRate)||15, taxAmount:parseFloat(f.taxAmount)||0,
      totalValue:parseFloat(f.totalValue)||0, notes:f.notes||null, attachmentUrl:f.attachmentUrl||null,
    };
    if(invDialogEditId) {
      updateInvMut.mutate({id:invDialogEditId, data:payload, allowDuplicate:invDialogAllowDup});
    } else {
      createInvMut.mutate({statementId:selectedStmtId, data:payload, allowDuplicate:invDialogAllowDup}, {
        onSuccess:()=>{ if(andNew){ setInvDialogForm({...EMPTY_INV}); setInvDialogEditId(null); setInvDialogAllowDup(false); setInvDialogDupInfo(null); } }
      });
    }
  }

  // ─── Inline invoice actions ──────────────────────────────────────────────────
  async function saveInline() {
    if(!selectedStmtId) return;
    const f = inlineForm;
    if(!f.supplierName.trim() || !f.invoiceNumber.trim() || !f.invoiceDate) {
      // Silently ignore incomplete rows
      if(!f.supplierName.trim() && !f.invoiceNumber.trim()) { resetInline(); return; }
      toast.error(ar?"املأ الحقول المطلوبة":"Fill required fields"); return;
    }

    // Pre-check duplicate
    if(f.supplierTaxId && !inlineAllowDup) {
      const dup = await checkDuplicateNow(f.supplierTaxId, f.invoiceNumber, inlineEditId !== "new" ? inlineEditId ?? undefined : undefined);
      if(dup) { setInlineDupInfo(dup); return; }
    }

    const payload = {
      supplierName:f.supplierName, supplierTaxId:f.supplierTaxId||null, invoiceDate:f.invoiceDate, invoiceNumber:f.invoiceNumber,
      preTaxValue:parseFloat(f.preTaxValue)||0, taxRate:parseFloat(f.taxRate)||15, taxAmount:parseFloat(f.taxAmount)||0,
      totalValue:parseFloat(f.totalValue)||0, notes:f.notes||null, attachmentUrl:f.attachmentUrl||null,
    };

    if(inlineEditId === "new") {
      createInvMut.mutate({statementId:selectedStmtId, data:payload, allowDuplicate:inlineAllowDup});
    } else if(inlineEditId && typeof inlineEditId === "number") {
      updateInvMut.mutate({id:inlineEditId, data:payload, allowDuplicate:inlineAllowDup});
    }
  }

  function startInlineEdit(row:any) {
    setInlineForm({
      id:row.id, supplierName:row.supplier_name??"", supplierTaxId:row.supplier_tax_id??"",
      invoiceDate:row.invoice_date?String(row.invoice_date).split("T")[0]:"", invoiceNumber:row.invoice_number??"",
      preTaxValue:row.pre_tax_value?String(+row.pre_tax_value):"", taxRate:row.tax_rate?String(+row.tax_rate):"15",
      taxAmount:row.tax_amount?String(+row.tax_amount):"", totalValue:row.total_value?String(+row.total_value):"",
      notes:row.notes??"", attachmentUrl:row.attachment_url??"",
    });
    setInlineEditId(row.id); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  function startInlineNew() {
    setInlineForm({...EMPTY_INV}); setInlineEditId("new"); setInlineAllowDup(false); setInlineDupInfo(null);
  }

  // ─── Shared invoice input handlers ──────────────────────────────────────────
  function makeInvInputProps(form:InvForm, setForm:(f:InvForm)=>void, allowDup:boolean, setAllowDup:(v:boolean)=>void, dupInfo:any, setDupInfo:(v:any)=>void, isInline=false) {
    return {
      onChangeSupplierName:(v:string)=>setForm({...form,supplierName:v}),
      onChangeTaxId:(v:string)=>{ setForm({...form,supplierTaxId:v}); if(v && form.invoiceNumber) checkDuplicateNow(v, form.invoiceNumber, form.id).then(d=>{ if(d)setDupInfo(d); else setDupInfo(null); }); },
      onChangeInvoiceNumber:(v:string)=>{ setForm({...form,invoiceNumber:v}); if(form.supplierTaxId && v) checkDuplicateNow(form.supplierTaxId, v, form.id).then(d=>{ if(d)setDupInfo(d); else setDupInfo(null); }); },
      onChangeDate:(v:string)=>setForm({...form,invoiceDate:v}),
      onChangePreTax:(v:string)=>setForm({...form,...recalc("preTax",v,form)}),
      onChangeTaxRate:(v:string)=>setForm({...form,...recalcRateChange(v,form)}),
      onChangeTaxAmount:(v:string)=>setForm({...form,...recalc("tax",v,form)}),
      onChangeTotal:(v:string)=>setForm({...form,...recalc("total",v,form)}),
      onChangeNotes:(v:string)=>setForm({...form,notes:v}),
      onChangeAttachment:(v:string)=>setForm({...form,attachmentUrl:v}),
      onToggleAllowDup:()=>setAllowDup(!allowDup),
      dupInfo, allowDup, isInline,
    };
  }

  // ─── Render: Statement Form ──────────────────────────────────────────────────────
  if(view === "stmtForm") {
    return (
      <div className="h-full overflow-y-auto bg-background" dir={dir}>
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Button variant="ghost" size="sm" onClick={()=>{setView("statements"); setStmtForm({...EMPTY_STMT}); setStmtEditId(null);}} className="gap-1.5 mb-4 -ms-2"><BackIcon className="w-4 h-4"/>{ar?"قائمة البيانات":"Statements"}</Button>
          <h1 className="text-lg font-bold mb-4">{stmtEditId ? (ar?"تعديل البيان":"Edit Statement") : (ar?"إضافة بيان جديد":"Add Statement")}</h1>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"اسم البيان":"Statement Name"} *</label>
              <input value={stmtForm.name} onChange={e=>setStmtForm({...stmtForm,name:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"مثل: مشتريات الربع الأول":"e.g. Q1 Purchases"} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"المشروع":"Project"}</label>
              <input value={stmtForm.project} onChange={e=>setStmtForm({...stmtForm,project:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"اسم المشروع...":"Project name..."} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"من تاريخ":"From Date"} *</label>
                <input type="date" value={stmtForm.dateFrom} onChange={e=>setStmtForm({...stmtForm,dateFrom:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"إلى تاريخ":"To Date"} *</label>
                <input type="date" value={stmtForm.dateTo} onChange={e=>setStmtForm({...stmtForm,dateTo:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"ملاحظات":"Notes"}</label>
              <textarea value={stmtForm.notes} onChange={e=>setStmtForm({...stmtForm,notes:e.target.value})} rows={3} className="w-full px-3 py-2 text-sm border rounded-md" style={{borderColor:C.border}} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSaveStmt} disabled={createStmtMut.isPending||updateStmtMut.isPending} className="gap-1.5"><Save className="w-4 h-4"/> {ar?"حفظ":"Save"}</Button>
              <Button variant="outline" onClick={()=>{setView("statements"); setStmtForm({...EMPTY_STMT}); setStmtEditId(null);}} className="gap-1.5"><X className="w-4 h-4"/> {ar?"إلغاء":"Cancel"}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Statement Detail ──────────────────────────────────────────────────────
  if(view === "detail" && selectedStmtId) {
    const stmt = getStmtQ.data;
    const rows = listInvQ.data?.rows ?? [];
    const totals = listInvQ.data?.totals ?? {preTax:0,tax:0,total:0,count:0};
    const invProps = makeInvInputProps(inlineForm, setInlineForm, inlineAllowDup, setInlineAllowDup, inlineDupInfo, setInlineDupInfo, true);

    return (
      <div className="h-full flex flex-col bg-background" dir={dir}>
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b" style={{background:"#F8F7F4",borderColor:C.border}}>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Button size="sm" variant="ghost" onClick={()=>{setView("statements"); setSelectedStmtId(null);}} className="gap-1"><ChevronLeft className="w-4 h-4"/> {ar?"البيانات":"Statements"}</Button>
            <span className="text-sm text-muted-foreground">/</span>
            <h1 className="text-sm font-bold">{stmt?.name ?? (ar?"بيان المشتريات":"Purchase Statement")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {stmt?.project && <span>{ar?"المشروع:":"Project:"} <strong className="text-foreground">{stmt.project}</strong></span>}
            <span>{ar?"الفترة:":"Period:"} <strong className="text-foreground">{fmtD(stmt?.dateFrom)} → {fmtD(stmt?.dateTo)}</strong></span>
            <span>{ar?"الفواتير:":"Invoices:"} <strong className="text-foreground">{totals.count}</strong></span>
            <span>{ar?"إجمالي:":"Total:"} <strong className="text-foreground" style={{color:C.primary}}>{fmtN(totals.total)}</strong></span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {canAdd && <Button size="sm" onClick={()=>openInvDialog()} className="gap-1"><Plus className="w-4 h-4"/> {ar?"+ إضافة فاتورة مشتريات":"+ Add Purchase Invoice"}</Button>}
            {canEdit && <Button size="sm" variant="outline" onClick={()=>stmt && openStmtEdit(stmt)} className="gap-1"><Pencil className="w-3.5 h-3.5"/> {ar?"تعديل البيان":"Edit Statement"}</Button>}
            {canPrint && <Button size="sm" variant="outline" onClick={()=>window.print()} className="gap-1"><Printer className="w-4 h-4"/> {ar?"طباعة":"Print"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={()=>toast.info(ar?"التصدير قيد التطوير":"Export coming soon")} className="gap-1"><FileSpreadsheet className="w-4 h-4"/> {ar?"تصدير Excel":"Export Excel"}</Button>}
            {canImport && <Button size="sm" variant="outline" onClick={()=>toast.info(ar?"الاستيراد قيد التطوير":"Import coming soon")} className="gap-1"><Upload className="w-4 h-4"/> {ar?"استيراد Excel":"Import Excel"}</Button>}
            <Button size="sm" variant="ghost" onClick={()=>listInvQ.refetch()} className="gap-1"><Search className="w-4 h-4"/> {ar?"تحديث":"Refresh"}</Button>
          </div>
        </div>

        {/* Invoice Table */}
        <div className="flex-1 overflow-auto p-4">
          <div style={{border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:C.header,borderBottom:`2px solid ${C.border}`}}>
                  {[["مسلسل","#"],["اسم المورد","supplier"],["الرقم الضريبي","tax"],["تاريخ الفاتورة","date"],["رقم الفاتورة","number"],["قبل الضريبة","pre"],["الضريبة %","rate"],["مبلغ الضريبة","tax"],["الإجمالي","total"],["ملاحظات","notes"],["إجراءات","actions"]].map(([h])=> (
                    <th key={h} style={{textAlign:"right",padding:"6px 10px",fontWeight:700,color:"#2B4A6A",fontSize:12,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listInvQ.isLoading ? Array.from({length:5}).map((_,i)=> (
                  <tr key={i} style={{borderBottom:"1px solid #F0F0F0"}}>{Array.from({length:11}).map((_,j)=>(<td key={j} style={{padding:"8px 10px"}}><div style={{height:12,background:"#E8E8E8",borderRadius:4}}/></td>))}</tr>
                )) : rows.length === 0 && inlineEditId !== "new" ? (
                  <tr><td colSpan={11} style={{textAlign:"center",padding:"30px 0",color:"#999"}}>
                    <ReceiptText style={{width:28,height:28,margin:"0 auto 6px",opacity:0.3}} />
                    <div style={{fontSize:13}}>{ar?"لا توجد فواتير — اضغط إضافة أو اكتب في الصف الأخير":"No invoices -- click Add or type in the bottom row"}</div>
                    <Button size="sm" variant="outline" onClick={startInlineNew} className="mt-2 gap-1"><Plus className="w-3.5 h-3.5"/> {ar?"إضافة صف جديد":"Add row"}</Button>
                  </td></tr>
                ) : (
                  <>
                    {/* Existing rows */}
                    {rows.map((r:any, idx:number)=>{
                      const isEditing = inlineEditId === r.id;
                      const hasDup = false;
                      return (
                        <tr key={r.id} style={{borderBottom:"1px solid #F0F0F0",background:isEditing?"#FFF9E6":idx%2===0?"white":C.bgAlt}}>
                          <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#E0EAF4",color:C.primary}}>{idx+1}</span></td>

                          {isEditing ? (
                            <>
                              <td style={{padding:"4px 6px"}}><input value={inlineForm.supplierName} onChange={e=>invProps.onChangeSupplierName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"اسم...":"Name..."} /></td>
                              <td style={{padding:"4px 6px"}}><input value={inlineForm.supplierTaxId} onChange={e=>invProps.onChangeTaxId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"الضريبي...":"Tax..."} /></td>
                              <td style={{padding:"4px 6px"}}><input type="date" value={inlineForm.invoiceDate} onChange={e=>invProps.onChangeDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} /></td>
                              <td style={{padding:"4px 6px"}}><input value={inlineForm.invoiceNumber} onChange={e=>invProps.onChangeInvoiceNumber(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"رقم...":"#..."} /></td>
                              <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.preTaxValue} onChange={e=>invProps.onChangePreTax(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                              <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.taxRate} onChange={e=>invProps.onChangeTaxRate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="15" /></td>
                              <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.taxAmount} onChange={e=>invProps.onChangeTaxAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                              <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.totalValue} onChange={e=>invProps.onChangeTotal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                              <td style={{padding:"4px 6px"}}><input value={inlineForm.notes} onChange={e=>invProps.onChangeNotes(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} /></td>
                              <td style={{padding:"4px 6px"}}>
                                <div className="flex items-center gap-1">
                                  <button onClick={saveInline} title={ar?"حفظ":"Save"} className="p-1 rounded hover:bg-green-50"><CheckCircle2 className="w-3.5 h-3.5" style={{color:C.success}}/></button>
                                  <button onClick={resetInline} title={ar?"إلغاء":"Cancel"} className="p-1 rounded hover:bg-gray-100"><Ban className="w-3.5 h-3.5" style={{color:"#999"}}/></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{padding:"6px 10px"}}>{r.supplier_name}</td>
                              <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11}}>{r.supplier_tax_id || "—"}</span></td>
                              <td style={{padding:"6px 10px"}}>{fmtD(r.invoice_date)}</td>
                              <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:600}}>{r.invoice_number}</span></td>
                              <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.pre_tax_value)}</td>
                              <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.tax_rate)}%</td>
                              <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.tax_amount)}</td>
                              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700}}>{fmtN(+r.total_value)}</td>
                              <td style={{padding:"6px 10px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span title={r.notes||""}>{r.notes || "—"}</span></td>
                              <td style={{padding:"6px 10px"}}>
                                <div className="flex items-center gap-1">
                                  <button onClick={()=>startInlineEdit(r)} title={ar?"تعديل مباشر":"Edit inline"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Pencil className="w-3.5 h-3.5" style={{color:C.primary}}/></button>
                                  <button onClick={()=>openInvDialog(r)} title={ar?"تعديل في النافذة":"Edit in dialog"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ArrowUpRight className="w-3.5 h-3.5" style={{color:"#666"}}/></button>
                                  <button onClick={()=>{ if(confirm(ar?"تأكيد الحذف؟":"Confirm delete?")) deleteInvMut.mutate({id:r.id}); }} title={ar?"حذف":"Delete"} disabled={!canDelete} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" style={{color:C.danger}}/></button>
                                  {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" title={ar?"فتح المرفق":"Open attachment"} className="p-1 rounded hover:bg-gray-100"><FileText className="w-3.5 h-3.5" style={{color:"#666"}}/></a>}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* New inline row */}
                    {inlineEditId === "new" ? (
                      <tr style={{borderBottom:"2px solid #D0D0D0",background:"#FFF9E6"}}>
                        <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#E0EAF4",color:C.primary}}>{rows.length+1}</span></td>
                        <td style={{padding:"4px 6px"}}><input value={inlineForm.supplierName} onChange={e=>invProps.onChangeSupplierName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"اسم...":"Name..."} autoFocus /></td>
                        <td style={{padding:"4px 6px"}}><input value={inlineForm.supplierTaxId} onChange={e=>invProps.onChangeTaxId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"الضريبي...":"Tax..."} /></td>
                        <td style={{padding:"4px 6px"}}><input type="date" value={inlineForm.invoiceDate} onChange={e=>invProps.onChangeDate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} /></td>
                        <td style={{padding:"4px 6px"}}><input value={inlineForm.invoiceNumber} onChange={e=>invProps.onChangeInvoiceNumber(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} placeholder={ar?"رقم...":"#..."} /></td>
                        <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.preTaxValue} onChange={e=>invProps.onChangePreTax(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                        <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.taxRate} onChange={e=>invProps.onChangeTaxRate(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="15" /></td>
                        <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.taxAmount} onChange={e=>invProps.onChangeTaxAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                        <td style={{padding:"4px 6px"}}><input type="number" step="0.01" value={inlineForm.totalValue} onChange={e=>invProps.onChangeTotal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded text-right" style={{borderColor:C.border}} placeholder="0" /></td>
                        <td style={{padding:"4px 6px"}}><input value={inlineForm.notes} onChange={e=>invProps.onChangeNotes(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveInline()} className="w-full h-7 px-2 text-xs border rounded" style={{borderColor:C.border}} /></td>
                        <td style={{padding:"4px 6px"}}>
                          <div className="flex items-center gap-1">
                            <button onClick={saveInline} title={ar?"حفظ":"Save"} className="p-1 rounded hover:bg-green-50"><CheckCircle2 className="w-3.5 h-3.5" style={{color:C.success}}/></button>
                            <button onClick={resetInline} title={ar?"إلغاء":"Cancel"} className="p-1 rounded hover:bg-gray-100"><Ban className="w-3.5 h-3.5" style={{color:"#999"}}/></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr style={{borderBottom:"2px solid #D0D0D0",background:"#F8F7F4",cursor:"pointer"}} onClick={startInlineNew}>
                        <td colSpan={11} style={{padding:"8px 10px",textAlign:"center",color:"#888",fontSize:12}}>
                          <Plus className="w-4 h-4 inline-block me-1"/> {ar?"انقر لإضافة صف جديد مباشر أو اضغط الزر أعلاه":"Click to add new inline row"}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Inline duplicate warning */}
          {inlineDupInfo && (
            <div className="mt-2 p-2 rounded border text-xs flex items-center gap-2" style={{background:"#FEF3C7",borderColor:"#F59E0B",color:"#92400E"}}>
              <AlertTriangle className="w-4 h-4 shrink-0"/>
              <span>
                {ar?"تنبيه: فاتورة مكررة مسجلة سابقاً.":"Warning: duplicate invoice found."}
                {inlineDupInfo.statementName && ` (${ar?"البيان:":"Statement:"} ${inlineDupInfo.statementName})`}
                {inlineDupInfo.supplierName && ` — ${inlineDupInfo.supplierName}`}
              </span>
              <button onClick={()=>setInlineAllowDup(true)} className="ms-auto px-2 py-1 rounded text-xs font-semibold" style={{background:"#F59E0B",color:"white"}}>{ar?"الحفظ رغم التنبيه":"Allow save"}</button>
            </div>
          )}
        </div>

        {/* Totals bar */}
        <div className="shrink-0 px-4 py-2 border-t flex flex-wrap gap-4 items-center" style={{background:"#F2F0EC",borderColor:C.border,fontSize:12}}>
          <span className="font-semibold text-foreground">{ar?"إجماليات البيان":"Statement Totals"}:</span>
          <span>{ar?"قبل الضريبة":"Pre-Tax"}: <strong>{fmtN(totals.preTax)}</strong></span>
          <span>{ar?"الضريبة":"Tax"}: <strong>{fmtN(totals.tax)}</strong></span>
          <span>{ar?"الإجمالي شامل":"Total"}: <strong style={{color:C.primary}}>{fmtN(totals.total)}</strong></span>
          <span>{ar?"عدد الفواتير":"Count"}: <strong>{totals.count}</strong></span>
        </div>

        {/* Invoice Dialog */}
        {showInvDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e)=>{if(e.target===e.currentTarget)resetInvDialog();}}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" dir={dir}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{borderColor:C.border}}>
                <h2 className="text-base font-bold">{invDialogEditId ? (ar?"تعديل فاتورة":"Edit Invoice") : (ar?"إضافة فاتورة":"Add Invoice")}</h2>
                <button onClick={resetInvDialog} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" style={{color:"#888"}}/></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                {invDialogDupInfo && (
                  <div className="p-3 rounded border text-sm flex items-start gap-2" style={{background:"#FEF3C7",borderColor:"#F59E0B",color:"#92400E"}}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
                    <div>
                      <p className="font-semibold">{ar?"تنبيه: فاتورة مكررة مسجلة سابقاً":"Warning: duplicate invoice found"}</p>
                      {invDialogDupInfo.statementName && <p className="text-xs mt-0.5">{ar?"البيان:":"Statement:"} {invDialogDupInfo.statementName}</p>}
                      {invDialogDupInfo.supplierName && <p className="text-xs">{ar?"المورد:":"Supplier:"} {invDialogDupInfo.supplierName} | {fmtD(invDialogDupInfo.invoiceDate)}</p>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"اسم المورد":"Supplier Name"} *</label>
                    <input value={invDialogForm.supplierName} onChange={e=>setInvDialogForm({...invDialogForm,supplierName:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"الرقم الضريبي":"Tax ID"}</label>
                    <input value={invDialogForm.supplierTaxId} onChange={e=>{ setInvDialogForm({...invDialogForm,supplierTaxId:e.target.value}); if(e.target.value && invDialogForm.invoiceNumber) checkDuplicateNow(e.target.value, invDialogForm.invoiceNumber, invDialogEditId ?? undefined).then(d=>{ if(d)setInvDialogDupInfo(d); else setInvDialogDupInfo(null); }); }} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"تاريخ الفاتورة":"Date"} *</label>
                    <input type="date" value={invDialogForm.invoiceDate} onChange={e=>setInvDialogForm({...invDialogForm,invoiceDate:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"رقم الفاتورة":"Invoice #"} *</label>
                    <input value={invDialogForm.invoiceNumber} onChange={e=>{ setInvDialogForm({...invDialogForm,invoiceNumber:e.target.value}); if(invDialogForm.supplierTaxId && e.target.value) checkDuplicateNow(invDialogForm.supplierTaxId, e.target.value, invDialogEditId ?? undefined).then(d=>{ if(d)setInvDialogDupInfo(d); else setInvDialogDupInfo(null); }); }} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"قبل الضريبة":"Pre-Tax"}</label>
                    <input type="number" step="0.01" value={invDialogForm.preTaxValue} onChange={e=>setInvDialogForm({...invDialogForm,...recalc("preTax",e.target.value,invDialogForm)})} className="w-full h-9 px-3 text-sm border rounded-md text-right" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"الضريبة %":"Tax %"}</label>
                    <input type="number" step="0.01" value={invDialogForm.taxRate} onChange={e=>setInvDialogForm({...invDialogForm,...recalcRateChange(e.target.value,invDialogForm)})} className="w-full h-9 px-3 text-sm border rounded-md text-right" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"مبلغ الضريبة":"Tax Amount"}</label>
                    <input type="number" step="0.01" value={invDialogForm.taxAmount} onChange={e=>setInvDialogForm({...invDialogForm,...recalc("tax",e.target.value,invDialogForm)})} className="w-full h-9 px-3 text-sm border rounded-md text-right" style={{borderColor:C.border}} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"الإجمالي شامل":"Total"}</label>
                    <input type="number" step="0.01" value={invDialogForm.totalValue} onChange={e=>setInvDialogForm({...invDialogForm,...recalc("total",e.target.value,invDialogForm)})} className="w-full h-9 px-3 text-sm border rounded-md text-right" style={{borderColor:C.border}} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"ملاحظات":"Notes"}</label>
                  <textarea value={invDialogForm.notes} onChange={e=>setInvDialogForm({...invDialogForm,notes:e.target.value})} rows={2} className="w-full px-3 py-2 text-sm border rounded-md" style={{borderColor:C.border}} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"المرفق (URL)":"Attachment (URL)"}</label>
                  <input value={invDialogForm.attachmentUrl} onChange={e=>setInvDialogForm({...invDialogForm,attachmentUrl:e.target.value})} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"رابط الملف...":"File URL..."} />
                </div>

                {invDialogDupInfo && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="allowDupDlg" checked={invDialogAllowDup} onChange={e=>setInvDialogAllowDup(e.target.checked)} className="w-4 h-4" />
                    <label htmlFor="allowDupDlg" className="text-sm text-amber-700 cursor-pointer">{ar?"الحفظ رغم التنبيه بالفاتورة المكررة":"Allow saving despite duplicate warning"}</label>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={()=>handleSaveInvDialog(false)} disabled={createInvMut.isPending||updateInvMut.isPending} className="gap-1.5"><Save className="w-4 h-4"/> {ar?"حفظ":"Save"}</Button>
                  {!invDialogEditId && <Button variant="outline" onClick={()=>handleSaveInvDialog(true)} disabled={createInvMut.isPending} className="gap-1.5">{ar?"حفظ وإضافة جديد":"Save & New"}</Button>}
                  <Button variant="outline" onClick={resetInvDialog} className="gap-1.5"><X className="w-4 h-4"/> {ar?"إلغاء":"Cancel"}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Statements List (default view) ────────────────────────────────────────
  const stmtRows = listStmtQ.data?.rows ?? [];
  const stmtTotals = listStmtQ.data?.totals ?? {preTax:0,tax:0,total:0,count:0};

  return (
    <div className="h-full flex flex-col bg-background" dir={dir}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap" style={{background:"#F8F7F4",borderColor:C.border}}>
        {canAdd && <Button size="sm" onClick={openStmtCreate} className="gap-1"><Plus className="w-4 h-4"/> {ar?"+ إضافة بيان تفصيلي جديد":"+ Add Statement"}</Button>}
        <Button size="sm" variant="ghost" onClick={()=>listStmtQ.refetch()} className="gap-1"><Search className="w-4 h-4"/> {ar?"تحديث":"Refresh"}</Button>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1"><BackIcon className="w-4 h-4"/> {ar?"المطور العقاري":"Real Estate"}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b flex flex-wrap gap-2 items-end shrink-0" style={{borderColor:C.border}}>
        <div className="relative" style={{maxWidth:240}}>
          <Search className="absolute" style={{right:8,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#888"}} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ar?"بحث باسم البيان أو المشروع...":"Search statement or project..."} className="w-full h-8 px-3 text-sm border rounded" style={{paddingRight:28,borderColor:C.border}} />
        </div>
        <input value={filterProject} onChange={e=>setFilterProject(e.target.value)} placeholder={ar?"تصفية بالمشروع...":"Filter project..."} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
          <span className="text-muted-foreground text-xs">→</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
        </div>
      </div>

      {/* Statement Table */}
      <div className="flex-1 overflow-auto p-4">
        <div style={{border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:C.header,borderBottom:`2px solid ${C.border}`}}>
                {[["مسلسل","#"],["اسم البيان","name"],["المشروع","project"],["الفترة","dateFrom"],["الفواتير","invoice_count"],["قبل الضريبة","pre_tax_total"],["الضريبة","tax_total"],["الإجمالي","grand_total"],["تاريخ الإنشاء","created_at"],["إجراءات","actions"]].map(([h,col])=>{
                  const isSort = sortBy === (col as any);
                  return (
                    <th key={col} onClick={()=>col && col!=="#" && col!=="actions" && (()=>{ if(sortBy===col as any) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(col as any); setSortDir("desc"); } })()} style={{textAlign:"right",padding:"6px 10px",fontWeight:700,color:"#2B4A6A",fontSize:12,whiteSpace:"nowrap",cursor:col && col!=="#" && col!=="actions"?"pointer":"default"}}>
                      <span className="flex items-center gap-1">{h} {isSort && (sortDir==="asc"?<SortAsc className="w-3 h-3"/>:<SortDesc className="w-3 h-3"/>)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {listStmtQ.isLoading ? Array.from({length:5}).map((_,i)=> (
                <tr key={i} style={{borderBottom:"1px solid #F0F0F0"}}>{Array.from({length:10}).map((_,j)=>(<td key={j} style={{padding:"8px 10px"}}><div style={{height:12,background:"#E8E8E8",borderRadius:4,animation:"pulse 1.5s infinite"}}/></td>))}</tr>
              )) : stmtRows.length === 0 ? (
                <tr><td colSpan={10} style={{textAlign:"center",padding:"40px 0",color:"#999"}}>
                  <ReceiptText style={{width:32,height:32,margin:"0 auto 8px",opacity:0.3}} />
                  <div style={{fontSize:13}}>{search||filterProject||dateFrom||dateTo ? (ar?"لا توجد نتائج":"No results") : (ar?"لا توجد بيانات — اضغط «إضافة» للبدء":"No statements -- click Add to start")}</div>
                  {canAdd && <Button size="sm" variant="outline" onClick={openStmtCreate} className="mt-2 gap-1"><Plus className="w-3.5 h-3.5"/> {ar?"إضافة بيان":"Add Statement"}</Button>}
                </td></tr>
              ) : stmtRows.map((r:any, idx:number)=> (
                <tr key={r.id} style={{borderBottom:"1px solid #F0F0F0",background:idx%2===0?"white":C.bgAlt}}>
                  <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#E0EAF4",color:C.primary}}>{idx+1}</span></td>
                  <td style={{padding:"6px 10px",fontWeight:600}}>{r.name}</td>
                  <td style={{padding:"6px 10px"}}>{r.project || "—"}</td>
                  <td style={{padding:"6px 10px"}}><span className="text-xs">{fmtD(r.date_from)} → {fmtD(r.date_to)}</span></td>
                  <td style={{padding:"6px 10px",textAlign:"center"}}><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{background:"#E0EAF4",color:C.primary}}>{r.invoice_count ?? 0}</span></td>
                  <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.pre_tax_total)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.tax_total)}</td>
                  <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700}}>{fmtN(+r.grand_total)}</td>
                  <td style={{padding:"6px 10px"}}><span className="text-xs text-muted-foreground">{fmtD(r.created_at)}</span></td>
                  <td style={{padding:"6px 10px"}}>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>{ setSelectedStmtId(r.id); setView("detail"); }} title={ar?"فتح البيان":"Open"} className="p-1 rounded hover:bg-gray-100"><Eye className="w-3.5 h-3.5" style={{color:C.primary}}/></button>
                      <button onClick={()=>openStmtEdit(r)} title={ar?"تعديل":"Edit"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Pencil className="w-3.5 h-3.5" style={{color:"#666"}}/></button>
                      <button onClick={()=>copyStmtMut.mutate({id:r.id})} title={ar?"نسخ":"Copy"} disabled={!canAdd} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Copy className="w-3.5 h-3.5" style={{color:"#666"}}/></button>
                      <button onClick={()=>{ if(confirm(ar?"تأكيد الحذف؟ سيتم حذف جميع الفواتير التابعة له.":"Confirm delete? All invoices inside will be deleted.")) deleteStmtMut.mutate({id:r.id}); }} title={ar?"حذف":"Delete"} disabled={!canDelete} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" style={{color:C.danger}}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="shrink-0 px-4 py-2 border-t flex flex-wrap gap-4 items-center" style={{background:"#F2F0EC",borderColor:C.border,fontSize:12}}>
        <span className="font-semibold text-foreground">{ar?"إجماليات النتائج":"Totals"}:</span>
        <span>{ar?"قبل الضريبة":"Pre-Tax"}: <strong>{fmtN(stmtTotals.preTax)}</strong></span>
        <span>{ar?"الضريبة":"Tax"}: <strong>{fmtN(stmtTotals.tax)}</strong></span>
        <span>{ar?"الإجمالي شامل":"Total"}: <strong style={{color:C.primary}}>{fmtN(stmtTotals.total)}</strong></span>
        <span>{ar?"عدد البيانات":"Statements"}: <strong>{stmtTotals.count}</strong></span>
      </div>
    </div>
  );
}
