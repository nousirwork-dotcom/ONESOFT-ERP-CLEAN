import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Icon renderer ────────────────────────────────────────────────────────────
function MethodIcon({ icon, color }: { icon?: string | null; color?: string | null }) {
  const c = color ?? "#64748B";
  if (icon === "cash") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  );
  if (icon === "card") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20M6 15h4"/>
    </svg>
  );
  if (icon === "bank") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11"/>
    </svg>
  );
  if (icon === "wallet") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>
      <circle cx="16" cy="12" r="1.5"/>
    </svg>
  );
  if (icon === "qr") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 14h.01M17 14h.01M20 14h.01M14 17h.01M17 17h.01M20 17h.01M14 20h.01M17 20h.01M20 20h.01"/>
    </svg>
  );
  if (icon === "account") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
      <path d="M16 3.5c1.5.5 2.5 2 2.5 3.5" strokeDasharray="2 1.5"/>
    </svg>
  );
  if (icon === "tamara") return (
    <span style={{ fontWeight: 700, fontSize: 13, color: "#000", letterSpacing: -0.5 }}>tamara</span>
  );
  if (icon === "tabby") return (
    <span style={{ fontWeight: 700, fontSize: 13, color: "#3DBA4E", letterSpacing: -0.5 }}>tabby</span>
  );
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  );
}

function CardBadge() {
  return (
    <div className="flex gap-1 items-center mt-0.5">
      <span className="text-[10px] font-bold text-blue-600 border border-blue-300 rounded px-1">VISA</span>
      <span className="text-[10px] font-bold text-red-500 border border-red-200 rounded px-1">MC</span>
      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1">MADA</span>
    </div>
  );
}

// ─── Interface ────────────────────────────────────────────────────────────────
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: number | null;
  invoiceNumber: string;
  invoiceTotal: number;
  currency?: string;
  onSaveFirst?: () => Promise<number | null>;
  onConfirmed: (paidAmount: number, breakdown: Record<string, number>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PaymentModal({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  currency = "SAR",
  onSaveFirst,
  onConfirmed,
}: PaymentModalProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [isSavingFirst, setIsSavingFirst] = useState(false);
  const [shake, setShake] = useState(false);
  const loadedRef = useRef<number | null>(null);

  // ─── payment methods ───────────────────────────────────────────────────────
  const methodsQ = trpc.paymentMethods.listActive.useQuery(undefined, { enabled: open });
  const seedMut = trpc.paymentMethods.seedDefaults.useMutation({
    onSuccess: () => methodsQ.refetch(),
  });
  const seededRef = useRef(false);
  useEffect(() => {
    if (!open) { seededRef.current = false; return; }
    if (methodsQ.data && methodsQ.data.length === 0 && !seededRef.current) {
      seededRef.current = true;
      seedMut.mutate();
    }
  }, [open, methodsQ.data]);

  // ─── load saved breakdown when invoice already exists ─────────────────────
  const breakdownQ = trpc.salesInvoices.getPaymentBreakdown.useQuery(
    { id: invoiceId! },
    { enabled: open && !!invoiceId }
  );
  useEffect(() => {
    if (!open) { loadedRef.current = null; return; }
    if (!invoiceId || !breakdownQ.data) return;
    if (loadedRef.current === invoiceId) return; // already loaded for this invoice
    const bd = breakdownQ.data.breakdown;
    if (Object.keys(bd).length > 0) {
      const newAmounts: Record<string, string> = {};
      for (const [k, v] of Object.entries(bd)) {
        newAmounts[k] = v.toFixed(2);
      }
      setAmounts(newAmounts);
      loadedRef.current = invoiceId;
    }
  }, [open, invoiceId, breakdownQ.data]);

  // reset amounts when opening a fresh (unsaved) invoice
  useEffect(() => {
    if (open && !invoiceId) {
      setAmounts({});
      loadedRef.current = null;
    }
  }, [open, invoiceId]);

  // ─── totals ───────────────────────────────────────────────────────────────
  const totalPaid = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [amounts]
  );
  const remaining  = Math.max(0, invoiceTotal - totalPaid);
  const isFullyPaid = Math.abs(totalPaid - invoiceTotal) < 0.005;
  const isOverPaid  = totalPaid > invoiceTotal + 0.005;
  const hasAnyPayment = totalPaid > 0.004;

  // ─── update mutation ──────────────────────────────────────────────────────
  const updatePaymentMut = trpc.salesInvoices.updatePayment.useMutation({
    onSuccess: () => {
      const breakdown: Record<string, number> = {};
      Object.entries(amounts).forEach(([k, v]) => {
        const n = parseFloat(v) || 0;
        if (n > 0) breakdown[k] = n;
      });
      toast.success("تم تسجيل الدفع بنجاح ✓");
      onConfirmed(totalPaid, breakdown);
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── confirm ──────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!hasAnyPayment) { toast.warning("أدخل مبلغاً واحداً على الأقل"); return; }
    if (isOverPaid) { toast.error("المبلغ المدفوع يتجاوز إجمالي الفاتورة"); return; }

    let finalId = invoiceId;
    if (!finalId && onSaveFirst) {
      setIsSavingFirst(true);
      try { finalId = await onSaveFirst(); }
      finally { setIsSavingFirst(false); }
      if (!finalId) return;
    }
    if (!finalId) { toast.error("لا يمكن تسجيل الدفع — يجب حفظ الفاتورة أولاً"); return; }

    const breakdown: Record<string, number> = {};
    Object.entries(amounts).forEach(([k, v]) => {
      const n = parseFloat(v) || 0;
      if (n > 0) breakdown[k] = n;
    });
    updatePaymentMut.mutate({
      id: finalId,
      paymentBreakdown: breakdown,
      paidAmount: totalPaid.toFixed(4),
      remainingAmount: Math.max(0, invoiceTotal - totalPaid).toFixed(4),
      status: isFullyPaid ? "paid" : "confirmed",
    });
  }, [hasAnyPayment, isOverPaid, isFullyPaid, amounts, totalPaid, invoiceTotal, invoiceId, updatePaymentMut, onSaveFirst]);

  const setAmount = useCallback((code: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [code]: value }));
  }, []);

  const fillFull = useCallback((code: string) => {
    const otherTotal = Object.entries(amounts)
      .filter(([k]) => k !== code)
      .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
    setAmounts((prev) => ({ ...prev, [code]: Math.max(0, invoiceTotal - otherTotal).toFixed(2) }));
  }, [amounts, invoiceTotal]);

  // ─── prevent outside-click close: show shake instead ─────────────────────
  const handleAttemptClose = useCallback(() => {
    if (isBusy) return;
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    setAmounts({});
    loadedRef.current = null;
    onClose();
  }, [onClose]);

  const fmt = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const paidPct = Math.min(100, (totalPaid / Math.max(invoiceTotal, 0.001)) * 100);
  const methods  = methodsQ.data ?? [];
  const isLoading = methodsQ.isLoading || (methods.length === 0 && seedMut.isPending);
  const isBusy = isSavingFirst || updatePaymentMut.isPending;
  const isZeroTotal = invoiceTotal <= 0;
  const needsSave = !invoiceId && !!onSaveFirst;

  const confirmLabel = (() => {
    if (isSavingFirst)             return "جاري حفظ الفاتورة...";
    if (updatePaymentMut.isPending) return "جاري تسجيل الدفع...";
    if (needsSave && isFullyPaid)  return "💾 حفظ وتأكيد الدفع الكامل";
    if (needsSave)                 return "💾 حفظ وتأكيد الدفع";
    if (isFullyPaid)               return "✓ تأكيد الدفع الكامل";
    return "تأكيد دفع جزئي";
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleAttemptClose(); // intercept outside-click
      }}
      modal={true}
    >
      <DialogContent
        className={`p-0 gap-0 overflow-hidden transition-transform ${shake ? "animate-shake" : ""}`}
        style={{ maxWidth: 480, borderRadius: 12 }}
        dir="rtl"
        onPointerDownOutside={(e) => {
          e.preventDefault(); // BLOCK outside-click close
          handleAttemptClose();
        }}
        onInteractOutside={(e) => {
          e.preventDefault(); // BLOCK escape + outside interactions
        }}
      >
        {/* shake keyframes */}
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            15%{transform:translateX(-8px)}
            30%{transform:translateX(7px)}
            45%{transform:translateX(-6px)}
            60%{transform:translateX(5px)}
            75%{transform:translateX(-3px)}
            90%{transform:translateX(2px)}
          }
          .animate-shake{animation:shake 0.55s ease-in-out;}
        `}</style>

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-100" style={{ background: "#406B93" }}>
          <DialogTitle className="text-white text-[15px] font-bold text-right flex items-center gap-2">
            <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <path d="M2 10h20M6 15h4"/>
            </svg>
            شاشة الدفع
          </DialogTitle>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-white/70 text-[11px]">فاتورة رقم: {invoiceNumber || "—"}</p>
            {needsSave && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(255,193,7,0.25)", color: "#FFC107" }}>
                ● لم تُحفظ بعد
              </span>
            )}
          </div>
        </DialogHeader>

        {/* ── Zero-total warning ── */}
        {invoiceTotal <= 0 && (
          <div className="mx-4 mt-3 mb-1 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-[12px] font-bold text-amber-700">لا يمكن تسجيل دفعة</p>
              <p className="text-[11px] text-amber-600 mt-0.5">يجب إضافة أصناف أو مبالغ إلى الفاتورة قبل تسجيل الدفع.</p>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">إجمالي الفاتورة</div>
              <div className="font-bold text-[#406B93] text-[13px]">{fmt(invoiceTotal)}</div>
              <div className="text-[9px] text-slate-400">{currency}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">المدفوع</div>
              <div className={`font-bold text-[13px] ${hasAnyPayment ? "text-green-600" : "text-slate-400"}`}>
                {fmt(totalPaid)}
              </div>
              <div className="text-[9px] text-slate-400">{currency}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">المتبقي</div>
              <div className={`font-bold text-[13px] ${remaining > 0 ? "text-orange-500" : "text-green-600"}`}>
                {fmt(remaining)}
              </div>
              <div className="text-[9px] text-slate-400">{currency}</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${paidPct}%`, background: isOverPaid ? "#EF4444" : isFullyPaid ? "#16A34A" : "#406B93" }}
            />
          </div>
        </div>

        {/* ── Payment methods ── */}
        <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="text-center text-xs text-slate-400 py-6">جاري تحميل وسائل الدفع...</div>
          )}
          {!isLoading && methods.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-6">
              لا توجد وسائل دفع — يُرجى ضبطها من الإعدادات → وسائل الدفع
            </div>
          )}
          {methods.map((method) => {
            const val = amounts[method.code] ?? "";
            const hasVal = parseFloat(val) > 0;
            const textColor   = method.color   ?? "#64748B";
            const bgColor     = method.bgColor  ?? "#F8FAFC";
            const borderColor = method.color    ?? "#94A3B8";
            return (
              <div
                key={method.code}
                className="flex items-center gap-3 p-2.5 rounded-lg border transition-all"
                style={{ background: hasVal ? bgColor : "#FAFAFA", borderColor: hasVal ? borderColor : "#E2E8F0" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: hasVal ? borderColor + "20" : "#F1F5F9" }}
                >
                  <MethodIcon icon={method.icon} color={method.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[12px]" style={{ color: hasVal ? textColor : "#374151" }}>
                    {method.nameAr}
                  </div>
                  {method.icon === "card" && <CardBadge />}
                </div>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={val}
                  onChange={(e) => setAmount(method.code, e.target.value)}
                  className="w-28 h-8 text-left text-[12px] font-mono border-slate-200 focus:border-[#406B93]"
                  dir="ltr"
                  disabled={isBusy || isZeroTotal}
                />
                <Button
                  size="sm" variant="ghost"
                  className="h-8 px-2 text-[11px] text-slate-500 hover:text-[#406B93] flex-shrink-0"
                  onClick={() => fillFull(method.code)}
                  title="ملء المتبقي"
                  disabled={isBusy || isZeroTotal}
                >
                  كامل
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── Actions ── */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 bg-white">
          <Button
            variant="outline"
            className="flex-1 h-9 text-[12px]"
            onClick={handleClose}
            disabled={isBusy}
          >
            إلغاء
          </Button>
          <Button
            className="flex-1 h-9 text-[12px] font-bold"
            style={{ background: isOverPaid ? "#EF4444" : isFullyPaid ? "#16A34A" : "#406B93" }}
            disabled={!hasAnyPayment || isBusy || isOverPaid || isZeroTotal}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
