/**
 * RePurchasesPage.tsx -- البيان التفصيلي للمشتريات (Phase 2)
 */
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  ReceiptText, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2, Eye,
  Printer, FileSpreadsheet, Upload, AlertTriangle, X, Calendar, FileText,
  SortAsc, SortDesc,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, isAdminRole } from "@/shared/lib/hsPermissions";

const C = { primary:"#406B93", border:"#D0D0D0", bgAlt:"#FAFAFA", header:"#E8EEF4", danger:"#C0392B", warn:"#F59E0B" };
function fmtN(n:number){ return (n??0).toLocaleString("ar-SA",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtD(d:string|Date|null){ if(!d) return "—"; const dt=typeof d==="string"?new Date(d):d; return dt.toLocaleDateString("ar-SA",{year:"numeric",month:"2-digit",day:"2-digit"}); }

interface PurchaseForm {
  id?: number; supplierName:string; supplierTaxId:string; invoiceDate:string; invoiceNumber:string;
  preTaxValue:string; taxRate:string; taxAmount:string; totalValue:string; notes:string; attachmentUrl:string;
}
const EMPTY: PurchaseForm = { supplierName:"", supplierTaxId:"", invoiceDate:new Date().toISOString().split("T")[0], invoiceNumber:"", preTaxValue:"", taxRate:"15", taxAmount:"", totalValue:"", notes:"", attachmentUrl:"" };

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

  const [view, setView] = useState<"list"|"form">("list");
  const [form, setForm] = useState<PurchaseForm>({...EMPTY});
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterTaxId, setFilterTaxId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"supplierName"|"supplierTaxId"|"invoiceDate"|"id">("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [editId, setEditId] = useState<number|null>(null);
  const [allowDup, setAllowDup] = useState(false);

  const listQ = trpc.rePurchases.list.useQuery(
    {search:search||undefined, supplierName:filterSupplier||undefined, supplierTaxId:filterTaxId||undefined, dateFrom:dateFrom||undefined, dateTo:dateTo||undefined, sortBy, sortDir},
    {enabled:canView}
  );
  const createMut = trpc.rePurchases.create.useMutation({
    onSuccess:()=>{ toast.success(ar?"تم الحفظ بنجاح":"Saved"); listQ.refetch(); setView("list"); setForm({...EMPTY}); setAllowDup(false); },
    onError:(e)=>{ if(e.message.includes("تنبيه:")){ toast.error(e.message,{duration:6000}); } else toast.error(e.message); }
  });
  const updateMut = trpc.rePurchases.update.useMutation({
    onSuccess:()=>{ toast.success(ar?"تم التعديل بنجاح":"Updated"); listQ.refetch(); setView("list"); setForm({...EMPTY}); setAllowDup(false); },
    onError:(e)=>{ if(e.message.includes("تنبيه:")){ toast.error(e.message,{duration:6000}); } else toast.error(e.message); }
  });
  const deleteMut = trpc.rePurchases.delete.useMutation({ onSuccess:()=>{ toast.success(ar?"تم الحذف":"Deleted"); listQ.refetch(); }, onError:(e)=>toast.error(e.message) });

  const goBack = () => openTab("/hs/real-estate", ar?"المطور العقاري":"Real Estate", ReceiptText);
  if(!canView) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
      <ReceiptText className="w-10 h-10 opacity-30"/><p className="text-sm font-medium">{ar?"لا تملك صلاحية":"No permission"}</p>
      <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5"><BackIcon className="w-3.5 h-3.5"/>{ar?"رجوع":"Back"}</Button>
    </div>
  );

  const recalc = (field:"preTax"|"tax"|"total", valStr:string)=>{
    const v = parseFloat(valStr)||0, rate=parseFloat(form.taxRate)||15;
    let pre=parseFloat(form.preTaxValue)||0, tax=parseFloat(form.taxAmount)||0, tot=parseFloat(form.totalValue)||0;
    if(field==="preTax"){ pre=v; tax=+(pre*(rate/100)).toFixed(4); tot=+(pre+tax).toFixed(4); }
    else if(field==="total"){ tot=v; pre=+(tot/(1+rate/100)).toFixed(4); tax=+(tot-pre).toFixed(4); }
    else if(field==="tax"){ tax=v; if(rate>0){ pre=+(tax/(rate/100)).toFixed(4); tot=+(pre+tax).toFixed(4); } }
    setForm(f=>({...f, preTaxValue:pre>0?pre.toFixed(2):"", taxAmount:tax>0?tax.toFixed(2):"", totalValue:tot>0?tot.toFixed(2):""}));
  };

  const handleSave = (andNew=false)=>{
    if(!form.supplierName.trim()){ toast.error(ar?"اسم المورد مطلوب":"Supplier name required"); return; }
    if(!form.invoiceNumber.trim()){ toast.error(ar?"رقم الفاتورة مطلوب":"Invoice number required"); return; }
    if(!form.invoiceDate){ toast.error(ar?"تاريخ الفاتورة مطلوب":"Date required"); return; }
    const payload={ supplierName:form.supplierName, supplierTaxId:form.supplierTaxId||null, invoiceDate:form.invoiceDate, invoiceNumber:form.invoiceNumber, preTaxValue:parseFloat(form.preTaxValue)||0, taxRate:parseFloat(form.taxRate)||15, taxAmount:parseFloat(form.taxAmount)||0, totalValue:parseFloat(form.totalValue)||0, notes:form.notes||null, attachmentUrl:form.attachmentUrl||null };
    if(editId){ updateMut.mutate({id:editId, data:payload, allowDuplicate:allowDup}); }
    else { createMut.mutate({data:payload, allowDuplicate:allowDup}, { onSuccess:()=>{ if(andNew){ setForm({...EMPTY}); setEditId(null); setAllowDup(false); } } }); }
  };

  const openCreate=()=>{ setForm({...EMPTY}); setEditId(null); setAllowDup(false); setView("form"); };
  const openEdit=(row:any)=>{
    setForm({ id:row.id, supplierName:row.supplier_name??"", supplierTaxId:row.supplier_tax_id??"", invoiceDate:row.invoice_date?String(row.invoice_date).split("T")[0]:"", invoiceNumber:row.invoice_number??"", preTaxValue:row.pre_tax_value?String(+row.pre_tax_value):"", taxRate:row.tax_rate?String(+row.tax_rate):"15", taxAmount:row.tax_amount?String(+row.tax_amount):"", totalValue:row.total_value?String(+row.total_value):"", notes:row.notes??"", attachmentUrl:row.attachment_url??"" });
    setEditId(row.id); setAllowDup(false); setView("form");
  };
  const toggleSort=(col:typeof sortBy)=>{ if(sortBy===col) setSortDir(d=>d==="asc"?"desc":"asc"); else { setSortBy(col); setSortDir("desc"); } };

  const rows = listQ.data?.rows ?? [];
  const totals = listQ.data?.totals ?? {preTax:0,tax:0,total:0,count:0};

  if(view==="form") return (
    <div className="h-full overflow-y-auto bg-background" dir={dir}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Button variant="ghost" size="sm" onClick={()=>setView("list")} className="gap-1.5 mb-4 -ms-2"><BackIcon className="w-4 h-4"/>{ar?"البيان":"Statement"}</Button>
        <h1 className="text-lg font-bold mb-4">{editId ? (ar?"تعديل فاتورة مشتريات":"Edit Purchase Invoice") : (ar?"إضافة فاتورة مشتريات":"Add Purchase Invoice")}</h1>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"اسم المورد":"Supplier Name"} *</label>
              <input value={form.supplierName} onChange={e=>setForm(f=>({...f,supplierName:e.target.value}))} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"اسم المورد...":"Supplier name..."} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"الرقم الضريبي للمورد":"Supplier Tax ID"}</label>
              <input value={form.supplierTaxId} onChange={e=>setForm(f=>({...f,supplierTaxId:e.target.value}))} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"الرقم الضريبي...":"Tax ID..."} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"تاريخ الفاتورة":"Invoice Date"} *</label>
              <input type="date" value={form.invoiceDate} onChange={e=>setForm(f=>({...f,invoiceDate:e.target.value}))} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"رقم الفاتورة":"Invoice Number"} *</label>
              <input value={form.invoiceNumber} onChange={e=>setForm(f=>({...f,invoiceNumber:e.target.value}))} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"رقم الفاتورة...":"Invoice number..."} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"القيمة قبل الضريبة":"Pre-Tax Value"}</label>
              <input type="number" step="0.01" value={form.preTaxValue} onChange={e=>recalc("preTax",e.target.value)} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"نسبة الضريبة %":"Tax Rate %"}</label>
              <input type="number" step="0.01" value={form.taxRate} onChange={e=>{ setForm(f=>({...f,taxRate:e.target.value})); const pre=parseFloat(form.preTaxValue)||0; const rate=parseFloat(e.target.value)||15; const tax=+(pre*(rate/100)).toFixed(4); const tot=+(pre+tax).toFixed(4); setForm(f=>({...f,taxRate:e.target.value, taxAmount:pre>0?tax.toFixed(2):f.taxAmount, totalValue:pre>0?tot.toFixed(2):f.totalValue})); }} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder="15" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"مبلغ الضريبة":"Tax Amount"}</label>
              <input type="number" step="0.01" value={form.taxAmount} onChange={e=>recalc("tax",e.target.value)} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"الإجمالي شامل":"Total"}</label>
              <input type="number" step="0.01" value={form.totalValue} onChange={e=>recalc("total",e.target.value)} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder="0.00" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"ملاحظات":"Notes"}</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} className="w-full px-3 py-2 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"ملاحظات الفاتورة...":"Notes..."} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{ar?"المرفق (صورة أو PDF)":"Attachment (Image or PDF)"}</label>
            <input value={form.attachmentUrl} onChange={e=>setForm(f=>({...f,attachmentUrl:e.target.value}))} className="w-full h-9 px-3 text-sm border rounded-md" style={{borderColor:C.border}} placeholder={ar?"رابط الملف...":"File URL..."} />
          </div>

          {allowDup && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0"/> {ar?"تم تمكين الحفظ رغم التحذير بفاتورة مكررة.":"Duplicate warning acknowledged."}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={()=>handleSave(false)} disabled={createMut.isPending||updateMut.isPending} className="gap-1.5">
              {createMut.isPending||updateMut.isPending?"⌛":"💾"} {ar?"حفظ":"Save"}
            </Button>
            {!editId && (
              <Button variant="outline" onClick={()=>handleSave(true)} disabled={createMut.isPending} className="gap-1.5">
                {ar?"حفظ وإضافة جديد":"Save & New"}
              </Button>
            )}
            {form.supplierTaxId && form.invoiceNumber && (
              <Button variant="ghost" size="sm" onClick={()=>setAllowDup(v=>!v)} className="text-amber-600 gap-1">
                <AlertTriangle className="w-3.5 h-3.5"/> {allowDup?(ar?"إلغاء التمكين":"Cancel Ack"):(ar?"تمكين الحفظ رغم التكرار":"Allow Duplicate")}
              </Button>
            )}
            <Button variant="outline" onClick={()=>{setView("list"); setForm({...EMPTY}); setEditId(null); setAllowDup(false);}} className="gap-1.5">
              <X className="w-4 h-4"/> {ar?"إلغاء":"Cancel"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-background" dir={dir}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap" style={{background:"#F8F7F4",borderColor:C.border}}>
        {canAdd && <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4"/> {ar?"+ إضافة فاتورة مشتريات":"+ Add Purchase Invoice"}</Button>}
        {canPrint && <Button size="sm" variant="outline" onClick={()=>window.print()} className="gap-1"><Printer className="w-4 h-4"/> {ar?"طباعة":"Print"}</Button>}
        {canExport && <Button size="sm" variant="outline" onClick={()=>toast.info(ar?"التصدير قيد التطوير":"Export coming soon")} className="gap-1"><FileSpreadsheet className="w-4 h-4"/> {ar?"تصدير Excel":"Export Excel"}</Button>}
        {canImport && <Button size="sm" variant="outline" onClick={()=>toast.info(ar?"الاستيراد قيد التطوير":"Import coming soon")} className="gap-1"><Upload className="w-4 h-4"/> {ar?"استيراد Excel":"Import Excel"}</Button>}
        <Button size="sm" variant="ghost" onClick={()=>listQ.refetch()} className="gap-1"><Search className="w-4 h-4"/> {ar?"تحديث":"Refresh"}</Button>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1"><BackIcon className="w-4 h-4"/> {ar?"المطور العقاري":"Real Estate"}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b flex flex-wrap gap-2 items-end shrink-0" style={{borderColor:C.border}}>
        <div className="relative" style={{maxWidth:220}}>
          <Search className="absolute" style={{right:8,top:"50%",transform:"translateY(-50%)",width:14,height:14,color:"#888"}} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={ar?"بحث بالاسم أو الرقم أو الضريبي...":"Search name, number, tax..."} className="w-full h-8 px-3 text-sm border rounded" style={{paddingRight:28,borderColor:C.border}} />
        </div>
        <input value={filterSupplier} onChange={e=>setFilterSupplier(e.target.value)} placeholder={ar?"تصفية بالمورد...":"Filter supplier..."} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
        <input value={filterTaxId} onChange={e=>setFilterTaxId(e.target.value)} placeholder={ar?"تصفية بالضريبي...":"Filter tax ID..."} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
          <span className="text-muted-foreground text-xs">→</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="h-8 px-2 text-sm border rounded" style={{borderColor:C.border}} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div style={{border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:C.header,borderBottom:`2px solid ${C.border}`}}>
                {[["مسلسل","id"],["اسم المورد","supplierName"],["الرقم الضريبي","supplierTaxId"],["تاريخ الفاتورة","invoiceDate"],["رقم الفاتورة","invoiceNumber"],["قبل الضريبة","preTaxValue"],["الضريبة %","taxRate"],["مبلغ الضريبة","taxAmount"],["الإجمالي","totalValue"],["ملاحظات","notes"],["إجراءات",""]].map(([h,col])=>{
                  const isSort = sortBy === (col as any);
                  return (
                    <th key={col} onClick={()=>col&&toggleSort(col as any)} style={{textAlign:"right",padding:"6px 10px",fontWeight:700,color:"#2B4A6A",fontSize:12,whiteSpace:"nowrap",cursor:col?"pointer":"default"}}>
                      <span className="flex items-center gap-1">{h} {isSort && (sortDir==="asc"?<SortAsc className="w-3 h-3"/>:<SortDesc className="w-3 h-3"/>)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading ? Array.from({length:5}).map((_,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #F0F0F0"}}>{Array.from({length:11}).map((_,j)=>(<td key={j} style={{padding:"8px 10px"}}><div style={{height:12,background:"#E8E8E8",borderRadius:4,animation:"pulse 1.5s infinite"}}/></td>))}</tr>
              )) : rows.length===0 ? (
                <tr><td colSpan={11} style={{textAlign:"center",padding:"40px 0",color:"#999"}}>
                  <ReceiptText style={{width:32,height:32,margin:"0 auto 8px",opacity:0.3}}/>
                  <div style={{fontSize:13}}>{search||filterSupplier||filterTaxId||dateFrom||dateTo ? (ar?"لا توجد نتائج":"No results") : (ar?"لا توجد فواتير — اضغط «إضافة» للبدء":"No invoices -- click Add to start")}</div>
                </td></tr>
              ) : rows.map((r:any,idx:number)=>{
                const isDup = false;
                return (
                  <tr key={r.id} style={{borderBottom:"1px solid #F0F0F0",background:idx%2===0?"white":C.bgAlt}}>
                    <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:"#E0EAF4",color:C.primary}}>{r.id}</span></td>
                    <td style={{padding:"6px 10px"}}>{r.supplier_name}</td>
                    <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11}}>{r.supplier_tax_id || "—"}</span></td>
                    <td style={{padding:"6px 10px"}}>{fmtD(r.invoice_date)}</td>
                    <td style={{padding:"6px 10px"}}><span style={{fontFamily:"monospace",fontSize:11,fontWeight:600}}>{r.invoice_number}</span></td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.pre_tax_value)}</td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.tax_rate)}%</td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>{fmtN(+r.tax_amount)}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontWeight:700}}>{fmtN(+r.total_value)}</td>
                    <td style={{padding:"6px 10px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span title={r.notes||""}>{r.notes || "—"}</span></td>
                    <td style={{padding:"6px 10px"}}>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>openEdit(r)} title={ar?"تعديل":"Edit"} disabled={!canEdit} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Pencil className="w-3.5 h-3.5" style={{color:C.primary}}/></button>
                        <button onClick={()=>{ if(confirm(ar?"تأكيد الحذف؟":"Confirm delete?")) deleteMut.mutate({id:r.id}); }} title={ar?"حذف":"Delete"} disabled={!canDelete} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" style={{color:C.danger}}/></button>
                        {r.attachment_url && <a href={r.attachment_url} target="_blank" rel="noreferrer" title={ar?"فتح المرفق":"Open attachment"} className="p-1 rounded hover:bg-gray-100"><FileText className="w-3.5 h-3.5" style={{color:"#666"}}/></a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="shrink-0 px-4 py-2 border-t flex flex-wrap gap-4 items-center" style={{background:"#F2F0EC",borderColor:C.border,fontSize:12}}>
        <span className="font-semibold text-foreground">{ar?"إجماليات النتائج":"Totals"}:</span>
        <span>{ar?"قبل الضريبة":"Pre-Tax"}: <strong>{fmtN(totals.preTax)}</strong></span>
        <span>{ar?"الضريبة":"Tax"}: <strong>{fmtN(totals.tax)}</strong></span>
        <span>{ar?"الإجمالي شامل":"Total"}: <strong style={{color:C.primary}}>{fmtN(totals.total)}</strong></span>
        <span>{ar?"عدد الفواتير":"Count"}: <strong>{totals.count}</strong></span>
      </div>
    </div>
  );
}
