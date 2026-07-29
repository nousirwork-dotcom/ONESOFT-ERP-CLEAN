import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { trpc } from "@/shared/lib/trpc";

interface Props {
  invoiceId: number;
  docCategory?: "sales" | "purchase";
  onClose: () => void;
  onConfirmPost: () => void;
  isPosting?: boolean;
}

type PostingPreviewPartyData = {
  customerName?: string | null;
  supplierName?: string | null;
};

export default function PostingPreviewModal({ invoiceId, docCategory = "sales", onClose, onConfirmPost, isPosting }: Props) {
  const salesPreview = trpc.posting.previewSalesInvoice.useQuery(
    { invoiceId },
    { enabled: invoiceId > 0 && docCategory === "sales" },
  );
  const purchasePreview = trpc.posting.previewPurchaseInvoice.useQuery(
    { invoiceId },
    { enabled: invoiceId > 0 && docCategory === "purchase" },
  );
  const preview = docCategory === "purchase" ? purchasePreview : salesPreview;
  const data = preview.data;
  const partyData = data as PostingPreviewPartyData | undefined;
  const partyName = docCategory === "purchase"
    ? partyData?.supplierName
    : partyData?.customerName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", direction: "rtl" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl flex flex-col"
        style={{ width: 640, maxHeight: "80vh", fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: 12 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: "#406B93", borderRadius: "8px 8px 0 0" }}>
          <span className="text-white font-bold text-[13px]">معاينة القيد المحاسبي</span>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {preview.isLoading && (
            <div className="text-center py-8 text-slate-400">جاري تحميل بيانات القيد...</div>
          )}

          {preview.isError && (
            <div className="text-center py-8 text-red-500">
              <AlertTriangle className="mx-auto mb-2" size={24} />
              خطأ في تحميل بيانات القيد
            </div>
          )}

          {data && (
            <>
              {/* Invoice Summary */}
              <div className="grid grid-cols-3 gap-2 mb-3 p-2 rounded" style={{ background: "#F8F7F4", border: "1px solid #DDD8CE" }}>
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">رقم الفاتورة</div>
                  <div className="font-bold text-[#406B93]">{data.invoiceNumber}</div>
                </div>
                <div>
                    <div className="text-[10px] text-slate-400 mb-0.5">{docCategory === "purchase" ? "المورد" : "العميل"}</div>
                    <div className="font-semibold">{partyName ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 mb-0.5">الإجمالي</div>
                  <div className="font-bold text-green-700">{Number(data.total ?? 0).toFixed(3)}</div>
                </div>
                {data.journalName && (
                  <div className="col-span-3">
                    <div className="text-[10px] text-slate-400 mb-0.5">الدفتر</div>
                    <div className="text-slate-600">{data.journalName}</div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {data.warnings.length > 0 && (
                <div className="mb-3 p-2 rounded" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <div className="flex items-center gap-1.5 text-amber-700 font-semibold text-[11px] mb-1">
                    <AlertTriangle size={13} />
                    تحذيرات:
                  </div>
                  {data.warnings.map((w, i) => (
                    <div key={i} className="text-amber-600 text-[11px] mr-4">• {w}</div>
                  ))}
                </div>
              )}

              {/* Journal Lines Table */}
              <div className="border rounded overflow-hidden mb-3" style={{ borderColor: "#DDD8CE" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: "#F2F0EC", borderBottom: "1px solid #DDD8CE" }}>
                      <th className="text-right px-2 py-1.5 font-bold text-slate-600">كود الحساب</th>
                      <th className="text-right px-2 py-1.5 font-bold text-slate-600 w-full">اسم الحساب</th>
                      <th className="text-left px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap">مدين</th>
                      <th className="text-left px-2 py-1.5 font-bold text-slate-600 whitespace-nowrap">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line, i) => {
                      const isDebit  = Number(line.debit) > 0;
                      const isCredit = Number(line.credit) > 0;
                      const hasNoAccount = !line.accountId;
                      return (
                        <tr key={i}
                          style={{
                            borderBottom: i < data.lines.length - 1 ? "1px solid #F0EDE8" : "none",
                            background: hasNoAccount ? "#FFF7ED" : (i % 2 === 0 ? "#fff" : "#FAFAF9"),
                          }}
                        >
                          <td className="px-2 py-1.5 font-mono">
                            {hasNoAccount
                              ? <span className="text-amber-500 text-[10px]">غير محدد</span>
                              : <span className="text-slate-500">{line.accountCode}</span>
                            }
                          </td>
                          <td className="px-2 py-1.5">{line.accountName}</td>
                          <td className="px-2 py-1.5 text-left font-mono">
                            {isDebit
                              ? <span className="text-blue-700 font-semibold">{Number(line.debit).toFixed(3)}</span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                          <td className="px-2 py-1.5 text-left font-mono">
                            {isCredit
                              ? <span className="text-green-700 font-semibold">{Number(line.credit).toFixed(3)}</span>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F2F0EC", borderTop: "2px solid #DDD8CE" }}>
                      <td colSpan={2} className="px-2 py-1.5 font-bold text-slate-700 text-right">الإجمالي</td>
                      <td className="px-2 py-1.5 text-left font-mono font-bold text-blue-700">
                        {Number(data.totalDebit).toFixed(3)}
                      </td>
                      <td className="px-2 py-1.5 text-left font-mono font-bold text-green-700">
                        {Number(data.totalCredit).toFixed(3)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance Indicator */}
              <div className={`flex items-center gap-2 text-[11px] font-semibold rounded px-3 py-1.5 ${
                data.isBalanced
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {data.isBalanced
                  ? <><CheckCircle2 size={14} /> القيد متوازن — جاهز للترحيل</>
                  : <><AlertTriangle size={14} /> القيد غير متوازن — لا يمكن الترحيل</>
                }
              </div>

              {!data.isBalanced && data.warnings.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  تأكد من تحديد الحسابات في إعدادات الدفتر قبل الترحيل
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ background: "#F8F7F4" }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[12px] rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            إغلاق
          </button>
          {data && !data.isPosted && (
            <button
              onClick={onConfirmPost}
              disabled={!data.isBalanced || isPosting}
              className="px-5 py-1.5 text-[12px] rounded font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: data.isBalanced ? "#B89B5E" : "#9CA3AF" }}
            >
              {isPosting ? "جاري الترحيل..." : "✓ تأكيد الترحيل"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
