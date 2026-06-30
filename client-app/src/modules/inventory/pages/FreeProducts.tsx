import { useState } from "react";
import { fmtDate } from "@/shared/utils/dateUtils";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/core/ui/button";
import { Gift, Plus, Trash2, Edit, X, Save } from "lucide-react";

type FreeProductForm = {
  productCode: string;
  productName: string;
  unit: string;
  baseQty: string;
  freeQty: string;
  offerStart: string;
  offerEnd: string;
  notes: string;
};

const emptyForm: FreeProductForm = {
  productCode: "",
  productName: "",
  unit: "قطعة",
  baseQty: "1",
  freeQty: "1",
  offerStart: "",
  offerEnd: "",
  notes: "",
};

function CInput({ value, onChange, placeholder = "", type = "text", readOnly, className = "" }: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  type?: string; readOnly?: boolean; className?: string;
}) {
  return (
    <input
      type={type} value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder} readOnly={readOnly}
      className={`h-7 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full ${readOnly ? "bg-slate-50 dark:bg-slate-700 text-slate-500" : ""} ${className}`}
    />
  );
}

export default function FreeProducts() {
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FreeProductForm>(emptyForm);
  const set = (k: keyof FreeProductForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.freeProducts.list.useQuery();

  const createMutation = trpc.freeProducts.create.useMutation({
    onSuccess: () => { utils.freeProducts.list.invalidate(); toast.success("تمت الإضافة"); setIsAdding(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.freeProducts.update.useMutation({
    onSuccess: () => { utils.freeProducts.list.invalidate(); toast.success("تم التحديث"); setEditId(null); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.freeProducts.delete.useMutation({
    onSuccess: () => { utils.freeProducts.list.invalidate(); toast.success("تم الحذف"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.productName.trim()) { toast.error("اسم الصنف مطلوب"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate({ ...form });
    }
  };

  const openEdit = (row: any) => {
    setEditId(row.id);
    setForm({
      productCode: row.productCode ?? "",
      productName: row.productName ?? "",
      unit: row.unit ?? "قطعة",
      baseQty: row.baseQty ?? "1",
      freeQty: row.freeQty ?? "1",
      offerStart: row.offerStart ? new Date(row.offerStart).toISOString().slice(0, 10) : "",
      offerEnd: row.offerEnd ? new Date(row.offerEnd).toISOString().slice(0, 10) : "",
      notes: row.notes ?? "",
    });
    setIsAdding(true);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold">الأصناف المجانية</h2>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">عروض البيع</span>
        </div>
        <Button size="sm" className="gap-1 h-8" onClick={() => { setIsAdding(true); setEditId(null); setForm(emptyForm); }}>
          <Plus className="w-3.5 h-3.5" /> إضافة عرض
        </Button>
      </div>

      {isAdding && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/30 dark:bg-blue-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-400">
              {editId ? "تعديل العرض" : "إضافة عرض جديد"}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">كود الصنف</label>
              <CInput value={form.productCode} onChange={v => set("productCode", v)} placeholder="SKU-001" />
            </div>
            <div className="flex flex-col gap-0.5 col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">اسم الصنف <span className="text-red-500">*</span></label>
              <CInput value={form.productName} onChange={v => set("productName", v)} placeholder="اسم الصنف" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">الوحدة</label>
              <CInput value={form.unit} onChange={v => set("unit", v)} placeholder="قطعة" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">الكمية الأساسية</label>
              <CInput value={form.baseQty} onChange={v => set("baseQty", v)} type="number" placeholder="1" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">الكمية المجانية</label>
              <CInput value={form.freeQty} onChange={v => set("freeQty", v)} type="number" placeholder="1" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">بداية العرض</label>
              <CInput value={form.offerStart} onChange={v => set("offerStart", v)} type="date" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">نهاية العرض</label>
              <CInput value={form.offerEnd} onChange={v => set("offerEnd", v)} type="date" />
            </div>
            <div className="flex flex-col gap-0.5 col-span-2 md:col-span-4">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">ملاحظات</label>
              <CInput value={form.notes} onChange={v => set("notes", v)} placeholder="مثال: حبة مقابل حبة مجاناً — صالح لشهر رمضان" />
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button size="sm" className="gap-1 h-8" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save className="w-3.5 h-3.5" /> {editId ? "حفظ التعديل" : "إضافة"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => { setIsAdding(false); setEditId(null); setForm(emptyForm); }}>
              <X className="w-3.5 h-3.5" /> إلغاء
            </Button>
          </div>
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-8">#</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-24">كود الصنف</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">اسم الصنف</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-20">الوحدة</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">الكمية الأساسية</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-24">الكمية المجانية</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">بداية العرض</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">نهاية العرض</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 w-20">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">جاري التحميل...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Gift className="w-10 h-10 opacity-20" />
                    <p className="text-sm">لا توجد عروض مجانية. أضف عرضاً جديداً.</p>
                    <p className="text-xs">مثال: اشترِ 6 قطع واحصل على 1 مجاناً</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row: any, i: number) => {
                const now = new Date();
                const start = row.offerStart ? new Date(row.offerStart) : null;
                const end = row.offerEnd ? new Date(row.offerEnd) : null;
                const isActive = (!start || start <= now) && (!end || end >= now);
                return (
                  <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 ${!isActive ? "opacity-50" : ""}`}>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-400">{row.productCode || "—"}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">
                      {row.productName}
                      {isActive && <span className="mr-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">نشط</span>}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{row.unit || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-center text-slate-700 dark:text-slate-200">{Number(row.baseQty).toFixed(0)}</td>
                    <td className="px-3 py-1.5 font-mono text-center text-emerald-700 dark:text-emerald-400 font-semibold">{Number(row.freeQty).toFixed(0)}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{row.offerStart ? fmtDate(row.offerStart) : "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{row.offerEnd ? fmtDate(row.offerEnd) : "—"}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(row)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors" title="تعديل">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { if (confirm("حذف هذا العرض؟")) deleteMutation.mutate({ id: row.id }); }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-red-600 transition-colors" title="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
