import { useState, CSSProperties } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── أنواع العمليات ──────────────────────────────────────────────────────────
type OpType =
  | "post_purchases_inventory"   // ترحيل المشتريات للمخزون
  | "post_sales_cogs";           // ترحيل تكلفة المبيعات

const OP_LABELS: Record<OpType, string> = {
  post_purchases_inventory: "ترحيل المشتريات للمخزون",
  post_sales_cogs:          "ترحيل تكلفة المبيعات",
};

const OP_DESCRIPTIONS: Record<OpType, string> = {
  post_purchases_inventory:
    "يُحوِّل قيمة المشتريات المرحَّلة إلى حساب المخزون ويُصفِّر حساب المشتريات الوسيط.\nالقيد: مدين المخزون / دائن المشتريات",
  post_sales_cogs:
    "يُسجِّل تكلفة البضاعة المباعة ويُخفِّض حساب المخزون بقيمة التكلفة.\nالقيد: مدين تكلفة المبيعات / دائن المخزون",
};

// ── مكوّن اختيار حساب ───────────────────────────────────────────────────────
function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accounts: { id: number; code: string; name: string }[];
}) {
  const selStyle: CSSProperties = { direction: "rtl", textAlign: "right" };
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] font-semibold text-slate-600">{label}</Label>
      <Select value={value} onValueChange={onChange} dir="rtl">
        <SelectTrigger className="h-8 text-[12px]" style={selStyle}>
          <SelectValue placeholder="اختر حساباً..." />
        </SelectTrigger>
        <SelectContent style={selStyle}>
          {accounts.map(a => (
            <SelectItem key={a.id} value={String(a.id)} style={selStyle}>
              {a.code} — {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── الشاشة الرئيسية ─────────────────────────────────────────────────────────
export default function PostingOperationsPage() {
  const [op, setOp] = useState<OpType>("post_purchases_inventory");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [account1, setAccount1] = useState("");
  const [account2, setAccount2] = useState("");
  const [previewDone, setPreviewDone] = useState(false);

  const selStyle: CSSProperties = { direction: "rtl", textAlign: "right" };

  // جلب الحسابات (غير التجميعية النشطة)
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const accounts = (accountsData ?? []).filter(
    (a: any) => !a.isParent && a.isActive !== false && a.allowPosting !== false
  );

  // معاينة: ترحيل المشتريات للمخزون
  const previewPurchInv = trpc.posting.previewPostPurchasesToInventory.useQuery(
    { fromDate: fromDate || undefined, toDate: toDate || undefined },
    { enabled: op === "post_purchases_inventory" && previewDone }
  );

  // معاينة: ترحيل تكلفة المبيعات
  const previewSalesCogs = trpc.posting.previewPostSalesCOGS.useQuery(
    { fromDate: fromDate || undefined, toDate: toDate || undefined },
    { enabled: op === "post_sales_cogs" && previewDone }
  );

  // تنفيذ: ترحيل المشتريات للمخزون
  const execPurchInv = trpc.posting.postPurchasesToInventory.useMutation({
    onSuccess: (data) => {
      toast.success(
        `تم ترحيل ${data.count} فاتورة مشتريات للمخزون — القيد: ${data.entryNumber}`
      );
      setPreviewDone(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // تنفيذ: ترحيل تكلفة المبيعات
  const execSalesCogs = trpc.posting.postSalesCOGS.useMutation({
    onSuccess: (data) => {
      toast.success(
        `تم ترحيل تكلفة ${data.count} فاتورة مبيعات — القيد: ${data.entryNumber}`
      );
      setPreviewDone(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const currentPreview =
    op === "post_purchases_inventory" ? previewPurchInv.data : previewSalesCogs.data;

  const isRunning = execPurchInv.isPending || execSalesCogs.isPending;

  function handlePreview() {
    setPreviewDone(false);
    setTimeout(() => setPreviewDone(true), 50);
  }

  function handleExecute() {
    if (!account1 || !account2) {
      toast.error("يجب تحديد الحسابين قبل التنفيذ");
      return;
    }
    if (op === "post_purchases_inventory") {
      execPurchInv.mutate({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        inventoryAccountId: Number(account1),
        purchasesAccountId: Number(account2),
      });
    } else {
      execSalesCogs.mutate({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        cogsAccountId: Number(account1),
        inventoryAccountId: Number(account2),
      });
    }
  }

  const acct1Label =
    op === "post_purchases_inventory" ? "حساب المخزون (مدين)" : "حساب تكلفة المبيعات (مدين)";
  const acct2Label =
    op === "post_purchases_inventory" ? "حساب المشتريات (دائن)" : "حساب المخزون (دائن)";

  return (
    <div className="h-full flex flex-col bg-slate-50" dir="rtl">
      {/* رأس الشاشة */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-base font-bold select-none">
          ت
        </div>
        <div>
          <div className="text-[14px] font-bold text-slate-800">الترحيل المحاسبي والمخزني</div>
          <div className="text-[10px] text-slate-500">المرحلة الثانية — ترحيل تكلفة البضاعة</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex gap-4">
        {/* لوحة الإعدادات */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          {/* نوع العملية */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-3">
            <div className="text-[11px] font-bold text-slate-700 border-b pb-1.5">نوع عملية الترحيل</div>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(OP_LABELS) as OpType[]).map(k => (
                <button
                  key={k}
                  onClick={() => { setOp(k); setPreviewDone(false); }}
                  className={`text-[12px] text-right px-3 py-2 rounded-md border transition-all ${
                    op === k
                      ? "bg-amber-50 border-amber-400 text-amber-800 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {OP_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* نطاق التاريخ */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2.5">
            <div className="text-[11px] font-bold text-slate-700 border-b pb-1.5">نطاق التاريخ</div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-slate-600">من تاريخ</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-slate-600">إلى تاريخ</Label>
              <Input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="h-8 text-[12px]"
              />
            </div>
          </div>

          {/* الحسابات */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col gap-2.5">
            <div className="text-[11px] font-bold text-slate-700 border-b pb-1.5">الحسابات المحاسبية</div>
            <AccountSelect label={acct1Label} value={account1} onChange={setAccount1} accounts={accounts} />
            <AccountSelect label={acct2Label} value={account2} onChange={setAccount2} accounts={accounts} />
          </div>

          {/* أزرار */}
          <Button
            variant="outline"
            size="sm"
            className="text-[12px]"
            onClick={handlePreview}
          >
            معاينة المستندات
          </Button>
          <Button
            size="sm"
            className="text-[12px] bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleExecute}
            disabled={isRunning || !previewDone || !currentPreview?.count}
          >
            {isRunning ? "جاري الترحيل..." : `تنفيذ الترحيل (${currentPreview?.count ?? 0} مستند)`}
          </Button>
        </div>

        {/* منطقة المحتوى الرئيسية */}
        <div className="flex-1 flex flex-col gap-3">
          {/* وصف العملية */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-[12px] font-bold text-blue-800 mb-1">{OP_LABELS[op]}</div>
            <div className="text-[11px] text-blue-700 whitespace-pre-line">{OP_DESCRIPTIONS[op]}</div>
          </div>

          {/* نتائج المعاينة */}
          {previewDone && currentPreview && (
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
              {/* ملخص */}
              <div className="px-4 py-3 border-b bg-slate-50 flex gap-4 items-center">
                <div className="text-[12px] font-bold text-slate-700">
                  المستندات المؤهلة للترحيل:
                  <span className="mx-2 text-amber-600 text-[14px]">{currentPreview.count}</span>
                  مستند
                </div>
                <div className="text-[12px] text-slate-600">
                  الإجمالي:
                  <span className="mx-2 font-bold text-slate-800">
                    {Number(
                      op === "post_purchases_inventory"
                        ? (currentPreview as any).totalAmount
                        : (currentPreview as any).totalCost
                    ).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* جدول المستندات */}
              {currentPreview.count === 0 ? (
                <div className="text-center text-[12px] text-slate-500 py-8">
                  لا توجد مستندات مؤهلة في النطاق المحدد
                </div>
              ) : (
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600 border-b">#</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600 border-b">رقم المستند</th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600 border-b">
                          {op === "post_purchases_inventory" ? "المورد" : "العميل"}
                        </th>
                        <th className="text-right px-3 py-2 font-semibold text-slate-600 border-b">التاريخ</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-600 border-b">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPreview.invoices.map((inv: any, idx: number) => (
                        <tr key={inv.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                          <td className="px-3 py-1.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{inv.invoiceNumber}</td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {op === "post_purchases_inventory" ? inv.supplierName : inv.customerName}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {new Date(inv.invoiceDate).toLocaleDateString("ar-SA")}
                          </td>
                          <td className="px-3 py-1.5 text-left font-mono text-slate-700">
                            {Number(inv.subtotal).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!previewDone && (
            <div className="bg-white rounded-lg border border-dashed border-slate-300 flex items-center justify-center h-40 text-[12px] text-slate-400">
              اضغط "معاينة المستندات" لعرض المستندات المؤهلة للترحيل
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
