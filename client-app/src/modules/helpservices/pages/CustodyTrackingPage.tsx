import { useState, useCallback } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, AlertTriangle, ArrowRight,
  Loader2, RefreshCw, ExternalLink, Mail, FileText, Pencil,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/core/ui/alert-dialog";

function fmt(n: number) {
  if (!n) return "—";
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function fmtDiff(n: number) {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export default function CustodyTrackingPage() {
  const { openTab } = useTabManager();
  const [search, setSearch]     = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [sending, setSending]   = useState<number | null>(null);
  // ── مربع تأكيد الحذف ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRecord, setConfirmRecord] = useState<{ id: number; name: string } | null>(null);

  const listQ = trpc.custodyTracking.listRecords.useQuery(
    { search: search || undefined },
    { refetchOnWindowFocus: false }
  );
  const deleteM    = trpc.custodyTracking.deleteRecord.useMutation({
    onSuccess: () => listQ.refetch(),
  });
  const sendEmailM = trpc.custodyTracking.sendEmail.useMutation();

  const handleOpen = useCallback((id: number, name: string) => {
    openTab(`/hs/custody-record/${id}`, `عهدة: ${name}`, FileText);
  }, [openTab]);

  const handleAdd = useCallback(() => {
    openTab("/hs/custody-record/new", "متابعة عهدة جديدة", Plus);
  }, [openTab]);

  // ── فتح مربع تأكيد الحذف ──
  const askDelete = useCallback((id: number, name: string) => {
    setConfirmRecord({ id, name });
    setConfirmOpen(true);
  }, []);

  // ── تنفيذ الحذف بعد التأكيد ──
  const confirmDelete = useCallback(async () => {
    if (!confirmRecord) return;
    const { id, name } = confirmRecord;
    setConfirmOpen(false);
    setDeleting(id);
    try {
      await deleteM.mutateAsync({ id });
      toast.success(`تم حذف "${name}" وجميع حركاتها`);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحذف");
    } finally {
      setDeleting(null);
      setConfirmRecord(null);
    }
  }, [confirmRecord, deleteM]);

  const handleSendEmail = useCallback(async (id: number) => {
    setSending(id);
    try {
      const result = await sendEmailM.mutateAsync({ custodyId: id });
      if (result.status === "sent") {
        toast.success("تم إرسال الكشف بنجاح");
      } else if (result.status === "not_configured") {
        toast.warning("خدمة البريد غير مهيأة — راجع إعدادات الإرسال");
      } else {
        toast.error(`فشل الإرسال: ${result.errorMsg ?? ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إرسال الكشف");
    } finally {
      setSending(null);
    }
  }, [sendEmailM]);

  const records = (listQ.data ?? []) as any[];

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" dir="rtl">

      {/* ── شريط التنبيه ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-tight">
          شاشة متابعة داخلية مستقلة — لا تؤثر على الحسابات أو الصندوق أو المخزون أو أي عملية داخل OneSoft.
        </p>
      </div>

      {/* ── شريط الأدوات ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => openTab("/help-services-module", "المساعدة والخدمات")}
        >
          <ArrowRight className="w-4 h-4" />
          <span className="text-xs">المساعدة والخدمات</span>
        </button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-sm font-bold text-foreground">متابعة العهد</h1>

        <div className="flex-1" />

        <div className="relative w-52">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الرقم أو البريد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pr-8 text-right"
          />
        </div>

        <Button
          size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
          onClick={() => listQ.refetch()} disabled={listQ.isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${listQ.isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>

        <Button
          size="sm" className="h-8 gap-1.5 text-xs bg-[#1B2B5C] hover:bg-[#1B2B5C]/90"
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة متابعة عهدة جديدة
        </Button>
      </div>

      {/* ── الجدول الرئيسي ── */}
      <div className="flex-1 overflow-auto">
        {listQ.isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            جارٍ التحميل...
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-muted-foreground">
            <FileText className="w-12 h-12 opacity-20" />
            <p className="text-sm">لا توجد متابعات عهد حتى الآن</p>
            <Button size="sm" onClick={handleAdd} className="gap-1.5">
              <Plus className="w-4 h-4" />
              إضافة أول متابعة عهدة
            </Button>
          </div>
        ) : (
          <table className="w-full border-collapse text-[12px]" style={{ minWidth: 920 }}>
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-center w-10 whitespace-nowrap">رقم</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 whitespace-nowrap min-w-[180px]">اسم العهدة</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 whitespace-nowrap min-w-[160px]">البريد الإلكتروني</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-left whitespace-nowrap">إجمالي المحصل</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-left whitespace-nowrap">إجمالي المسدد</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-left whitespace-nowrap">الفرق</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-center whitespace-nowrap">الحركات</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-center whitespace-nowrap">الإرسال</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 whitespace-nowrap">تاريخ الإنشاء</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 whitespace-nowrap">آخر تحديث</th>
                <th className="border border-gray-300 bg-[#1B2B5C] text-white px-3 py-2 text-center w-32 whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any, i: number) => {
                const collected = Number(r.total_collected ?? 0);
                const paid      = Number(r.total_paid ?? 0);
                const diff      = collected - paid;
                const isEven    = i % 2 === 0;
                return (
                  <tr
                    key={r.id}
                    className={`${isEven ? "bg-white dark:bg-background" : "bg-gray-50 dark:bg-muted/10"} hover:bg-blue-50/40 dark:hover:bg-blue-900/10 cursor-pointer transition-colors`}
                    onDoubleClick={() => handleOpen(r.id, r.custody_name)}
                  >
                    <td className="border border-gray-200 px-3 py-2 text-center font-mono text-muted-foreground">{r.record_number}</td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">{r.custody_name}</td>
                    <td className="border border-gray-200 px-3 py-2 text-muted-foreground text-[11px]">{r.email || "—"}</td>
                    <td className="border border-gray-200 px-3 py-2 text-left font-mono text-green-700 dark:text-green-500">{fmt(collected)}</td>
                    <td className="border border-gray-200 px-3 py-2 text-left font-mono text-red-700 dark:text-red-400">{fmt(paid)}</td>
                    <td className={`border border-gray-200 px-3 py-2 text-left font-mono font-semibold ${diff > 0 ? "text-green-700 dark:text-green-400" : diff < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                      {fmtDiff(diff)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-center text-muted-foreground">{r.entry_count ?? 0}</td>
                    <td className="border border-gray-200 px-3 py-2 text-center">
                      {r.auto_send_email
                        ? <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-green-200">تلقائي</Badge>
                        : <span className="text-muted-foreground text-[11px]">يدوي</span>}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-muted-foreground text-[11px] font-mono">
                      {r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-muted-foreground text-[11px] font-mono">
                      {r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors"
                          title="تعديل / عرض العهدة"
                          onClick={() => handleOpen(r.id, r.custody_name)}
                        >
                          <Pencil className="w-3 h-3" />
                          تعديل
                        </button>
                        {r.email && (
                          <button
                            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 transition-colors disabled:opacity-40"
                            title="إرسال الكشف الآن"
                            disabled={sending === r.id}
                            onClick={() => handleSendEmail(r.id)}
                          >
                            {sending === r.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Mail className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors disabled:opacity-40"
                          title="حذف"
                          disabled={deleting === r.id}
                          onClick={() => askDelete(r.id, r.custody_name)}
                        >
                          {deleting === r.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── الشريط السفلي ── */}
      {records.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-border/60 bg-muted/10 flex items-center gap-4 text-xs text-muted-foreground">
          <span>الإجمالي: {records.length} سجل</span>
          <span>·</span>
          <span>انقر مرتين على أي سطر لفتح العهدة</span>
        </div>
      )}

      {/* ── مربع تأكيد الحذف ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              تأكيد الحذف
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف متابعة العهدة
              <span className="font-bold text-foreground mx-1">"{confirmRecord?.name ?? ""}"</span>
              وجميع حركاتها بشكل نهائي؟<br />
              <span className="text-red-500 text-xs">لا يمكن التراجع عن هذا الإجراء.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => { setConfirmOpen(false); setConfirmRecord(null); }}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
