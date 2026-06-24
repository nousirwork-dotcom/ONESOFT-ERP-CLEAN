import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── Icon renderer for DB-driven methods ─────────────────────────────────────
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

// Badge for card method
function CardBadge() {
  return (
    <div className="flex gap-1 items-center mt-0.5">
      <span className="text-[10px] font-bold text-blue-600 border border-blue-300 rounded px-1">VISA</span>
      <span className="text-[10px] font-bold text-red-500 border border-red-200 rounded px-1">MC</span>
      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 rounded px-1">MADA</span>
    </div>
  );
}

// ─── الواجهة ──────────────────────────────────────────────────────────────────
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId: number;
  invoiceNumber: string;
  invoiceTotal: number;
  currency?: string;
  onConfirmed: (paidAmount: number, breakdown: Record<string, number>) => void;
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function PaymentModal({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  currency = "SAR",
  onConfirmed,
}: PaymentModalProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // ─── جلب وسائل الدفع من قاعدة البيانات ──────────────────────────────────
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

  // ─── حسابات الإجمالي ──────────────────────────────────────────────────────
  const totalPaid = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [amounts]
  );

  const remaining = Math.max(0, invoiceTotal - totalPaid);
  const isFullyPaid = Math.abs(totalPaid - invoiceTotal) < 0.005;
  const isOverPaid = totalPaid > invoiceTotal + 0.005;
  const hasAnyPayment = totalPaid > 0.004;

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

  const handleConfirm = useCallback(() => {
    if (!hasAnyPayment) { toast.warning("أدخل مبلغاً واحداً على الأقل"); return; }
    if (isOverPaid) { toast.error("المبلغ المدفوع يتجاوز إجمالي الفاتورة"); return; }
    const breakdown: Record<string, number> = {};
    Object.entries(amounts).forEach(([k, v]) => {
      const n = parseFloat(v) || 0;
      if (n > 0) breakdown[k] = n;
    });
    updatePaymentMut.mutate({
      id: invoiceId,
      paymentBreakdown: breakdown,
      paidAmount: totalPaid.toFixed(4),
      remainingAmount: Math.max(0, invoiceTotal - totalPaid).toFixed(4),
      status: isFullyPaid ? "paid" : "confirmed",
    });
  }, [hasAnyPayment, isOverPaid, isFullyPaid, amounts, totalPaid, invoiceTotal, invoiceId, updatePaymentMut]);

  const setAmount = useCallback((code: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [code]: value }));
  }, []);

  const fillFull = useCallback(
    (code: string) => {
      const otherTotal = Object.entries(amounts)
        .filter(([k]) => k !== code)
        .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);
      setAmounts((prev) => ({ ...prev, [code]: Math.max(0, invoiceTotal - otherTotal).toFixed(2) }));
    },
    [amounts, invoiceTotal]
  );

  const handleClose = useCallback(() => {
    setAmounts({});
    onClose();
  }, [onClose]);

  const fmt = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const paidPct = Math.min(100, (totalPaid / invoiceTotal) * 100);

  const methods = methodsQ.data ?? [];
  const isLoading = methodsQ.isLoading || (methods.length === 0 && seedMut.isPending);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{ maxWidth: 480, borderRadius: 12 }}
        dir="rtl"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-slate-100" style={{ background: "#406B93" }}>
          <DialogTitle className="text-white text-[15px] font-bold text-right flex items-center gap-2">
            <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17" strokeLinecap="round"/>
            </svg>
            شاشة الدفع
          </DialogTitle>
          <p className="text-white/70 text-[11px] text-right">فاتورة رقم: {invoiceNumber}</p>
        </DialogHeader>

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
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${paidPct}%`,
                background: isOverPaid ? "#EF4444" : isFullyPaid ? "#16A34A" : "#406B93",
              }}
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
            const textColor = method.color ?? "#64748B";
            const bgColor = method.bgColor ?? "#F8FAFC";
            const borderColor = method.color ?? "#94A3B8";
            return (
              <div
                key={method.code}
                className="flex items-center gap-3 p-2.5 rounded-lg border transition-all"
                style={{
                  background: hasVal ? bgColor : "#FAFAFA",
                  borderColor: hasVal ? borderColor : "#E2E8F0",
                }}
              >
                {/* Icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: hasVal ? borderColor + "20" : "#F1F5F9" }}
                >
                  <MethodIcon icon={method.icon} color={method.color} />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[12px]" style={{ color: hasVal ? textColor : "#374151" }}>
                    {method.nameAr}
                  </div>
                  {method.icon === "card" && <CardBadge />}
                </div>

                {/* Amount input */}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={val}
                  onChange={(e) => setAmount(method.code, e.target.value)}
                  className="w-28 h-8 text-left text-[12px] font-mono border-slate-200 focus:border-[#406B93]"
                  dir="ltr"
                />

                {/* كامل button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-[11px] text-slate-500 hover:text-[#406B93] flex-shrink-0"
                  onClick={() => fillFull(method.code)}
                  title="ملء المتبقي"
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
            disabled={updatePaymentMut.isPending}
          >
            تخطي
          </Button>
          <Button
            className="flex-1 h-9 text-[12px] font-bold"
            style={{ background: isOverPaid ? "#EF4444" : "#406B93" }}
            disabled={!hasAnyPayment || updatePaymentMut.isPending || isOverPaid}
            onClick={handleConfirm}
          >
            {updatePaymentMut.isPending
              ? "جاري الحفظ..."
              : isFullyPaid
              ? "✓ تأكيد الدفع الكامل"
              : "تأكيد دفع جزئي"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
