import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const DOC_TYPE_LABELS: Record<string, string> = {
  sales_invoice:       "فواتير المبيعات",
  purchase_invoice:    "فواتير المشتريات",
  receipt_voucher:     "سندات القبض",
  payment_voucher:     "سندات الصرف",
  journal_entry:       "القيود اليومية",
  stock_transfer:      "التحويلات المخزنية",
  stock_receipt:       "سندات توريد المخزون",
  stock_issue:         "سندات صرف المخزون",
  inventory_count:     "جرد المخزون",
  sales_return:        "مردود المبيعات",
  purchase_return:     "مردود المشتريات",
  journal_entry_type:  "سند قيد",
  stock_issue_items:   "سند صرف أصناف",
  stock_receipt_items: "سند توريد أصناف",
};

const POSTING_MODE_LABELS: Record<string, string> = {
  auto:     "تلقائي مع الحفظ",
  manual:   "يدوي",
  disabled: "محظور",
};

type JournalSetting = {
  id: number;
  name: string;
  code: string;
  docType: string;
  postingMode: string;
  allowUnpost: boolean;
  allowEditAfterPost: boolean;
};

export default function PostingSettingsPage() {
  const { data: journals = [], isLoading, refetch } = trpc.posting.listJournalSettings.useQuery();
  const updateMutation = trpc.posting.updateJournalSettings.useMutation({
    onSuccess: () => toast.success("تم حفظ إعدادات الترحيل"),
    onError: (e) => toast.error(`خطأ: ${e.message}`),
  });

  const [settings, setSettings] = useState<Record<number, Omit<JournalSetting, "id" | "name" | "code" | "docType">>>({});

  useEffect(() => {
    const init: typeof settings = {};
    journals.forEach(j => {
      init[j.id] = {
        postingMode: j.postingMode,
        allowUnpost: j.allowUnpost,
        allowEditAfterPost: j.allowEditAfterPost,
      };
    });
    setSettings(init);
  }, [journals]);

  const set = (id: number, key: string, value: any) => {
    setSettings(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const save = (j: JournalSetting) => {
    const s = settings[j.id];
    if (!s) return;
    updateMutation.mutate({
      journalId: j.id,
      postingMode: s.postingMode as any,
      allowUnpost: s.allowUnpost,
      allowEditAfterPost: s.allowEditAfterPost,
    });
  };

  // Group by docType
  const grouped = journals.reduce<Record<string, typeof journals>>((acc, j) => {
    const key = j.docType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(j);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="p-6 text-center text-slate-400" style={{ fontFamily: "'Cairo', Tahoma, sans-serif" }}>
      جاري تحميل إعدادات الترحيل...
    </div>
  );

  return (
    <div className="p-4" style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", fontSize: 12, direction: "rtl", maxWidth: 900 }}>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-[15px] font-bold text-slate-800">إعدادات ترحيل المستندات</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">
          حدد طريقة الترحيل وصلاحياته لكل دفتر مستندات
        </p>
      </div>

      {/* Philosophy */}
      <div className="mb-4 p-3 rounded" style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
        <div className="text-[11px] text-blue-700 font-semibold mb-1">فلسفة الترحيل في النظام</div>
        <div className="text-[11px] text-blue-600 space-y-0.5">
          <div>• <strong>تلقائي:</strong> يُرحَّل المستند فور حفظه دون تدخل المستخدم</div>
          <div>• <strong>يدوي:</strong> يحفظ المستند أولاً، ثم يُرحَّل بزر منفصل بعد المراجعة</div>
          <div>• <strong>محظور:</strong> لا يُسمح بترحيل هذا الدفتر (للمستندات الداخلية فقط)</div>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-8 text-slate-400 text-[12px]">
          لا توجد دفاتر مستندات معرَّفة. أضف دفاتر من الإعدادات → النظام → دفاتر المستندات
        </div>
      )}

      {Object.entries(grouped).map(([docType, docJournals]) => (
        <div key={docType} className="mb-4">
          <div className="text-[11px] font-bold text-slate-500 mb-1 px-1 uppercase tracking-wide">
            {DOC_TYPE_LABELS[docType] ?? docType}
          </div>
          <div className="border rounded overflow-hidden" style={{ borderColor: "#DDD8CE" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: "#F2F0EC", borderBottom: "1px solid #DDD8CE" }}>
                  <th className="text-right px-3 py-1.5 font-bold text-slate-600">الدفتر</th>
                  <th className="text-center px-3 py-1.5 font-bold text-slate-600 w-40">طريقة الترحيل</th>
                  <th className="text-center px-3 py-1.5 font-bold text-slate-600 w-28">إلغاء الترحيل</th>
                  <th className="text-center px-3 py-1.5 font-bold text-slate-600 w-32">تعديل بعد الترحيل</th>
                  <th className="px-3 py-1.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {docJournals.map((j, i) => {
                  const s = settings[j.id] ?? { postingMode: j.postingMode, allowUnpost: j.allowUnpost, allowEditAfterPost: j.allowEditAfterPost };
                  const modeColor = s.postingMode === 'auto' ? '#15803D' : s.postingMode === 'disabled' ? '#DC2626' : '#1D4ED8';
                  return (
                    <tr key={j.id} style={{
                      background: i % 2 === 0 ? "#fff" : "#FAFAF9",
                      borderBottom: i < docJournals.length - 1 ? "1px solid #F0EDE8" : "none",
                    }}>
                      <td className="px-3 py-1.5">
                        <div className="font-semibold text-slate-800">{j.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{j.code}</div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <select
                          value={s.postingMode}
                          onChange={e => set(j.id, "postingMode", e.target.value)}
                          className="classic-input text-center"
                          style={{ fontSize: 11, color: modeColor, fontWeight: 600, minWidth: 130 }}
                        >
                          <option value="manual">يدوي</option>
                          <option value="auto">تلقائي مع الحفظ</option>
                          <option value="disabled">محظور</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.allowUnpost}
                            onChange={e => set(j.id, "allowUnpost", e.target.checked)}
                          />
                          <span className="text-[10px] text-slate-600">مسموح</span>
                        </label>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.allowEditAfterPost}
                            onChange={e => set(j.id, "allowEditAfterPost", e.target.checked)}
                          />
                          <span className="text-[10px] text-slate-600">مسموح</span>
                        </label>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={() => save(j)}
                          disabled={updateMutation.isPending}
                          className="px-2 py-0.5 text-[10px] rounded font-semibold text-white transition-colors disabled:opacity-50"
                          style={{ background: "#406B93" }}
                        >
                          حفظ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
