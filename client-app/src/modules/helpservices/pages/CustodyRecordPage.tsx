import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { useTabPath } from "@/core/contexts/TabPathContext";
import { toast } from "sonner";
import {
  Plus, Save, Trash2, AlertTriangle, ArrowRight,
  Loader2, Mail, Send, RefreshCw,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";

// ─── نوع الحركة ───────────────────────────────────────────────────────────────
type Entry = {
  _key:            string;
  entryDate:       string;
  description:     string;
  referenceNumber: string;
  amountCollected: number;
  amountPaid:      number;
  note:            string;
  sortOrder:       number;
};

let _kc = 0;
function newKey() { return `ek_${++_kc}`; }

const today = () => new Date().toISOString().slice(0, 10);

function emptyEntry(sortOrder: number): Entry {
  return {
    _key: newKey(), entryDate: today(), description: "",
    referenceNumber: "", amountCollected: 0, amountPaid: 0,
    note: "", sortOrder,
  };
}

function fromServer(row: any, idx: number): Entry {
  return {
    _key:            newKey(),
    entryDate:       row.entryDate       ?? row.entry_date       ?? today(),
    description:     row.description     ?? "",
    referenceNumber: row.referenceNumber ?? row.reference_number ?? "",
    amountCollected: Number(row.incomeCollected ?? row.income_collected ?? 0),
    amountPaid:      Number(row.expensePaid     ?? row.expense_paid     ?? 0),
    note:            row.incomeNote      ?? row.income_note      ?? "",
    sortOrder:       row.sortOrder       ?? row.sort_order       ?? idx,
  };
}

function fmt(n: number) {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function CustodyRecordPage() {
  const { openTab } = useTabManager();
  const tabPath     = useTabPath();

  // استخراج معرف العهدة من المسار: /hs/custody-record/123 أو /hs/custody-record/new
  const pathSeg    = tabPath.split("/").pop() ?? "new";
  const isNew      = pathSeg === "new";
  const custodyId  = isNew ? null : parseInt(pathSeg, 10);

  // ── حقول الهيدر ──
  const [custodyName,   setCustodyName]   = useState("");
  const [email,         setEmail]         = useState("");
  const [autoSend,      setAutoSend]      = useState(false);
  const [recordNumber,  setRecordNumber]  = useState<number | null>(null);

  // ── الحركات ──
  const [entries, setEntries] = useState<Entry[]>([emptyEntry(0)]);

  const [saving,  setSaving]  = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── جلب البيانات إذا كان سجلاً موجوداً ──
  const recordQ = trpc.custodyTracking.getRecord.useQuery(
    { id: custodyId! },
    {
      enabled: !!custodyId && !isNaN(custodyId),
      refetchOnWindowFocus: false,
      onSuccess: (data: any) => {
        if (!loaded) {
          setCustodyName(data.record.custodyName  ?? data.record.custody_name  ?? "");
          setEmail(data.record.email ?? "");
          setAutoSend(data.record.autoSendEmail   ?? data.record.auto_send_email ?? false);
          setRecordNumber(data.record.recordNumber ?? data.record.record_number ?? null);
          const mapped = (data.entries as any[]).map((e, i) => fromServer(e, i));
          setEntries(mapped.length > 0 ? mapped : [emptyEntry(0)]);
          setLoaded(true);
        }
      },
    }
  );

  const createM     = trpc.custodyTracking.createRecord.useMutation();
  const updateM     = trpc.custodyTracking.updateRecord.useMutation();
  const saveEntrM   = trpc.custodyTracking.saveEntries.useMutation();
  const sendEmailM  = trpc.custodyTracking.sendEmail.useMutation();

  // ── إضافة حركة ──
  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, emptyEntry(prev.length)]);
  }, []);

  // ── تعديل حقل في حركة ──
  const updateField = useCallback((key: string, field: keyof Entry, raw: string) => {
    setEntries(prev => prev.map(e => {
      if (e._key !== key) return e;
      const numFields: (keyof Entry)[] = ["amountCollected", "amountPaid"];
      const val = numFields.includes(field) ? (parseFloat(raw) || 0) : raw;
      return { ...e, [field]: val };
    }));
  }, []);

  // ── حذف حركة ──
  const deleteEntry = useCallback((key: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e._key !== key);
      return next.length === 0 ? [emptyEntry(0)] : next;
    });
  }, []);

  // ── التنقل بين الخلايا ──
  const COLS = ["entryDate", "description", "referenceNumber", "amountCollected", "amountPaid", "note"];

  function focusCell(rowKey: string, col: string) {
    cellRefs.current.get(`${rowKey}__${col}`)?.focus();
  }
  function nextCell(rowKey: string, col: string) {
    const ci = COLS.indexOf(col);
    const ri = entries.findIndex(e => e._key === rowKey);
    if (ci < COLS.length - 1) {
      focusCell(rowKey, COLS[ci + 1]);
    } else if (ri < entries.length - 1) {
      focusCell(entries[ri + 1]._key, COLS[0]);
    } else {
      addEntry();
      setTimeout(() => {
        setEntries(prev => {
          if (prev.length > 0) focusCell(prev[prev.length - 1]._key, COLS[0]);
          return prev;
        });
      }, 60);
    }
  }
  function prevCell(rowKey: string, col: string) {
    const ci = COLS.indexOf(col);
    const ri = entries.findIndex(e => e._key === rowKey);
    if (ci > 0) focusCell(rowKey, COLS[ci - 1]);
    else if (ri > 0) focusCell(entries[ri - 1]._key, COLS[COLS.length - 1]);
  }

  // ── حفظ ──
  const doSave = useCallback(async (options?: { skipAutoSend?: boolean }): Promise<number | null> => {
    if (!custodyName.trim()) {
      toast.error("اسم العهدة مطلوب");
      return null;
    }
    setSaving(true);
    try {
      let id = custodyId;
      if (isNew) {
        const rec = await createM.mutateAsync({
          custodyName: custodyName.trim(),
          email: email.trim() || null,
          autoSendEmail: autoSend,
        });
        id = (rec as any).id;
        setRecordNumber((rec as any).recordNumber ?? (rec as any).record_number ?? null);
      } else {
        await updateM.mutateAsync({
          id: custodyId!,
          custodyName: custodyName.trim(),
          email: email.trim() || null,
          autoSendEmail: autoSend,
        });
      }
      const nonEmpty = entries.filter(e =>
        e.description.trim() || e.amountCollected || e.amountPaid || e.referenceNumber.trim()
      );
      await saveEntrM.mutateAsync({
        custodyId: id!,
        entries: nonEmpty.map((e, i) => ({
          entryDate:       e.entryDate,
          description:     e.description,
          referenceNumber: e.referenceNumber || null,
          amountCollected: e.amountCollected,
          amountPaid:      e.amountPaid,
          note:            e.note || null,
          sortOrder:       i,
        })),
      });

      if (isNew && id) {
        // بعد الإنشاء: نفتح التبويب بالمعرف الجديد
        openTab(`/hs/custody-record/${id}`, `عهدة: ${custodyName.trim()}`, Save);
      }
      toast.success("تم الحفظ بنجاح");

      // ── الإرسال التلقائي بعد الحفظ (غير حاجز) ──
      if (!options?.skipAutoSend && autoSend && id && email.trim()) {
        try {
          const result = await sendEmailM.mutateAsync({ custodyId: id });
          if (result.status === "sent") {
            toast.success("تم إرسال كشف العهدة تلقائياً إلى البريد الإلكتروني");
          } else if (result.status === "not_configured") {
            toast.warning("تم حفظ البيانات بنجاح، ولكن خدمة البريد غير مهيأة — راجع إعدادات الإرسال");
          } else {
            toast.warning(`تم حفظ البيانات بنجاح، ولكن تعذر إرسال البريد الإلكتروني: ${result.errorMsg ?? ""}`);
          }
        } catch (e: any) {
          toast.warning("تم حفظ البيانات بنجاح، ولكن تعذر إرسال البريد الإلكتروني");
        }
      }

      return id;
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
      return null;
    } finally {
      setSaving(false);
    }
  }, [custodyName, email, autoSend, entries, custodyId, isNew, createM, updateM, saveEntrM, openTab, sendEmailM]);

  // ── حفظ وإرسال ──
  const handleSaveAndSend = useCallback(async () => {
    // skipAutoSend لأن سنرسل يدوياً بعد الحفظ
    const id = await doSave({ skipAutoSend: true });
    if (!id) return;
    setSending(true);
    try {
      const result = await sendEmailM.mutateAsync({ custodyId: id });
      if (result.status === "sent") {
        toast.success("تم الحفظ وإرسال الكشف بنجاح");
      } else if (result.status === "not_configured") {
        toast.warning("تم الحفظ — لكن خدمة البريد غير مهيأة، راجع إعدادات الإرسال");
      } else {
        toast.error(`تم الحفظ — لكن فشل الإرسال: ${result.errorMsg ?? ""}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تم الحفظ لكن تعذّر إرسال البريد");
    } finally {
      setSending(false);
    }
  }, [doSave, sendEmailM]);

  // ── إرسال الكشف فقط ──
  const handleSendOnly = useCallback(async () => {
    if (!custodyId) { toast.error("احفظ العهدة أولاً ثم أرسل الكشف"); return; }
    if (!email.trim()) { toast.error("لا يوجد بريد إلكتروني مرتبط بهذه العهدة"); return; }
    setSending(true);
    try {
      const result = await sendEmailM.mutateAsync({ custodyId });
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
      setSending(false);
    }
  }, [custodyId, email, sendEmailM]);

  // ── الإجماليات ──
  const totalCollected = entries.reduce((s, e) => s + e.amountCollected, 0);
  const totalPaid      = entries.reduce((s, e) => s + e.amountPaid, 0);
  const diff           = totalCollected - totalPaid;

  // ── تسمية الفرق بين المحصل والمسدد ──
  const diffLabel = diff > 0
    ? `رصيد متبقٍ بالعهدة: ${fmt(diff)}`
    : diff < 0
      ? `تجاوز في المصروفات: ${fmt(Math.abs(diff))}`
      : "العهدة مسواة بالكامل: 0";
  const diffColor = diff > 0 ? "text-green-700 dark:text-green-400"
    : diff < 0 ? "text-red-700 dark:text-red-400"
    : "text-muted-foreground";

  const isLoading = !isNew && recordQ.isLoading;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden" dir="rtl">

      {/* ── شريط التنبيه ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-tight">
          شاشة متابعة داخلية مستقلة — لا تؤثر على الحسابات أو الصندوق أو المخزون أو أي عملية داخل OneSoft.
        </p>
      </div>

      {/* ── شريط التنقل والأزرار ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap">
        <button
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => openTab("/hs/custody-tracking", "متابعة العهد")}
        >
          <ArrowRight className="w-4 h-4" />
          <span className="text-xs">متابعة العهد</span>
        </button>
        <span className="text-muted-foreground/40">/</span>
        <h1 className="text-sm font-bold text-foreground">
          {isNew ? "متابعة عهدة جديدة" : (custodyName || "متابعة عهدة")}
          {recordNumber && !isNew && (
            <span className="text-muted-foreground font-normal mr-1 text-xs">(رقم {recordNumber})</span>
          )}
        </h1>

        <div className="flex-1" />

        {!isNew && (
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
            onClick={() => recordQ.refetch()} disabled={recordQ.isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recordQ.isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        )}

        <Button
          size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
          onClick={() => openTab("/hs/custody-tracking", "متابعة العهد")}
        >
          إلغاء والعودة
        </Button>

        {!isNew && email && (
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={handleSendOnly} disabled={sending}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            إرسال الكشف الآن
          </Button>
        )}

        {email && (
          <Button
            size="sm" variant="outline" className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={handleSaveAndSend} disabled={saving || sending}
          >
            {(saving || sending) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            حفظ وإرسال
          </Button>
        )}

        <Button
          size="sm" className="h-8 gap-1.5 text-xs bg-[#1B2B5C] hover:bg-[#1B2B5C]/90"
          onClick={() => doSave()} disabled={saving}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          حفظ
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          جارٍ التحميل...
        </div>
      ) : (
        <div className="flex-1 overflow-auto">

          {/* ── هيدر العهدة ── */}
          <div className="px-5 py-4 border-b border-border/60 bg-muted/10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
              {recordNumber && !isNew && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">رقم المتابعة</Label>
                  <div className="h-9 px-3 flex items-center rounded border border-border/60 bg-muted/30 text-sm font-mono text-muted-foreground">
                    {recordNumber}
                  </div>
                </div>
              )}
              <div className={recordNumber && !isNew ? "" : "md:col-span-1"}>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  اسم العهدة <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={custodyName}
                  onChange={e => setCustodyName(e.target.value)}
                  placeholder="أدخل اسم العهدة..."
                  className="h-9 text-sm text-right"
                  autoFocus={isNew}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="h-9 text-sm text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoSend"
                  checked={autoSend}
                  onChange={e => setAutoSend(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-blue-600"
                />
                <Label htmlFor="autoSend" className="text-xs cursor-pointer select-none">
                  الإرسال التلقائي عند الحفظ
                </Label>
              </div>
            </div>
          </div>

          {/* ── جدول الحركات ── */}
          <div className="overflow-auto">
            <table className="w-full border-collapse text-[12px]" style={{ minWidth: 860 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 text-center w-8 whitespace-nowrap">م</th>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 whitespace-nowrap w-28">التاريخ</th>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 whitespace-nowrap min-w-[200px]">البيان</th>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 whitespace-nowrap w-28">رقم المرجع</th>
                  <th className="border border-gray-300 bg-[#2D4F9C] text-white px-2 py-2 whitespace-nowrap w-28">المبلغ المحصل</th>
                  <th className="border border-gray-300 bg-[#1E6B3A] text-white px-2 py-2 whitespace-nowrap w-28">المبلغ المسدد</th>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 whitespace-nowrap min-w-[150px]">ملاحظة</th>
                  <th className="border border-gray-300 bg-[#1B2B5C] text-white px-2 py-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, idx) => {
                  const mkRef = (col: string) => (el: HTMLInputElement | null) => {
                    const k = `${row._key}__${col}`;
                    if (el) cellRefs.current.set(k, el);
                    else cellRefs.current.delete(k);
                  };
                  const kbNav = (col: string) => ({
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); nextCell(row._key, col); }
                      else if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); prevCell(row._key, col); }
                      else if (e.key === "Enter") { e.preventDefault(); nextCell(row._key, col); }
                    },
                  });

                  return (
                    <tr
                      key={row._key}
                      className={`${idx % 2 === 0 ? "bg-white dark:bg-background" : "bg-gray-50/60 dark:bg-muted/10"} hover:bg-blue-50/20 transition-colors`}
                    >
                      <td className="border border-gray-200 text-center text-muted-foreground py-0.5 px-1 select-none">{idx + 1}</td>

                      <td className="border border-gray-200 p-0">
                        <input
                          ref={mkRef("entryDate")} type="date" value={row.entryDate} dir="ltr"
                          className="w-full h-8 px-1.5 text-[11px] border-0 outline-none bg-transparent focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                          onChange={e => updateField(row._key, "entryDate", e.target.value)}
                          {...kbNav("entryDate")}
                        />
                      </td>

                      <td className="border border-gray-200 p-0">
                        <input
                          ref={mkRef("description")} type="text" value={row.description} dir="rtl" placeholder="البيان..."
                          className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                          onChange={e => updateField(row._key, "description", e.target.value)}
                          {...kbNav("description")}
                        />
                      </td>

                      <td className="border border-gray-200 p-0">
                        <input
                          ref={mkRef("referenceNumber")} type="text" value={row.referenceNumber} dir="rtl" placeholder="المرجع"
                          className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                          onChange={e => updateField(row._key, "referenceNumber", e.target.value)}
                          {...kbNav("referenceNumber")}
                        />
                      </td>

                      <td className="border border-gray-200 p-0 bg-blue-50/20">
                        <input
                          ref={mkRef("amountCollected")} type="number" value={row.amountCollected || ""} dir="ltr" placeholder="0"
                          className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-blue-50/80 focus:ring-1 focus:ring-blue-400 rounded"
                          onChange={e => updateField(row._key, "amountCollected", e.target.value)}
                          {...kbNav("amountCollected")}
                        />
                      </td>

                      <td className="border border-gray-200 p-0 bg-green-50/20">
                        <input
                          ref={mkRef("amountPaid")} type="number" value={row.amountPaid || ""} dir="ltr" placeholder="0"
                          className="w-full h-8 px-1.5 text-[12px] border-0 outline-none bg-transparent text-left focus:bg-green-50/80 focus:ring-1 focus:ring-green-400 rounded"
                          onChange={e => updateField(row._key, "amountPaid", e.target.value)}
                          {...kbNav("amountPaid")}
                        />
                      </td>

                      <td className="border border-gray-200 p-0">
                        <input
                          ref={mkRef("note")} type="text" value={row.note} dir="rtl" placeholder="ملاحظة"
                          className="w-full h-8 px-1.5 text-[11px] border-0 outline-none bg-transparent text-right focus:bg-blue-50/60 focus:ring-1 focus:ring-blue-400 rounded"
                          onChange={e => updateField(row._key, "note", e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); nextCell(row._key, "note"); }
                            else if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); prevCell(row._key, "note"); }
                            else if (e.key === "Enter") { e.preventDefault(); addEntry(); setTimeout(() => setEntries(p => { if (p.length > 0) focusCell(p[p.length - 1]._key, COLS[0]); return p; }), 60); }
                          }}
                        />
                      </td>

                      <td className="border border-gray-200 text-center p-0">
                        <button
                          onClick={() => deleteEntry(row._key)}
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors mx-auto"
                          title="حذف الحركة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── صف الإجماليات ── */}
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-indigo-900 text-white font-bold text-[12px]">
                  <td colSpan={4} className="border border-indigo-700 px-3 py-2 text-center">الإجمالي</td>
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmt(totalCollected)}</td>
                  <td className="border border-indigo-700 px-2 py-2 text-left">{fmt(totalPaid)}</td>
                  <td colSpan={2} className="border border-indigo-700 px-2 py-2" />
                </tr>
                <tr className="bg-[#1B2B5C] text-white font-extrabold text-[13px]">
                  <td colSpan={4} className="border border-[#0F1D40] px-3 py-2.5 text-center text-xs font-bold">
                    الفرق بين المحصل والمسدد
                  </td>
                  <td colSpan={4} className={`border border-[#0F1D40] px-3 py-2.5 text-center text-base ${diff >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {diffLabel}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── شريط إضافة حركة ── */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border/40 bg-muted/10">
            <button
              onClick={addEntry}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة حركة جديدة
            </button>
            <span className="text-muted-foreground/40 text-xs">|</span>
            <span className="text-xs text-muted-foreground">{entries.length} حركة</span>
          </div>
        </div>
      )}
    </div>
  );
}
