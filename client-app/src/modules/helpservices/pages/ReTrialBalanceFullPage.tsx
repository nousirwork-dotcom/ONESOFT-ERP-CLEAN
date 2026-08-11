/**
 * ReTrialBalanceFullPage.tsx -- ميزان المراجعة المبسط (Phase 3)
 * Simplified Trial Balance for Real Estate Developer
 */
import { useState, useEffect, useMemo } from "react";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  Scale, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2, Eye,
  Printer, FileSpreadsheet, Download, Save, X, Ban, ChevronLeft, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, FileText, ClipboardCheck, RotateCcw,
  ShieldCheck, Receipt, ListChecks, History, ArrowUpDown, FolderTree,
  Settings2, Building2, HelpCircle,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { canViewHsScreen, isAdminRole } from "@/shared/lib/hsPermissions";

const C = { primary: "#406B93", border: "#D0D0D0", bgAlt: "#FAFAFA", header: "#E8EEF4", danger: "#C0392B", warn: "#F59E0B", success: "#16A34A", gray: "#9CA3AF" };

const CAT_LABELS: Record<string, { ar: string; en: string }> = {
  assets:      { ar: "الأصول", en: "Assets" },
  liabilities: { ar: "الخصوم", en: "Liabilities" },
  equity:      { ar: "الرأس المالي", en: "Equity" },
  revenue:     { ar: "الإيرادات", en: "Revenue" },
  expenses:    { ar: "التكاليف", en: "Expenses" },
};
const REVIEW_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  not_reviewed: { ar: "غير مراجع", en: "Not reviewed", color: "bg-gray-200 text-gray-600" },
  reviewed:     { ar: "مراجع", en: "Reviewed", color: "bg-emerald-100 text-emerald-700" },
  has_diff:     { ar: "فارق", en: "Diff", color: "bg-amber-100 text-amber-700" },
  needs_doc:    { ar: "يحتاج وثائق", en: "Needs docs", color: "bg-blue-100 text-blue-700" },
};
type AccountCategory = "assets" | "liabilities" | "equity" | "revenue" | "expenses";
type ReviewStatus = "not_reviewed" | "reviewed" | "has_diff" | "needs_doc";

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? +n : 0;
}
function fmt2(n: number | string | null | undefined): string {
  const val = toNum(n);
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReTrialBalanceFullPage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const ar = lang === "ar";
  const isAdmin = isAdminRole(user?.role);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const utils = trpc.useUtils();

  const canView = canViewHsScreen(user, "hs_re_trial_balance");
  const canAdd = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_add"] === true;
  const canEdit = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_edit"] === true;
  const canDelete = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_delete"] === true;
  const canExport = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_export"] === true;
  const canChart = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_chart"] === true;
  const canReview = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_review"] === true;
  const canSettle = isAdmin || user?.extraPermissions?.["hs_re_trial_balance_settlement"] === true;

  const [view, setView] = useState<"list" | "detail" | "accountTree" | "taxReturn" | "auditLog" | "review" | "settlement">("list");
  const [selTB, setSelTB] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: "", periodLabel: "", fromDate: "", toDate: "", projectId: null as number | null, scope: "org", notes: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [showDel, setShowDel] = useState<number | null>(null);

  const [showAcctForm, setShowAcctForm] = useState(false);
  const [acctForm, setAcctForm] = useState({ code: "", name: "", category: "assets" as AccountCategory, nature: "debit" as "debit" | "credit", sortOrder: 0, parentId: null as number | null });
  const [acctEditId, setAcctEditId] = useState<number | null>(null);

  const [taxForm, setTaxForm] = useState<any>({});
  const [settleForm, setSettleForm] = useState<any>({ accountId: null, difference: 0, direction: "debit" as "debit" | "credit", notes: "" });
  const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set());
  const [draftEntries, setDraftEntries] = useState<Record<number, any>>({});
  const [unsaved, setUnsaved] = useState(false);

  const listQ = trpc.reTrialBalance.listTrialBalances.useQuery({ q: search || undefined, page, pageSize }, { enabled: view === "list" });
  const tbQ = trpc.reTrialBalance.getTrialBalance.useQuery(selTB ?? 0, { enabled: !!selTB && view !== "list" });
  const acctsQ = trpc.reTrialBalance.listAccounts.useQuery(selTB ?? 0, { enabled: !!selTB });
  const entriesQ = trpc.reTrialBalance.getEntries.useQuery(selTB ?? 0, { enabled: !!selTB && view === "detail" });
  const bsQ = trpc.reTrialBalance.getBalanceSheet.useQuery(selTB ?? 0, { enabled: !!selTB && view === "detail" });
  const taxQ = trpc.reTrialBalance.getTaxReturn.useQuery(selTB ?? 0, { enabled: !!selTB && (view === "taxReturn" || view === "detail") });
  const auditQ = trpc.reTrialBalance.getAuditLog.useQuery(selTB ?? 0, { enabled: !!selTB && view === "auditLog" });
  const reviewQ = trpc.reTrialBalance.getReviewPanel.useQuery(selTB ?? 0, { enabled: !!selTB && view === "review" });
  const settleQ = trpc.reTrialBalance.getSettlement.useQuery(selTB ?? 0, { enabled: !!selTB && view === "settlement" });
  const projectsQ = trpc.reTrialBalance.listProjects.useQuery(undefined, { enabled: view === "list" || showForm });

  const createTB = trpc.reTrialBalance.createTrialBalance.useMutation({
    onSuccess: () => { toast.success(ar ? "تم إنشاء ميزان المراجعة" : "Trial balance created"); utils.reTrialBalance.listTrialBalances.invalidate(); setShowForm(false); setForm({ name: "", periodLabel: "", fromDate: "", toDate: "", projectId: null, scope: "org", notes: "" }); },
    onError: (e) => { toast.error(ar ? "فشل الإنشاء: " + e.message : "Create failed: " + e.message); console.error("createTB error", e); },
  });
  const updateTB = trpc.reTrialBalance.updateTrialBalance.useMutation({
    onSuccess: () => { toast.success(ar ? "تم التحديث" : "Updated"); utils.reTrialBalance.listTrialBalances.invalidate(); tbQ.refetch(); setShowForm(false); setEditId(null); },
    onError: (e) => { toast.error(ar ? "فشل التحديث: " + e.message : "Update failed: " + e.message); console.error("updateTB error", e); },
  });
  const deleteTB = trpc.reTrialBalance.deleteTrialBalance.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الحذف" : "Deleted"); utils.reTrialBalance.listTrialBalances.invalidate(); setShowDel(null); setView("list"); setSelTB(null); },
    onError: (e) => { toast.error(ar ? "فشل الحذف: " + e.message : "Delete failed: " + e.message); },
  });
  const saveEntries = trpc.reTrialBalance.saveEntries.useMutation({
    onSuccess: () => { toast.success(ar ? "تم حفظ الأرقام" : "Saved"); setUnsaved(false); utils.reTrialBalance.getEntries.invalidate(); bsQ.refetch(); },
    onError: (e) => { toast.error(ar ? "فشل الحفظ: " + e.message : "Save failed: " + e.message); console.error("saveEntries error", e); },
  });
  const createAcct = trpc.reTrialBalance.createAccount.useMutation({
    onSuccess: () => { toast.success(ar ? "تم إضافة الحساب" : "Account added"); utils.reTrialBalance.listAccounts.invalidate(); utils.reTrialBalance.getBalanceSheet.invalidate(); setShowAcctForm(false); },
    onError: (e) => { toast.error(ar ? "فشل إضافة الحساب: " + e.message : "Add account failed: " + e.message); },
  });
  const updateAcct = trpc.reTrialBalance.updateAccount.useMutation({
    onSuccess: () => { toast.success(ar ? "تم تحديث الحساب" : "Account updated"); utils.reTrialBalance.listAccounts.invalidate(); setShowAcctForm(false); setAcctEditId(null); },
    onError: (e) => { toast.error(ar ? "فشل تحديث الحساب: " + e.message : "Update account failed: " + e.message); },
  });
  const deleteAcct = trpc.reTrialBalance.deleteAccount.useMutation({
    onSuccess: () => { toast.success(ar ? "تم حذف الحساب" : "Account deleted"); utils.reTrialBalance.listAccounts.invalidate(); utils.reTrialBalance.getBalanceSheet.invalidate(); },
    onError: (e) => { toast.error(ar ? "فشل حذف الحساب: " + e.message : "Delete account failed: " + e.message); },
  });
  const resetDefaults = trpc.reTrialBalance.resetDefaultAccounts.useMutation({
    onSuccess: () => { toast.success(ar ? "تم إعادة الدليل الافتراضي" : "Reset to defaults"); utils.reTrialBalance.listAccounts.invalidate(); utils.reTrialBalance.getEntries.invalidate(); utils.reTrialBalance.getBalanceSheet.invalidate(); utils.reTrialBalance.getTaxReturn.invalidate(); setDraftEntries({}); setUnsaved(false); },
    onError: (e) => { toast.error(ar ? "فشل إعادة الضبط: " + e.message : "Reset failed: " + e.message); },
  });
  const saveTax = trpc.reTrialBalance.saveTaxReturn.useMutation({
    onSuccess: () => { toast.success(ar ? "تم حفظ الضريبة" : "Tax return saved"); utils.reTrialBalance.getTaxReturn.invalidate(); },
    onError: (e) => { toast.error(ar ? "فشل حفظ الضريبة: " + e.message : "Tax save failed: " + e.message); },
  });
  const saveReview = trpc.reTrialBalance.updateReview.useMutation({
    onSuccess: () => { toast.success(ar ? "تم حفظ المراجعة" : "Review saved"); utils.reTrialBalance.getReviewPanel.invalidate(); utils.reTrialBalance.getBalanceSheet.invalidate(); },
    onError: (e) => { toast.error(ar ? "فشل حفظ المراجعة: " + e.message : "Review save failed: " + e.message); },
  });
  const saveSettle = trpc.reTrialBalance.saveSettlement.useMutation({
    onSuccess: () => { toast.success(ar ? "تم حفظ التسوية" : "Settlement saved"); utils.reTrialBalance.getSettlement.invalidate(); utils.reTrialBalance.getBalanceSheet.invalidate(); },
    onError: (e) => { toast.error(ar ? "فشل حفظ التسوية: " + e.message : "Settlement save failed: " + e.message); },
  });

  const entryMap = useMemo(() => {
    const map: Record<number, any> = {};
    for (const e of entriesQ.data ?? []) map[e.accountId] = e;
    return map;
  }, [entriesQ.data]);

  useEffect(() => {
    if (entriesQ.data && Object.keys(draftEntries).length === 0) {
      const m: Record<number, any> = {};
      for (const e of entriesQ.data) {
        const od = toNum(e.openingDebit); const oc = toNum(e.openingCredit);
        m[e.accountId] = {
          openingAmount: od > 0 ? od : oc,
          openingType: od > 0 ? "debit" : oc > 0 ? "credit" : "debit",
          movementDebit: toNum(e.movementDebit),
          movementCredit: toNum(e.movementCredit),
          notes: e.notes ?? "",
        };
      }
      setDraftEntries(m); setUnsaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesQ.data]);

  useEffect(() => {
    if (taxQ.data) setTaxForm({ ...taxQ.data });
  }, [taxQ.data]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">{ar ? "ميزان المراجعة المبسط" : "Simplified Trial Balance"}</h2>
        <p className="text-gray-500">{ar ? "ليس لديك صلاحية الوصول. اطلب من المسؤول." : "You do not have permission to access this screen."}</p>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  if (view === "list") {
    const items = listQ.data?.items ?? [];
    const total = listQ.data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5" style={{ color: C.primary }} />
            <span className="font-semibold text-sm" style={{ color: C.primary }}>{ar ? "ميزان المراجعة المبسط" : "Simplified Trial Balance"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={ar ? "بحث..." : "Search..."} className="pl-7 pr-2 py-1 text-xs border rounded w-48" style={{ borderColor: C.border }} />
            </div>
            {canAdd && <Button size="sm" onClick={() => { setForm({ name: "", periodLabel: "", fromDate: "", toDate: "", projectId: null, scope: "org", notes: "" }); setEditId(null); setShowForm(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />{ar ? "جديد" : "New"}
            </Button>}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: C.header }}>
              <th className="px-2 py-1.5 text-center font-semibold border" style={{ borderColor: C.border }}>#</th>
              <th className="px-2 py-1.5 font-semibold border" style={{ borderColor: C.border }}>{ar ? "الاسم" : "Name"}</th>
              <th className="px-2 py-1.5 font-semibold border" style={{ borderColor: C.border }}>{ar ? "الفترة" : "Period"}</th>
              <th className="px-2 py-1.5 font-semibold border" style={{ borderColor: C.border }}>{ar ? "المدى" : "Scope"}</th>
              <th className="px-2 py-1.5 font-semibold border text-center" style={{ borderColor: C.border }}>{ar ? "الحالة" : "Status"}</th>
              <th className="px-2 py-1.5 font-semibold border text-center" style={{ borderColor: C.border }}>{ar ? "إدارة" : "Actions"}</th>
            </tr></thead>
            <tbody>
              {listQ.isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">{ar ? "جاري التحميل..." : "Loading..."}</td></tr>}
              {!listQ.isLoading && items.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">{ar ? "لا توجد بيانات" : "No records"}</td></tr>}
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 border text-center" style={{ borderColor: C.border }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{item.name}</td>
                  <td className="px-2 py-1.5 border text-gray-600" style={{ borderColor: C.border }}>{item.periodLabel ?? "—"}</td>
                  <td className="px-2 py-1.5 border text-gray-600" style={{ borderColor: C.border }}>{item.scope === "project" ? (ar ? "مشروع" : "Project") : (ar ? "مؤسسة" : "Organization")}</td>
                  <td className="px-2 py-1.5 border text-center" style={{ borderColor: C.border }}><StatusBadge status={item.status} /></td>
                  <td className="px-2 py-1.5 border text-center" style={{ borderColor: C.border }}>
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setSelTB(item.id); setView("detail"); setDraftEntries({}); setUnsaved(false); }}><Eye className="w-3.5 h-3.5" /></Button>
                      {canEdit && <Button size="sm" variant="ghost" onClick={() => { setEditId(item.id); setForm({ name: item.name, periodLabel: item.periodLabel ?? "", fromDate: item.fromDate ? new Date(item.fromDate).toISOString().slice(0, 10) : "", toDate: item.toDate ? new Date(item.toDate).toISOString().slice(0, 10) : "", projectId: item.projectId, scope: item.scope, notes: item.notes ?? "" }); setShowForm(true); }}><Pencil className="w-3.5 h-3.5" /></Button>}
                      {canDelete && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setShowDel(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 py-2 border-t" style={{ borderColor: C.border }}>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="w-3.5 h-3.5" /></Button>
            <span className="text-xs text-gray-500">{page} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><ArrowRight className="w-3.5 h-3.5" /></Button>
          </div>
        )}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">{editId ? (ar ? "تعديل ميزان" : "Edit Trial Balance") : (ar ? "ميزان مراجعة جديد" : "New Trial Balance")}</span>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">{ar ? "الاسم" : "Name"} *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
                <label className="text-xs font-medium text-gray-600">{ar ? "تسمية الفترة" : "Period Label"}</label>
                <input value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-medium text-gray-600">{ar ? "من" : "From"}</label><DateSegmentInput value={form.fromDate} onChange={v => setForm({ ...form, fromDate: v })} standalone className="w-full text-xs" style={{ borderColor: C.border, borderRadius: 4, padding: "4px 8px" }} /></div>
                  <div><label className="text-xs font-medium text-gray-600">{ar ? "إلى" : "To"}</label><DateSegmentInput value={form.toDate} onChange={v => setForm({ ...form, toDate: v })} standalone className="w-full text-xs" style={{ borderColor: C.border, borderRadius: 4, padding: "4px 8px" }} /></div>
                </div>
                <label className="text-xs font-medium text-gray-600">{ar ? "المدى" : "Scope"}</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}>
                  <option value="org">{ar ? "مؤسسة بالكامل" : "Full Organization"}</option>
                  <option value="project">{ar ? "مشروع" : "Project"}</option>
                </select>
                {form.scope === "project" && (
                  <><label className="text-xs font-medium text-gray-600">{ar ? "المشروع" : "Project"}</label>
                  <select value={form.projectId ?? ""} onChange={(e) => setForm({ ...form, projectId: e.target.value ? +e.target.value : null })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}>
                    <option value="">{ar ? "اختر مشروعاً" : "Select a project"}</option>
                    {(projectsQ.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></>
                )}
                <label className="text-xs font-medium text-gray-600">{ar ? "ملاحظات" : "Notes"}</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>{ar ? "إلغاء" : "Cancel"}</Button>
                <Button size="sm" onClick={() => {
                  if (!form.name.trim()) { toast.error(ar ? "الاسم مطلوب" : "Name is required"); return; }
                  if (editId) { updateTB.mutate({ id: editId, data: { ...form, fromDate: form.fromDate || undefined, toDate: form.toDate || undefined, projectId: form.projectId ?? undefined } }); }
                  else { createTB.mutate({ ...form, fromDate: form.fromDate || undefined, toDate: form.toDate || undefined, projectId: form.projectId ?? undefined }); }
                }}>{ar ? "حفظ" : "Save"}</Button>
              </div>
            </div>
          </div>
        )}
        {showDel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
              <div className="flex items-center gap-2 mb-3 text-red-600"><AlertTriangle className="w-5 h-5" /><span className="font-semibold text-sm">{ar ? "تأكيد الحذف" : "Confirm Delete"}</span></div>
              <p className="text-xs text-gray-600 mb-3">{ar ? "هل أنت متأكد من حذف هذا الميزان ؟ لا يمكن التراجع." : "Are you sure? This cannot be undone."}</p>
              <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setShowDel(null)}>{ar ? "إلغاء" : "Cancel"}</Button><Button size="sm" variant="destructive" onClick={() => deleteTB.mutate(showDel)}>{ar ? "حذف" : "Delete"}</Button></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (view === "detail") {
    const bs = bsQ.data;
    const tb = tbQ.data;

    const handleEntryChange = (accountId: number, field: string, val: string) => {
      const num = parseFloat(val.replace(/,/g, "")) || 0;
      setDraftEntries(prev => {
        const next = { ...prev, [accountId]: { ...prev[accountId], [field]: num } };
        const amount = toNum(next[accountId].openingAmount);
        const oType = next[accountId].openingType as "debit" | "credit";
        const od = oType === "debit" ? amount : 0;
        const oc = oType === "credit" ? amount : 0;
        const md = toNum(next[accountId].movementDebit);
        const mc = toNum(next[accountId].movementCredit);
        const net = od - oc + md - mc;
        next[accountId].endingDebit = net >= 0 ? +net.toFixed(2) : 0;
        next[accountId].endingCredit = net < 0 ? +(-net).toFixed(2) : 0;
        return next;
      });
      setUnsaved(true);
    };

    const handleSaveEntries = () => {
      if (!selTB) return;
      const payload = Object.entries(draftEntries).map(([aid, vals]) => {
        const amount = toNum(vals.openingAmount);
        const oType = vals.openingType as "debit" | "credit";
        return {
          accountId: +aid,
          openingDebit: oType === "debit" ? amount : 0,
          openingCredit: oType === "credit" ? amount : 0,
          movementDebit: toNum(vals.movementDebit),
          movementCredit: toNum(vals.movementCredit),
          notes: vals.notes ?? "",
        };
      });
      saveEntries.mutate({ trialBalanceId: selTB, entries: payload });
    };

    const total = bs?.totals ?? { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, endingDebit: 0, endingCredit: 0 };
    const diff = +(total.endingDebit - total.endingCredit).toFixed(2);
    const toggleExpand = (id: number) => {
      setExpandedParents(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };
    const visibleRows = bs?.rows?.filter((r: any) => { const a = r.account; if (!a.parentId) return true; return expandedParents.has(a.parentId); }) ?? [];

    return (
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { setView("list"); setSelTB(null); setDraftEntries({}); setUnsaved(false); }}>
              <BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "القائمة" : "Back"}
            </Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{tb?.name}</span>
            <span className="text-xs text-gray-400">{tb?.periodLabel}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {unsaved && <span className="text-xs text-amber-600 font-medium px-2 py-0.5 rounded bg-amber-50 border border-amber-200">{ar ? "تغييرات غير محفوظة" : "Unsaved changes"}</span>}
            <Button size="sm" variant="outline" onClick={handleSaveEntries} disabled={!unsaved || saveEntries.isPending}><Save className="w-3.5 h-3.5 mr-1" />{ar ? "حفظ" : "Save"}</Button>
            <Button size="sm" variant="outline" className="text-indigo-700 hover:bg-indigo-50 border-indigo-200" onClick={() => setView("detail")}><Eye className="w-3.5 h-3.5 mr-1" />{ar ? "مطالعة" : "Browse"}</Button>
            <Button size="sm" variant="outline" onClick={() => setView("taxReturn")}><Receipt className="w-3.5 h-3.5 mr-1" />{ar ? "الضريبة" : "Tax"}</Button>
            <Button size="sm" variant="outline" onClick={() => setView("review")}><ClipboardCheck className="w-3.5 h-3.5 mr-1" />{ar ? "المراجعة" : "Review"}</Button>
            <Button size="sm" variant="outline" onClick={() => setView("accountTree")}><FolderTree className="w-3.5 h-3.5 mr-1" />{ar ? "الدليل" : "Accounts"}</Button>
            <Button size="sm" variant="outline" onClick={() => setView("auditLog")}><History className="w-3.5 h-3.5 mr-1" />{ar ? "السجل" : "Log"}</Button>
            <Button size="sm" variant="outline" onClick={() => setView("settlement")}><Settings2 className="w-3.5 h-3.5 mr-1" />{ar ? "التسوية" : "Settlement"}</Button>
            {canChart && <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { if (confirm(ar ? "إعادة الدليل الافتراضي ؟ سيمحى جميع البيانات." : "Reset to default accounts? All data will be cleared.")) resetDefaults.mutate(selTB!); }}><RotateCcw className="w-3.5 h-3.5 mr-1" />{ar ? "إعادة" : "Reset"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1" />{ar ? "طباعة" : "Print"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={() => window.open(`/api/trpc/reTrialBalance.exportTrialBalance?input=${encodeURIComponent(JSON.stringify({ trialBalanceId: selTB, format: "json" }))}`, "_blank")}><FileSpreadsheet className="w-3.5 h-3.5 mr-1" />{ar ? "Excel" : "Excel"}</Button>}
            {canExport && <Button size="sm" variant="outline" onClick={() => window.open(`/api/trpc/reTrialBalance.exportTrialBalance?input=${encodeURIComponent(JSON.stringify({ trialBalanceId: selTB, format: "csv" }))}`, "_blank")}><Download className="w-3.5 h-3.5 mr-1" />{ar ? "CSV" : "CSV"}</Button>}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-gray-50" style={{ borderColor: C.border }}>
          <span className="text-xs font-medium text-gray-500">{ar ? "الحالة:" : "Status:"}</span>
          {Math.abs(diff) < 0.01 && total.endingDebit === 0 && total.endingCredit === 0 ? (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{ar ? "لم يتم إدخال بيانات بعد" : "No data entered yet"}</span>
          ) : Math.abs(diff) < 0.01 ? (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{ar ? "الميزان متوازن ✓" : "Balanced ✓"}</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">{ar ? `الميزان غير متوازن — الجانب ${diff > 0 ? "الدائن" : "الدائن"} يحتاج إلى ${fmt2(Math.abs(diff))}` : `Unbalanced — needs ${fmt2(Math.abs(diff))}`}</span>
          )}
          <span className="text-xs text-gray-400">{ar ? `دائن: ${fmt2(total.endingDebit)}   ج. ${fmt2(total.endingCredit)}` : `Dr: ${fmt2(total.endingDebit)}   Cr: ${fmt2(total.endingCredit)}`}</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-2">
          {bsQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">{ar ? "جاري التحميل..." : "Loading..."}</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: C.header }}>
                  <th className="px-2 py-1.5 border font-semibold text-center sticky left-0" style={{ borderColor: C.border, width: 40, background: C.header }}>#</th>
                  <th className="px-2 py-1.5 border font-semibold text-left sticky left-[40px]" style={{ borderColor: C.border, minWidth: 160, background: C.header }}>{ar ? "كود الحساب" : "Code"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-left sticky left-[200px]" style={{ borderColor: C.border, minWidth: 200, background: C.header }}>{ar ? "اسم الحساب" : "Account"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, width: 90 }}>{ar ? "الطبيعة" : "Nature"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 130 }} title={ar ? "المبلغ الموجود في الحساب في بداية الفترة" : "Opening balance"}>{ar ? "رصيد أول المدة" : "Opening"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, width: 90 }}>{ar ? "نوع الرصيد" : "Type"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 130 }} title={ar ? "المبالغ المسجلة في الجانب المدين خلال الفترة" : "Debit movement"}>{ar ? "حركة الفترة المدينة" : "Movement Dr."}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 130 }} title={ar ? "المبالغ المسجلة في الجانب الدائن خلال الفترة" : "Credit movement"}>{ar ? "حركة الفترة الدائنة" : "Movement Cr."}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 130 }} title={ar ? "يحسبه البرنامج تلقائياً" : "Auto-calculated"}>{ar ? "رصيد آخر المدة مدين" : "Ending Dr."}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 130 }} title={ar ? "يحسبه البرنامج تلقائياً" : "Auto-calculated"}>{ar ? "رصيد آخر المدة دائن" : "Ending Cr."}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, width: 60 }}>{ar ? "المراجعة" : "Review"}</th>
                  <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border, minWidth: 80 }}>{ar ? "ملاحظات" : "Notes"}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r: any, idx: number) => {
                  const a = r.account;
                  const e = r.entry;
                  const isParent = r.isParent;
                  const draft = draftEntries[a.id];
                  const oa = draft ? toNum(draft.openingAmount) : (toNum(e?.openingDebit) || toNum(e?.openingCredit));
                  const oType = draft ? (draft.openingType as "debit" | "credit") : (toNum(e?.openingDebit) > 0 ? "debit" : toNum(e?.openingCredit) > 0 ? "credit" : "debit");
                  const md = draft ? toNum(draft.movementDebit) : toNum(e?.movementDebit);
                  const mc = draft ? toNum(draft.movementCredit) : toNum(e?.movementCredit);
                  const endD = draft ? toNum(draft.endingDebit) : toNum(e?.endingDebit);
                  const endC = draft ? toNum(draft.endingCredit) : toNum(e?.endingCredit);
                  const review = a.reviewStatus;
                  const bg = isParent ? "#f3f4f6" : "white";
                  return (
                    <tr key={a.id} className={isParent ? "bg-gray-100 font-semibold" : "bg-white hover:bg-blue-50/50"}>
                      <td className="px-2 py-1 border text-center text-gray-400 sticky left-0" style={{ borderColor: C.border, background: bg }}>{idx + 1}</td>
                      <td className="px-2 py-1 border sticky left-[40px]" style={{ borderColor: C.border, background: bg, minWidth: 160 }}>
                        <div className="flex items-center gap-1">
                          {isParent && <button onClick={() => toggleExpand(a.id)} className="text-gray-500 hover:text-gray-700">{expandedParents.has(a.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>}
                          <span className={isParent ? "font-bold text-gray-800" : "text-gray-600 text-xs"}>{a.code}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1 border sticky left-[200px]" style={{ borderColor: C.border, background: bg, minWidth: 200 }}>
                        <div className={isParent ? "font-bold text-gray-900" : "font-medium text-gray-700 text-xs"}>{a.name}</div>
                      </td>
                      <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${a.nature === "debit" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>{a.nature === "debit" ? (ar ? "دائن" : "Debit") : (ar ? "دائن" : "Credit")}</span>
                      </td>
                      <td className="px-1 py-1 border text-center" style={{ borderColor: C.border }}>
                        {isParent ? <span className="text-gray-400">—</span> : (
                          <input type="text" inputMode="decimal" value={draft ? draft.openingAmount : (oa || "")}
                            onChange={(ev) => handleEntryChange(a.id, "openingAmount", ev.target.value)}
                            onBlur={(ev) => { const n = parseFloat(ev.target.value) || 0; if (ev.target.value !== n.toFixed(2)) handleEntryChange(a.id, "openingAmount", String(n)); }}
                            className="w-28 text-xs text-center border rounded py-0.5 px-1" style={{ borderColor: C.border, direction: "ltr" }} dir="ltr" />
                        )}
                      </td>
                      <td className="px-1 py-1 border text-center" style={{ borderColor: C.border }}>
                        {isParent ? <span className="text-gray-400">—</span> : (
                          <select value={draft ? draft.openingType : oType} onChange={(ev) => handleEntryChange(a.id, "openingType", ev.target.value)}
                            className="w-20 text-xs text-center border rounded py-0.5 px-1" style={{ borderColor: C.border }}>
                            <option value="debit">{ar ? "دائن" : "Debit"}</option>
                            <option value="credit">{ar ? "دائن" : "Credit"}</option>
                          </select>
                        )}
                      </td>
                      <td className="px-1 py-1 border text-center" style={{ borderColor: C.border }}>
                        {isParent ? <span className="text-gray-400">—</span> : (
                          <input type="text" inputMode="decimal" value={draft ? draft.movementDebit : (toNum(e?.movementDebit) || "")}
                            onChange={(ev) => handleEntryChange(a.id, "movementDebit", ev.target.value)}
                            onBlur={(ev) => { const n = parseFloat(ev.target.value) || 0; if (ev.target.value !== n.toFixed(2)) handleEntryChange(a.id, "movementDebit", String(n)); }}
                            className="w-28 text-xs text-center border rounded py-0.5 px-1" style={{ borderColor: C.border, direction: "ltr" }} dir="ltr" />
                        )}
                      </td>
                      <td className="px-1 py-1 border text-center" style={{ borderColor: C.border }}>
                        {isParent ? <span className="text-gray-400">—</span> : (
                          <input type="text" inputMode="decimal" value={draft ? draft.movementCredit : (toNum(e?.movementCredit) || "")}
                            onChange={(ev) => handleEntryChange(a.id, "movementCredit", ev.target.value)}
                            onBlur={(ev) => { const n = parseFloat(ev.target.value) || 0; if (ev.target.value !== n.toFixed(2)) handleEntryChange(a.id, "movementCredit", String(n)); }}
                            className="w-28 text-xs text-center border rounded py-0.5 px-1" style={{ borderColor: C.border, direction: "ltr" }} dir="ltr" />
                        )}
                      </td>
                      <td className="px-2 py-1 border text-center font-semibold" style={{ borderColor: C.border, color: endD > 0 ? C.primary : C.gray }}>{fmt2(endD)}</td>
                      <td className="px-2 py-1 border text-center font-semibold" style={{ borderColor: C.border, color: endC > 0 ? C.danger : C.gray }}>{fmt2(endC)}</td>
                      <td className="px-1 py-1 border text-center" style={{ borderColor: C.border }}>
                        <div className={`inline-block w-2 h-2 rounded-full ${REVIEW_LABELS[review]?.color.split(" ")[0] ?? "bg-gray-200"}`} title={REVIEW_LABELS[review]?.[lang] ?? review} />
                      </td>
                      <td className="px-1 py-1 border" style={{ borderColor: C.border }}>
                        {isParent ? null : (
                          <input type="text" value={draft ? (draft.notes ?? "") : (e?.notes ?? "")}
                            onChange={(ev) => { setDraftEntries(prev => ({ ...prev, [a.id]: { ...prev[a.id], notes: ev.target.value } })); setUnsaved(true); }}
                            placeholder={ar ? "ملاحظة" : "Note"} className="w-full text-xs border rounded py-0.5 px-1" style={{ borderColor: C.border }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && <tr><td colSpan={12} className="text-center py-8 text-gray-400">{ar ? "لا توجد بيانات" : "No records"}</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals footer */}
        <div className="border-t bg-gray-50 px-3 py-2 text-xs" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-gray-600">{ar ? "الإجماليات:" : "Totals:"}</span>
            <span className="text-gray-500">{ar ? "رصيد أول المدة مدين" : "Open Dr."}: <strong className="text-gray-800">{fmt2(total.openingDebit)}</strong></span>
            <span className="text-gray-500">{ar ? "رصيد أول المدة دائن" : "Open Cr."}: <strong className="text-gray-800">{fmt2(total.openingCredit)}</strong></span>
            <span className="text-gray-500">{ar ? "حركة الفترة المدينة" : "Mov. Dr."}: <strong className="text-gray-800">{fmt2(total.movementDebit)}</strong></span>
            <span className="text-gray-500">{ar ? "حركة الفترة الدائنة" : "Mov. Cr."}: <strong className="text-gray-800">{fmt2(total.movementCredit)}</strong></span>
            <span className="text-gray-500">{ar ? "رصيد آخر المدة مدين" : "End Dr."}: <strong className="text-gray-800">{fmt2(total.endingDebit)}</strong></span>
            <span className="text-gray-500">{ar ? "رصيد آخر المدة دائن" : "End Cr."}: <strong className="text-gray-800">{fmt2(total.endingCredit)}</strong></span>
            <span className={`font-bold ${Math.abs(diff) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>{ar ? "فرق الميزان" : "Difference"}: {fmt2(Math.abs(diff))}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── ACCOUNT TREE VIEW ────────────────────────────────────────────────────────
  if (view === "accountTree") {
    const accounts = acctsQ.data ?? [];
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("detail")}><BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "رجوع" : "Back"}</Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{ar ? "شجرة الحسابات" : "Account Tree"}</span>
          </div>
          {canChart && <Button size="sm" onClick={() => { setAcctForm({ code: "", name: "", category: "assets", nature: "debit", sortOrder: (accounts.length + 1) * 10, parentId: null }); setAcctEditId(null); setShowAcctForm(true); }}><Plus className="w-3.5 h-3.5 mr-1" />{ar ? "حساب" : "Account"}</Button>}
        </div>
        <div className="flex-1 overflow-auto p-2">
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: C.header }}>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>#</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الكود" : "Code"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الاسم" : "Name"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "التصنيف" : "Category"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الطبيعة" : "Nature"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "نظامي" : "Sys"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "إدارة" : "Actions"}</th>
            </tr></thead>
            <tbody>
              {accounts.map((a, idx) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 border text-center text-gray-400" style={{ borderColor: C.border }}>{idx + 1}</td>
                  <td className="px-2 py-1 border font-medium" style={{ borderColor: C.border }}>{a.code}</td>
                  <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{a.name}</td>
                  <td className="px-2 py-1 border text-gray-500" style={{ borderColor: C.border }}>{CAT_LABELS[a.category]?.[lang] ?? a.category}</td>
                  <td className="px-2 py-1 border text-gray-500" style={{ borderColor: C.border }}>{a.nature === "debit" ? (ar ? "دائن" : "Debit") : (ar ? "دائن" : "Credit")}</td>
                  <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>{a.isSystem ? <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-500" /> : "—"}</td>
                  <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>
                    {canChart && (
                      <div className="flex items-center justify-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setAcctEditId(a.id); setAcctForm({ code: a.code, name: a.name, category: a.category as AccountCategory, nature: a.nature as "debit" | "credit", sortOrder: a.sortOrder, parentId: a.parentId }); setShowAcctForm(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                        {!a.isSystem && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm(ar ? "تأكيد الحذف؟" : "Confirm delete?")) deleteAcct.mutate(a.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showAcctForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">{acctEditId ? (ar ? "تعديل حساب" : "Edit Account") : (ar ? "حساب جديد" : "New Account")}</span>
                <Button size="sm" variant="ghost" onClick={() => { setShowAcctForm(false); setAcctEditId(null); }}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">{ar ? "الكود" : "Code"} *</label>
                <input value={acctForm.code} onChange={(e) => setAcctForm({ ...acctForm, code: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
                <label className="text-xs font-medium text-gray-600">{ar ? "الاسم" : "Name"} *</label>
                <input value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-medium text-gray-600">{ar ? "التصنيف" : "Category"}</label>
                    <select value={acctForm.category} onChange={(e) => setAcctForm({ ...acctForm, category: e.target.value as AccountCategory })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}>{Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}</select></div>
                  <div><label className="text-xs font-medium text-gray-600">{ar ? "الطبيعة" : "Nature"}</label>
                    <select value={acctForm.nature} onChange={(e) => setAcctForm({ ...acctForm, nature: e.target.value as "debit" | "credit" })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}><option value="debit">{ar ? "دائن" : "Debit"}</option><option value="credit">{ar ? "دائن" : "Credit"}</option></select></div>
                </div>
                <label className="text-xs font-medium text-gray-600">{ar ? "ترتيب" : "Sort Order"}</label>
                <input type="number" value={acctForm.sortOrder} onChange={(e) => setAcctForm({ ...acctForm, sortOrder: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setShowAcctForm(false); setAcctEditId(null); }}>{ar ? "إلغاء" : "Cancel"}</Button>
                <Button size="sm" onClick={() => {
                  if (!acctForm.code.trim() || !acctForm.name.trim()) { toast.error(ar ? "الكود والاسم مطلوبان" : "Code and name required"); return; }
                  if (acctEditId) { updateAcct.mutate({ id: acctEditId, data: acctForm }); }
                  else { createAcct.mutate({ trialBalanceId: selTB!, data: acctForm }); }
                }}>{ar ? "حفظ" : "Save"}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── TAX RETURN VIEW ──────────────────────────────────────────────────────────
  if (view === "taxReturn") {
    const tax = taxForm;
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("detail")}><BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "رجوع" : "Back"}</Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{ar ? "الإعلام الضريبي" : "Tax Return"}</span>
          </div>
          {canEdit && <Button size="sm" onClick={() => saveTax.mutate({ trialBalanceId: selTB!, data: { ...tax, purchasesPreTax: toNum(tax.purchasesPreTax), purchaseReturns: toNum(tax.purchaseReturns), netPurchases: toNum(tax.netPurchases), deductibleTax: toNum(tax.deductibleTax), openingTaxBalance: toNum(tax.openingTaxBalance), actualRefund: toNum(tax.actualRefund), actualOffset: toNum(tax.actualOffset) } })}><Save className="w-3.5 h-3.5 mr-1" />{ar ? "حفظ" : "Save"}</Button>}
        </div>
        <div className="flex-1 overflow-auto p-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-gray-600">{ar ? "الفترة" : "Period"}</label><input value={tax.periodLabel ?? ""} onChange={(e) => setTaxForm({ ...tax, periodLabel: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "الحالة" : "Refund Status"}</label><select value={tax.refundStatus ?? "not_submitted"} onChange={(e) => setTaxForm({ ...tax, refundStatus: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}><option value="not_submitted">{ar ? "لم يتم التقديم" : "Not submitted"}</option><option value="under_review">{ar ? "قيد المراجعة" : "Under review"}</option><option value="approved">{ar ? "معتمد" : "Approved"}</option><option value="refunded">{ar ? "مسدد" : "Refunded"}</option><option value="offset">{ar ? "متصل" : "Offset"}</option></select></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "قيمة المشتريات (بدون ضريبة)" : "Purchases Pre-Tax"}</label><input type="number" step="0.01" value={tax.purchasesPreTax ?? 0} onChange={(e) => setTaxForm({ ...tax, purchasesPreTax: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "مردودات المشتريات" : "Purchase Returns"}</label><input type="number" step="0.01" value={tax.purchaseReturns ?? 0} onChange={(e) => setTaxForm({ ...tax, purchaseReturns: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "المشتريات الصافية" : "Net Purchases"}</label><input type="number" step="0.01" value={tax.netPurchases ?? 0} onChange={(e) => setTaxForm({ ...tax, netPurchases: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "الضريبة المستحقة" : "Deductible Tax"}</label><input type="number" step="0.01" value={tax.deductibleTax ?? 0} onChange={(e) => setTaxForm({ ...tax, deductibleTax: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "رصيد ضريبة افتتاحي" : "Opening Tax Balance"}</label><input type="number" step="0.01" value={tax.openingTaxBalance ?? 0} onChange={(e) => setTaxForm({ ...tax, openingTaxBalance: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "المسدد الفعلي" : "Actual Refund"}</label><input type="number" step="0.01" value={tax.actualRefund ?? 0} onChange={(e) => setTaxForm({ ...tax, actualRefund: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
            <div><label className="text-xs font-medium text-gray-600">{ar ? "المتصل الفعلي" : "Actual Offset"}</label><input type="number" step="0.01" value={tax.actualOffset ?? 0} onChange={(e) => setTaxForm({ ...tax, actualOffset: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
          </div>
          <div className="mt-3"><label className="text-xs font-medium text-gray-600">{ar ? "ملاحظات" : "Notes"}</label><textarea rows={3} value={tax.notes ?? ""} onChange={(e) => setTaxForm({ ...tax, notes: e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
          <div className="mt-4 p-3 rounded border bg-gray-50" style={{ borderColor: C.border }}>
            <div className="text-xs font-semibold mb-2">{ar ? "الملخص" : "Summary"}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>{ar ? "الضريبة المستحقة:" : "Deductible Tax:"} <span className="font-semibold">{fmt2(tax.deductibleTax)}</span></div>
              <div>{ar ? "الرصيد الافتتاحي:" : "Opening Balance:"} <span className="font-semibold">{fmt2(tax.openingTaxBalance)}</span></div>
              <div>{ar ? "المسدد الفعلي:" : "Actual Refund:"} <span className="font-semibold">{fmt2(tax.actualRefund)}</span></div>
              <div>{ar ? "المتصل الفعلي:" : "Actual Offset:"} <span className="font-semibold">{fmt2(tax.actualOffset)}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW PANEL VIEW ────────────────────────────────────────────────────────
  if (view === "review") {
    const items = reviewQ.data ?? [];
    const allReviewed = items.length > 0 && items.every(i => i.reviewStatus === "reviewed" || !i.hasActivity);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("detail")}><BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "رجوع" : "Back"}</Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{ar ? "لوحة مراجعة الحسابات" : "Account Review Panel"}</span>
          </div>
          <div className="flex items-center gap-2">
            {allReviewed && <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{ar ? "جميع الحسابات مراجعة ✓" : "All accounts reviewed ✓"}</span>}
            {canReview && <Button size="sm" onClick={() => { const payload = items.map(i => ({ accountId: i.account.id, reviewStatus: i.reviewStatus as ReviewStatus })); saveReview.mutate({ trialBalanceId: selTB!, reviews: payload }); }}><Save className="w-3.5 h-3.5 mr-1" />{ar ? "حفظ الحالة" : "Save"}</Button>}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: C.header }}>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>#</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الحساب" : "Account"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "الرصيد" : "Balance"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "نشاط" : "Active"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "المراجعة" : "Review"}</th>
              {canReview && <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "تعيين" : "Set"}</th>}
            </tr></thead>
            <tbody>
              {items.map((item, idx) => {
                const a = item.account;
                const label = REVIEW_LABELS[item.reviewStatus] ?? REVIEW_LABELS.not_reviewed;
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1 border text-center text-gray-400" style={{ borderColor: C.border }}>{idx + 1}</td>
                    <td className="px-2 py-1 border" style={{ borderColor: C.border }}><div className="font-medium">{a.code} · {a.name}</div><div className="text-[10px] text-gray-400">{CAT_LABELS[a.category]?.[lang] ?? a.category}</div></td>
                    <td className="px-2 py-1 border text-center font-semibold" style={{ borderColor: C.border }}>{item.balanceText}</td>
                    <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>{item.hasActivity ? <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-500" /> : "—"}</td>
                    <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}><span className={`inline-block px-2 py-0.5 rounded text-[10px] ${label.color}`}>{label[lang]}</span></td>
                    {canReview && (
                      <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>
                        <select value={item.reviewStatus} onChange={(e) => { toast.info(ar ? `تم تعديل المراجعة لـ ${a.name}. اضغط حفظ.` : `Review changed for ${a.name}. Click Save.`); }} className="text-xs border rounded py-0.5 px-1" style={{ borderColor: C.border }}>
                          <option value="not_reviewed">{REVIEW_LABELS.not_reviewed[lang]}</option>
                          <option value="reviewed">{REVIEW_LABELS.reviewed[lang]}</option>
                          <option value="has_diff">{REVIEW_LABELS.has_diff[lang]}</option>
                          <option value="needs_doc">{REVIEW_LABELS.needs_doc[lang]}</option>
                        </select>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-center py-8 text-gray-400">{ar ? "لا توجد بيانات" : "No records"}</div>}
        </div>
      </div>
    );
  }

  // ── SETTLEMENT VIEW ──────────────────────────────────────────────────────────
  if (view === "settlement") {
    const settlements = settleQ.data ?? [];
    const bs = bsQ.data;
    const diff = bs?.difference ?? 0;
    const reviewItems = reviewQ.data ?? [];
    const allReviewed = reviewItems.length > 0 && reviewItems.every(i => i.reviewStatus === "reviewed" || !i.hasActivity);
    const ownerAccounts = acctsQ.data?.filter(a => a.code.startsWith("3.2") || a.code.startsWith("3.3")) ?? [];
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("detail")}><BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "رجوع" : "Back"}</Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{ar ? "تسوية الفارق" : "Difference Settlement"}</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="p-3 rounded border mb-4" style={{ borderColor: C.border, background: Math.abs(diff) < 0.01 ? "#f0fdf4" : "#fef2f2" }}>
            <div className="text-xs font-semibold mb-1">{ar ? "فارق الميزان" : "Trial Balance Difference"}</div>
            {Math.abs(diff) < 0.01 ? <div className="text-sm text-emerald-700 font-bold">{ar ? "الميزان متزان ✓" : "Balanced ✓"}</div> : <div className="text-sm text-red-700 font-bold">{ar ? `فارق: ${fmt2(Math.abs(diff))}` : `Difference: ${fmt2(Math.abs(diff))}`}</div>}
          </div>
          {Math.abs(diff) >= 0.01 && (
            <>
              {!allReviewed && <div className="mb-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700"><AlertTriangle className="w-4 h-4 inline mr-1" />{ar ? "يجب مراجعة جميع الحسابات قبل التسوية" : "All accounts must be reviewed before settlement"}</div>}
              {canSettle && allReviewed && (
                <div className="mb-4 p-3 rounded border bg-gray-50" style={{ borderColor: C.border }}>
                  <div className="text-xs font-semibold mb-2">{ar ? "تسوية جديدة" : "New Settlement"}</div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div><label className="text-xs text-gray-500">{ar ? "الحساب" : "Account"}</label><select value={settleForm.accountId ?? ""} onChange={(e) => setSettleForm({ ...settleForm, accountId: e.target.value ? +e.target.value : null })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}><option value="">{ar ? "اختر..." : "Select..."}</option>{ownerAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div>
                    <div><label className="text-xs text-gray-500">{ar ? "الفارق" : "Difference"}</label><input type="number" step="0.01" value={settleForm.difference} onChange={(e) => setSettleForm({ ...settleForm, difference: +e.target.value })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }} /></div>
                    <div><label className="text-xs text-gray-500">{ar ? "الاتجاه" : "Direction"}</label><select value={settleForm.direction} onChange={(e) => setSettleForm({ ...settleForm, direction: e.target.value as "debit" | "credit" })} className="w-full text-xs border rounded px-2 py-1" style={{ borderColor: C.border }}><option value="debit">{ar ? "دائن" : "Debit"}</option><option value="credit">{ar ? "دائن" : "Credit"}</option></select></div>
                  </div>
                  <Button size="sm" onClick={() => { if (!settleForm.accountId) { toast.error(ar ? "اختر حساب" : "Select account"); return; } saveSettle.mutate({ trialBalanceId: selTB!, data: { ...settleForm, accountId: settleForm.accountId, prevBalanceDebit: 0, prevBalanceCredit: 0, newBalanceDebit: settleForm.direction === "debit" ? settleForm.difference : 0, newBalanceCredit: settleForm.direction === "credit" ? settleForm.difference : 0, userConfirmed: true } }); }}>{ar ? "تسوية" : "Settle"}</Button>
                </div>
              )}
            </>
          )}
          <div className="text-xs font-semibold mb-2">{ar ? "تسويات سابقة" : "Past Settlements"}</div>
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: C.header }}>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>#</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الحساب" : "Account"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "الفارق" : "Diff"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "الاتجاه" : "Dir"}</th>
              <th className="px-2 py-1.5 border font-semibold text-center" style={{ borderColor: C.border }}>{ar ? "التأكيد" : "Confirmed"}</th>
            </tr></thead>
            <tbody>
              {settlements.map((s, idx) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>{idx + 1}</td>
                  <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{(() => { const a = acctsQ.data?.find((x: any) => x.id === s.accountId); return a ? `${a.code} · ${a.name}` : `#${s.accountId}`; })()}</td>
                  <td className="px-2 py-1 border text-center font-semibold" style={{ borderColor: C.border }}>{fmt2(s.difference)}</td>
                  <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>{s.direction === "debit" ? (ar ? "د." : "Dr") : (ar ? "ج." : "Cr")}</td>
                  <td className="px-2 py-1 border text-center" style={{ borderColor: C.border }}>{s.userConfirmed ? <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-500" /> : <Ban className="w-3.5 h-3.5 inline text-gray-400" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {settlements.length === 0 && <div className="text-center py-4 text-gray-400 text-xs">{ar ? "لا توجد تسويات" : "No settlements"}</div>}
        </div>
      </div>
    );
  }

  // ── AUDIT LOG VIEW ───────────────────────────────────────────────────────────
  if (view === "auditLog") {
    const logs = auditQ.data ?? [];
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView("detail")}><BackIcon className="w-3.5 h-3.5 mr-1" />{ar ? "رجوع" : "Back"}</Button>
            <span className="text-sm font-semibold" style={{ color: C.primary }}>{ar ? "سجل التغييرات" : "Change Log"}</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: C.header }}>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>#</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "التاريخ" : "Date"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "المستخدم" : "User"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الإجراء" : "Action"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الحساب" : "Account"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "القديم" : "Old"}</th>
              <th className="px-2 py-1.5 border font-semibold" style={{ borderColor: C.border }}>{ar ? "الجديد" : "New"}</th>
            </tr></thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1 border text-center text-gray-400" style={{ borderColor: C.border }}>{idx + 1}</td>
                  <td className="px-2 py-1 border text-gray-500" style={{ borderColor: C.border }}>{new Date(log.createdAt).toLocaleString(ar ? "ar-SA" : "en-US", { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" })}</td>
                  <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{log.userName ?? `مستخدم #${log.userId}`}</td>
                  <td className="px-2 py-1 border" style={{ borderColor: C.border }}><span className={`inline-block px-2 py-0.5 rounded text-[10px] ${log.action === "create" ? "bg-emerald-100 text-emerald-700" : log.action === "delete" ? "bg-red-100 text-red-700" : log.action === "settlement" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{log.action}</span></td>
                  <td className="px-2 py-1 border text-gray-500" style={{ borderColor: C.border }}>{log.accountId ? `#${log.accountId}` : "—"}</td>
                  <td className="px-2 py-1 border text-gray-400 max-w-[120px] truncate" style={{ borderColor: C.border }}>{log.oldValue ?? "—"}</td>
                  <td className="px-2 py-1 border text-gray-800 max-w-[120px] truncate" style={{ borderColor: C.border }}>{log.newValue ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="text-center py-8 text-gray-400">{ar ? "لا توجد سجلات" : "No log entries"}</div>}
        </div>
      </div>
    );
  }

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { ar: string; en: string; cls: string }> = {
    draft:      { ar: "مسودد", en: "Draft", cls: "bg-gray-100 text-gray-600" },
    balanced:   { ar: "متزان", en: "Balanced", cls: "bg-emerald-100 text-emerald-700" },
    unbalanced: { ar: "غير متزان", en: "Unbalanced", cls: "bg-red-100 text-red-700" },
    reviewed:   { ar: "مراجع", en: "Reviewed", cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] ?? map.draft;
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${s.cls}`}>{s.ar}</span>;
}
