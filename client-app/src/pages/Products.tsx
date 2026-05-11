import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  Edit,
  Layers,
  Maximize2,
  Minimize2,
  Package,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";

// =============================================
// نوع نموذج الصنف الكامل (6 تبويبات)
// =============================================
type ProductForm = {
  // التبويب 1 - النافذة الرئيسية
  name: string;
  name2: string;
  sku: string;
  itemType: string;
  groupId: string;
  categoryId: string;
  parentItem: string;
  // وحدات
  unit: string;
  unit2: string;
  unit3: string;
  conversionFactor: string;
  convFactor2: string;
  convFactor3: string;
  barcode: string;
  barcode2: string;
  barcode3: string;
  // فئات
  category1: string;
  category2: string;
  category3: string;
  // مواصفات
  distinguishNo: string;
  weight: string;
  size: string;
  colorCode: string;
  itemSize: string;
  // ضريبة
  taxType: string;
  prevTaxType: string;
  taxable: boolean;
  vatRate: string;
  // حقول قديمة
  nameEn: string;
  brand: string;
  model: string;
  description: string;
  purchaseUnit: string;
  saleUnit: string;
  minStock: string;
  maxStock: string;
  reorderPoint: string;
  trackBatch: boolean;
  trackSerial: boolean;
  hasBOM: boolean;
  // التبويب 2 - وصف إضافي
  extDesc1: string; extVal1: string;
  extDesc2: string; extVal2: string;
  extDesc3: string; extVal3: string;
  extDesc4: string; extVal4: string;
  extDesc5: string; extVal5: string;
  extDesc6: string; extVal6: string;
  // التبويب 3 - الأسعار
  purchasePrice: string;
  costPrice: string;
  salePrice: string;
  salePrice2: string;
  salePrice3: string;
  salePrice4: string;
  salePrice5: string;
  wholesalePrice: string;
  minSalePrice: string;
  priceIncludesTax: boolean;
  price1Tax: boolean;
  price2Tax: boolean;
  price3Tax: boolean;
  price4Tax: boolean;
  price5Tax: boolean;
  wholesaleTax: boolean;
  pricingPlan: string;
  // التبويب 4 - التكاليف
  stdCost: string;
  defaultSupplier: string;
  lastSupplier1: string;
  lastSupplier2: string;
  defaultOrderQty: string;
};

const emptyForm: ProductForm = {
  name: "", name2: "", sku: "", itemType: "مخزون",
  groupId: "", categoryId: "", parentItem: "",
  unit: "قطعة", unit2: "", unit3: "",
  conversionFactor: "1", convFactor2: "1", convFactor3: "1",
  barcode: "", barcode2: "", barcode3: "",
  category1: "", category2: "", category3: "",
  distinguishNo: "", weight: "", size: "", colorCode: "", itemSize: "",
  taxType: "", prevTaxType: "", taxable: true, vatRate: "15",
  nameEn: "", brand: "", model: "", description: "",
  purchaseUnit: "", saleUnit: "", minStock: "0", maxStock: "0", reorderPoint: "0",
  trackBatch: false, trackSerial: false, hasBOM: false,
  extDesc1: "", extVal1: "", extDesc2: "", extVal2: "",
  extDesc3: "", extVal3: "", extDesc4: "", extVal4: "",
  extDesc5: "", extVal5: "", extDesc6: "", extVal6: "",
  purchasePrice: "0", costPrice: "0", salePrice: "0",
  salePrice2: "0", salePrice3: "0", salePrice4: "0", salePrice5: "0",
  wholesalePrice: "0", minSalePrice: "0",
  priceIncludesTax: false,
  price1Tax: false, price2Tax: false, price3Tax: false, price4Tax: false, price5Tax: false, wholesaleTax: false,
  pricingPlan: "",
  stdCost: "0", defaultSupplier: "", lastSupplier1: "", lastSupplier2: "",
  defaultOrderQty: "0",
};

// =============================================
// حقل نموذج كلاسيكي
// =============================================
function CField({
  label,
  children,
  required,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}{required && <span className="text-red-500 mr-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// حقل نص كلاسيكي
function CInput({
  value,
  onChange,
  placeholder = "",
  type = "text",
  dir,
  readOnly,
  className = "",
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  dir?: "rtl" | "ltr";
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      dir={dir}
      readOnly={readOnly}
      className={`h-7 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${readOnly ? "bg-slate-50 dark:bg-slate-700 text-slate-500" : ""} ${className}`}
    />
  );
}

// =============================================
// بطاقة الصنف - 6 تبويبات كلاسيكية
// =============================================
function ProductCard({
  form,
  setForm,
  categories,
  groups,
  productId,
}: {
  form: ProductForm;
  setForm: (f: ProductForm) => void;
  categories: Array<{ id: number; name: string }> | undefined;
  groups: Array<{ id: number; groupCode?: string | null; name: string; groupType?: string | null; parentId?: number | null; autoNumbering?: boolean | null; codeDigits?: number | null }> | undefined;
  productId?: number | null;
}) {
  const [activeTab, setActiveTab] = useState<string>("main");
  const isEdit = !!productId;

  // ── Auto-generate SKU from group ─────────────────────────────────────────
  const { data: nextCode } = trpc.productGroups.nextCode.useQuery(
    { groupId: Number(form.groupId) },
    { enabled: !!form.groupId && !isEdit, staleTime: 0 }
  );

  useEffect(() => {
    if (!isEdit && nextCode) {
      setForm({ ...form, sku: nextCode });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCode, form.groupId]);

  // ── Build leaf group list (only groups with no children are selectable) ──
  const leafGroups = useMemo(() => {
    const allGroups = groups ?? [];
    const parentIds = new Set(allGroups.map(g => g.parentId).filter(Boolean));
    return allGroups.filter(g => !parentIds.has(g.id));
  }, [groups]);

  const { data: stockData, isLoading: loadingStock } = trpc.products.stockByWarehouse.useQuery(
    { productId: productId! },
    { enabled: isEdit && activeTab === "qty" }
  );
  const { data: costsData, isLoading: loadingCosts } = trpc.products.costHistory.useQuery(
    { productId: productId! },
    { enabled: isEdit && activeTab === "costs" }
  );
  const set = (key: keyof ProductForm, val: string | boolean) =>
    setForm({ ...form, [key]: val });

  const tabs = [
    { id: "main", label: "النافذة الرئيسية" },
    { id: "extra", label: "وصف إضافي" },
    { id: "prices", label: "الأسعار" },
    { id: "costs", label: "التكاليف" },
    { id: "qty", label: "كميات" },
    { id: "stats", label: "إحصائيات" },
  ];

  const groupName = groups?.find(g => g.id === Number(form.groupId))?.name;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* شريط التبويبات الكلاسيكي */}
      <div className="flex border-b border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-l border-slate-300 dark:border-slate-600 transition-colors
              ${activeTab === tab.id
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-b-2 border-b-blue-600 -mb-px"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* شريط المعلومات الثابت */}
      {(form.name || form.sku) && (
        <div className="flex-shrink-0 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 px-4 py-1.5 flex items-center gap-3 flex-wrap">
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{form.name || "—"}</span>
            {form.nameEn && <span className="text-xs text-slate-500 dark:text-slate-400">{form.nameEn}</span>}
          </div>
          {form.sku && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">{form.sku}</span>
          )}
          {groupName && (
            <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">{groupName}</span>
          )}
          {form.itemType && (
            <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{form.itemType}</span>
          )}
        </div>
      )}

      {/* محتوى التبويبات */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ===== التبويب 1: النافذة الرئيسية ===== */}
        {activeTab === "main" && (
          <div className="space-y-0 border border-slate-300 dark:border-slate-600 rounded overflow-hidden text-sm">

            {/* ── الصف العلوي: مواصفات | نوع ومجموعة ── */}
            <div className="flex border-b border-slate-300 dark:border-slate-600">

              {/* يمين: مواصفات — رقم، اسم 1، اسم 2 */}
              <div className="flex-1 border-l border-slate-300 dark:border-slate-600">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 border-b border-slate-300 dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">مواصفات</span>
                </div>
                {/* رقم */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-24 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">رقم</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <CInput value={form.sku} onChange={(v) => set("sku", v)} placeholder="SKU-001" className="w-full" />
                  </div>
                </div>
                {/* اسم 1 */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-24 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">إسم 1</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <CInput value={form.name} onChange={(v) => set("name", v)} placeholder="اسم الصنف بالعربية" className="w-full" />
                  </div>
                </div>
                {/* اسم 2 */}
                <div className="flex">
                  <div className="w-24 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">إسم 2</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <CInput value={form.name2} onChange={(v) => set("name2", v)} placeholder="English Name" dir="ltr" className="w-full" />
                  </div>
                </div>
              </div>

              {/* يسار: نوع السجل، رقم المجموعة، التصنيف، الصنف الرئيسي */}
              <div className="w-72 shrink-0">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 border-b border-slate-300 dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">نوع</span>
                </div>
                {/* نوع السجل */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">نوع السجل</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <select value={form.itemType} onChange={(e) => set("itemType", e.target.value)}
                      className="h-7 w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="مخزون">مخزون</option>
                      <option value="خدمة">خدمة</option>
                      <option value="مجموعة">مجموعة</option>
                      <option value="مركّب">مركّب</option>
                    </select>
                  </div>
                </div>
                {/* رقم المجموعة */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">رقم المجموعة</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <select value={form.groupId || "none"} onChange={(e) => set("groupId", e.target.value === "none" ? "" : e.target.value)}
                      className="h-7 w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="none">-- بدون --</option>
                      {leafGroups.map(g => (
                        <option key={g.id} value={String(g.id)}>
                          {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* التصنيف */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">التصنيف</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <select value={form.categoryId || "none"} onChange={(e) => set("categoryId", e.target.value === "none" ? "" : e.target.value)}
                      className="h-7 w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="none">-- بدون --</option>
                      {categories?.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* الصنف الرئيسي */}
                <div className="flex">
                  <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">الصنف الرئيسي</span>
                  </div>
                  <div className="flex-1 px-1 py-1">
                    <CInput value={form.parentItem} onChange={(v) => set("parentItem", v)} placeholder="" className="w-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── جدول الوحدات والباركود ── */}
            <div className="border-b border-slate-300 dark:border-slate-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600">
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 border-l border-slate-300 dark:border-slate-600">#</th>
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 border-l border-slate-300 dark:border-slate-600">وحدة</th>
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 w-32 border-l border-slate-300 dark:border-slate-600">م. تحويل</th>
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">باركود</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { num: 1, unit: form.unit, unitKey: "unit", conv: "1", convKey: null, bc: form.barcode, bcKey: "barcode" },
                    { num: 2, unit: form.unit2, unitKey: "unit2", conv: form.convFactor2, convKey: "convFactor2", bc: form.barcode2, bcKey: "barcode2" },
                    { num: 3, unit: form.unit3, unitKey: "unit3", conv: form.convFactor3, convKey: "convFactor3", bc: form.barcode3, bcKey: "barcode3" },
                  ].map((row) => (
                    <tr key={row.num} className="border-b border-slate-200 dark:border-slate-700">
                      <td className="text-center px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700">{row.num}</td>
                      <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                        <CInput value={row.unit} onChange={(v) => set(row.unitKey as keyof ProductForm, v)} placeholder={row.num === 1 ? "قطعة" : `وحدة ${row.num}`} className="w-full" />
                      </td>
                      <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                        {row.convKey
                          ? <CInput value={row.conv} onChange={(v) => set(row.convKey as keyof ProductForm, v)} type="number" className="w-full text-center" />
                          : <CInput value="1.000" readOnly className="w-full text-center bg-slate-50 dark:bg-slate-700 text-slate-500" />
                        }
                      </td>
                      <td className="px-1 py-1">
                        <CInput value={row.bc} onChange={(v) => set(row.bcKey as keyof ProductForm, v)} placeholder="" dir="ltr" className="w-full" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── الصف السفلي: فئات | مواصفات تفصيلية ── */}
            <div className="flex border-b border-slate-300 dark:border-slate-600">

              {/* يمين: فئات */}
              <div className="flex-1 border-l border-slate-300 dark:border-slate-600">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 border-b border-slate-300 dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">فئات</span>
                </div>
                {[
                  { label: "فئة 1", key: "category1" },
                  { label: "فئة 2", key: "category2" },
                  { label: "فئة 3", key: "category3" },
                ].map((r, i, arr) => (
                  <div key={r.key} className={`flex ${i < arr.length - 1 ? "border-b border-slate-200 dark:border-slate-700" : ""}`}>
                    <div className="w-20 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{r.label}</span>
                    </div>
                    <div className="flex-1 px-1 py-1">
                      <CInput value={(form as any)[r.key]} onChange={(v) => set(r.key as keyof ProductForm, v)} placeholder="" className="w-full" />
                    </div>
                  </div>
                ))}
              </div>

              {/* يسار: مواصفات تفصيلية */}
              <div className="w-72 shrink-0">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 border-b border-slate-300 dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">مواصفات</span>
                </div>
                {[
                  { label: "الرقم المميز", key: "distinguishNo", type: "text" },
                  { label: "وزن", key: "weight", type: "number" },
                  { label: "مقاس", key: "size", type: "text" },
                  { label: "نوع الكود", key: "colorCode", type: "text" },
                  { label: "لون", key: "colorCode", type: "text" },
                  { label: "حجم", key: "itemSize", type: "text" },
                ].map((r, i) => (
                  <div key={`${r.key}-${i}`} className={`flex ${i < 5 ? "border-b border-slate-200 dark:border-slate-700" : ""}`}>
                    <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-600 dark:text-slate-400">{r.label}</span>
                    </div>
                    <div className="flex-1 px-1 py-1">
                      <CInput value={(form as any)[r.key]} onChange={(v) => set(r.key as keyof ProductForm, v)} type={r.type} placeholder="" className="w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── نوع الضريبة ── */}
            <div className="flex">
              <div className="flex-1 border-l border-slate-300 dark:border-slate-600 flex">
                <div className="w-36 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-600 dark:text-slate-400">نوع الضريبة السابقة</span>
                </div>
                <div className="flex-1 px-1 py-1">
                  <CInput value={form.prevTaxType} onChange={(v) => set("prevTaxType", v)} placeholder="" className="w-full" />
                </div>
              </div>
              <div className="w-72 shrink-0 flex">
                <div className="w-28 shrink-0 bg-slate-50 dark:bg-slate-800 px-2 flex items-center border-l border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-600 dark:text-slate-400">نوع الضريبة</span>
                </div>
                <div className="flex-1 px-1 py-1">
                  <CInput value={form.vatRate} onChange={(v) => set("vatRate", v)} type="number" placeholder="15" className="w-full" />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===== التبويب 2: وصف إضافي ===== */}
        {activeTab === "extra" && (
          <div className="space-y-4">
            {/* الوصف العام */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">الوصف العام</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-3">
                <CField label="الوصف">
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="وصف الصنف..."
                  />
                </CField>
                <CField label="الماركة / الموديل">
                  <CInput value={form.brand} onChange={(v) => set("brand", v)} placeholder="الماركة" className="mb-1" />
                  <CInput value={form.model} onChange={(v) => set("model", v)} placeholder="الموديل" />
                </CField>
              </div>
            </div>

            {/* جدول الأوصاف الإضافية */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">أوصاف إضافية</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-8">#</th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">الوصف الإضافي</th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-3 py-1.5 text-xs text-slate-500">{i}</td>
                      <td className="px-3 py-1.5">
                        <CInput
                          value={(form as any)[`extDesc${i}`]}
                          onChange={(v) => set(`extDesc${i}` as keyof ProductForm, v)}
                          placeholder={`وصف إضافي ${i}`}
                          className="w-full"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <CInput
                          value={(form as any)[`extVal${i}`]}
                          onChange={(v) => set(`extVal${i}` as keyof ProductForm, v)}
                          placeholder="القيمة"
                          className="w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* خيارات المخزون */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">خيارات المخزون</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3">
                <CField label="الحد الأدنى">
                  <CInput value={form.minStock} onChange={(v) => set("minStock", v)} type="number" />
                </CField>
                <CField label="الحد الأقصى">
                  <CInput value={form.maxStock} onChange={(v) => set("maxStock", v)} type="number" />
                </CField>
                <CField label="نقطة إعادة الطلب">
                  <CInput value={form.reorderPoint} onChange={(v) => set("reorderPoint", v)} type="number" />
                </CField>
                <div className="flex items-center gap-2">
                  <Switch checked={form.trackBatch} onCheckedChange={(v) => set("trackBatch", v)} id="trackBatch" />
                  <label htmlFor="trackBatch" className="text-sm cursor-pointer">تتبع الدفعات</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.trackSerial} onCheckedChange={(v) => set("trackSerial", v)} id="trackSerial" />
                  <label htmlFor="trackSerial" className="text-sm cursor-pointer">تتبع التسلسلي</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.hasBOM} onCheckedChange={(v) => set("hasBOM", v)} id="hasBOM" />
                  <label htmlFor="hasBOM" className="text-sm cursor-pointer">قائمة مواد (BOM)</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== التبويب 3: الأسعار ===== */}
        {activeTab === "prices" && (
          <div className="space-y-4">
            {/* جدول الأسعار */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">جدول الأسعار</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">نوع السعر</th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-40">السعر</th>
                    <th className="text-center px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-24">يشمل ضريبة</th>
                    <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-24">الوحدة</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "سعر البيع 1 (الأساسي)", field: "salePrice", taxField: "price1Tax" },
                    { label: "سعر البيع 2", field: "salePrice2", taxField: "price2Tax" },
                    { label: "سعر البيع 3", field: "salePrice3", taxField: "price3Tax" },
                    { label: "سعر البيع 4", field: "salePrice4", taxField: "price4Tax" },
                    { label: "سعر البيع 5", field: "salePrice5", taxField: "price5Tax" },
                    { label: "سعر الجملة", field: "wholesalePrice", taxField: "wholesaleTax" },
                  ].map((row) => (
                    <tr key={row.field} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">{row.label}</td>
                      <td className="px-3 py-1.5">
                        <CInput
                          value={(form as any)[row.field]}
                          onChange={(v) => set(row.field as keyof ProductForm, v)}
                          type="number"
                          className="w-full"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={(form as any)[row.taxField]}
                          onChange={(e) => set(row.taxField as keyof ProductForm, e.target.checked)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-500">{form.unit || "قطعة"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* أقل سعر بيع وقواعد التسعير */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">قواعد التسعير</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3">
                <CField label="أقل سعر بيع (الحد الأدنى)">
                  <CInput value={form.minSalePrice} onChange={(v) => set("minSalePrice", v)} type="number" placeholder="0" />
                </CField>
                <CField label="خطة التسعير">
                  <CInput value={form.pricingPlan} onChange={(v) => set("pricingPlan", v)} placeholder="اختياري" />
                </CField>
                <div className="flex items-end gap-2 pb-0.5">
                  <Switch
                    checked={form.priceIncludesTax}
                    onCheckedChange={(v) => set("priceIncludesTax", v)}
                    id="priceIncludesTax"
                  />
                  <label htmlFor="priceIncludesTax" className="text-sm cursor-pointer">الأسعار تشمل الضريبة (افتراضي)</label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== التبويب 4: التكاليف ===== */}
        {activeTab === "costs" && (
          <div className="space-y-3">
            {/* رأس: الموردين + آخر مشتريات */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">بيانات الموردين</span>
                {isEdit && costsData?.lastVoucherDate && (
                  <span className="text-xs text-slate-500">آخر مشتروات: {new Date(costsData.lastVoucherDate).toLocaleDateString("ar-SA")}</span>
                )}
              </div>
              <div className="p-3 grid grid-cols-4 gap-2">
                <CField label="المورد الافتراضي">
                  <CInput value={form.defaultSupplier} onChange={(v) => set("defaultSupplier", v)} placeholder="—" />
                </CField>
                <CField label="آخر مورد 1">
                  {isEdit
                    ? <CInput value={costsData?.lastSupplierName ?? "—"} readOnly />
                    : <CInput value={form.lastSupplier1} onChange={(v) => set("lastSupplier1", v)} placeholder="—" />
                  }
                </CField>
                <CField label="آخر مورد 2">
                  <CInput value={form.lastSupplier2} onChange={(v) => set("lastSupplier2", v)} placeholder="—" />
                </CField>
                <CField label="كمية الطلب الافتراضية">
                  <CInput value={form.defaultOrderQty} onChange={(v) => set("defaultOrderQty", v)} type="number" placeholder="0.000" />
                </CField>
              </div>
            </div>

            {/* جدول التكاليف — قراءة فقط لصنف موجود */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">التكاليف</span>
                {isEdit && (
                  <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">محسوب آلياً من فواتير المشتريات</span>
                )}
              </div>
              {isEdit ? (
                loadingCosts ? (
                  <div className="p-4 text-center text-slate-400 text-sm">جاري التحميل...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-8">#</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">نوع التكلفة</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-36">وحدة 1</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-20">عملة</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-20">معدل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { num: 1, label: "آخر تكلفة", value: costsData?.lastCost ?? "0" },
                        { num: 2, label: "تكلفة سابقة", value: costsData?.prevCost ?? "0" },
                        { num: 3, label: "متوسط التكلفة", value: costsData?.avgCost ?? "0" },
                        { num: 4, label: "آخر طلبية", value: costsData?.lastOrderCost ?? "0" },
                        { num: 5, label: "تكلفة قياسية", value: costsData?.standardCost ?? "0" },
                      ].map(row => (
                        <tr key={row.num} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-1.5 text-xs text-slate-500">{row.num}</td>
                          <td className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">{row.label}</td>
                          <td className="px-3 py-1.5">
                            <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {Number(row.value).toFixed(4)}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">ر.س</td>
                          <td className="px-3 py-1.5 text-xs text-slate-500">1.0000</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <div className="p-4 text-center text-slate-400 text-sm">
                  <p>تُحسب التكاليف تلقائياً من فواتير المشتريات بعد حفظ الصنف.</p>
                  <p className="text-xs mt-1">النظام يستخدم <strong>متوسط سعر الشراء</strong> لتسعير المخزون.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== التبويب 5: كميات ===== */}
        {activeTab === "qty" && (
          <div className="space-y-3">
            {/* شريط الإجماليات */}
            {isEdit && (
              <div className="border border-slate-200 dark:border-slate-700 rounded">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">وحدة الكميات</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{form.unit || "قطعة"}</span>
                </div>
                <div className="p-3 grid grid-cols-4 gap-3">
                  {loadingStock ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                    ))
                  ) : (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الكميات</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">{Number(stockData?.total ?? 0).toFixed(3)}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded p-2 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">متوسط التكلفة</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">{Number(stockData?.avgCost ?? 0).toFixed(4)}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">محجوز للبيع</p>
                        <p className="text-lg font-bold text-slate-600 dark:text-slate-300 font-mono">0.000</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">مشتروات لم تستلم</p>
                        <p className="text-lg font-bold text-slate-600 dark:text-slate-300 font-mono">0.000</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* جدول الكميات حسب المخزن */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">الكميات حسب المخزن / الفرع</span>
              </div>
              {isEdit ? (
                loadingStock ? (
                  <div className="p-4 text-center text-slate-400 text-sm">جاري التحميل...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-8">#</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">اسم المخزن</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-32">الكمية الآنية</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-32">الكمية المرحلة</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">حد أقصى</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">حد الطلب</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-28">كمية الجرد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* صف الإجماليات */}
                      <tr className="border-b border-slate-200 dark:border-slate-600 bg-blue-50/50 dark:bg-blue-900/10 font-semibold">
                        <td className="px-3 py-1.5 text-xs text-slate-500">—</td>
                        <td className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-400">إجماليات</td>
                        <td className="px-3 py-1.5 font-mono text-sm text-blue-700 dark:text-blue-400">{Number(stockData?.total ?? 0).toFixed(3)}</td>
                        <td className="px-3 py-1.5 font-mono text-sm text-blue-700 dark:text-blue-400">{Number(stockData?.total ?? 0).toFixed(3)}</td>
                        <td className="px-3 py-1.5 font-mono text-sm text-slate-500">{Number(form.maxStock || 0).toFixed(3)}</td>
                        <td className="px-3 py-1.5 font-mono text-sm text-slate-500">{Number(form.minStock || 0).toFixed(3)}</td>
                        <td className="px-3 py-1.5 font-mono text-sm text-slate-500">0.000</td>
                      </tr>
                      {stockData?.rows?.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-sm">لا توجد كميات مسجلة بالمخازن</td>
                        </tr>
                      )}
                      {(stockData?.rows ?? []).map((row: any, i: number) => (
                        <tr key={row.warehouseId} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td>
                          <td className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300">{row.warehouseName}</td>
                          <td className="px-3 py-1.5 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">{Number(row.quantity).toFixed(3)}</td>
                          <td className="px-3 py-1.5 font-mono text-sm text-slate-600 dark:text-slate-300">{Number(row.quantity).toFixed(3)}</td>
                          <td className="px-3 py-1.5 font-mono text-sm text-slate-500">—</td>
                          <td className="px-3 py-1.5 font-mono text-sm text-slate-500">—</td>
                          <td className="px-3 py-1.5 font-mono text-sm text-slate-500">0.000</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <div className="p-4 text-center text-slate-400 text-sm">
                  <p>تُعرض الكميات بعد حفظ الصنف وربطه بالمخازن عبر سندات التوريد.</p>
                </div>
              )}
            </div>

            {/* حدود المخزون */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">حدود المخزون</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3">
                <CField label="الحد الأدنى (حد الطلب)">
                  <CInput value={form.minStock} onChange={(v) => set("minStock", v)} type="number" placeholder="0.000" />
                </CField>
                <CField label="الحد الأقصى">
                  <CInput value={form.maxStock} onChange={(v) => set("maxStock", v)} type="number" placeholder="0.000" />
                </CField>
                <CField label="نقطة إعادة الطلب">
                  <CInput value={form.reorderPoint} onChange={(v) => set("reorderPoint", v)} type="number" placeholder="0.000" />
                </CField>
              </div>
            </div>
          </div>
        )}

        {/* ===== التبويب 6: إحصائيات ===== */}
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">الإحصائيات الشهرية</span>
              </div>
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                <p>تُعرض الإحصائيات بعد تسجيل حركات المبيعات والمشتريات.</p>
                <p className="text-xs mt-1">الجدول الشهري: الفترة، مبيعات كميات/قيمة، مشتريات كميات/قيمة، هدف، %.</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ملخص الحركة</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">آخر مشتريات</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">—</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">آخر مبيعات</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">—</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-3 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">الكمية الآنية</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">—</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// =============================================
// المكوّن الرئيسي
// =============================================
export default function Products() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewTab, setViewTab] = useState<"products" | "categories">("products");
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [dialogSize, setDialogSize] = useState<"full" | "compact">("full");

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const utils = trpc.useUtils();

  const { data: products, isLoading } = trpc.products.list.useQuery(
    {
      search: search || undefined,
      categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
    },
    { staleTime: 10000 }
  );

  const { data: categories } = trpc.categories.list.useQuery(undefined, { staleTime: 60000 });
  const { data: groups } = trpc.productGroups.list.useQuery(undefined, { staleTime: 60000 });
  const { data: catProducts, isLoading: loadingCatProducts } = trpc.products.list.useQuery(
    { categoryId: selectedCatId ?? undefined },
    { staleTime: 10000, enabled: viewTab === "categories" }
  );

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("تم إضافة الصنف بنجاح");
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProduct = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("تم تحديث الصنف بنجاح");
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteProduct = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("تم حذف الصنف");
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name ?? "",
      name2: p.name2 ?? "",
      sku: p.sku ?? "",
      itemType: p.itemType ?? "مخزون",
      groupId: p.groupId ? String(p.groupId) : "",
      categoryId: p.categoryId ? String(p.categoryId) : "",
      parentItem: p.parentItem ? String(p.parentItem) : "",
      unit: p.unit ?? "قطعة",
      unit2: p.unit2 ?? "",
      unit3: p.unit3 ?? "",
      conversionFactor: p.conversionFactor ?? "1",
      convFactor2: p.convFactor2 ?? "1",
      convFactor3: p.convFactor3 ?? "1",
      barcode: p.barcode ?? "",
      barcode2: p.barcode2 ?? "",
      barcode3: p.barcode3 ?? "",
      category1: p.category1 ?? "",
      category2: p.category2 ?? "",
      category3: p.category3 ?? "",
      distinguishNo: p.distinguishNo ?? "",
      weight: p.weight ?? "",
      size: p.size ?? "",
      colorCode: p.colorCode ?? "",
      itemSize: p.itemSize ?? "",
      taxType: p.taxType ?? "",
      prevTaxType: p.prevTaxType ?? "",
      taxable: p.taxable ?? true,
      vatRate: p.vatRate ?? "15",
      nameEn: p.nameEn ?? "",
      brand: p.brand ?? "",
      model: p.model ?? "",
      description: p.description ?? "",
      purchaseUnit: p.purchaseUnit ?? "",
      saleUnit: p.saleUnit ?? "",
      minStock: String(p.minStock ?? 0),
      maxStock: String(p.maxStock ?? 0),
      reorderPoint: String(p.reorderPoint ?? 0),
      trackBatch: p.trackBatch ?? false,
      trackSerial: p.trackSerial ?? false,
      hasBOM: p.hasBOM ?? false,
      extDesc1: p.extDesc1 ?? "", extVal1: p.extVal1 ?? "",
      extDesc2: p.extDesc2 ?? "", extVal2: p.extVal2 ?? "",
      extDesc3: p.extDesc3 ?? "", extVal3: p.extVal3 ?? "",
      extDesc4: p.extDesc4 ?? "", extVal4: p.extVal4 ?? "",
      extDesc5: p.extDesc5 ?? "", extVal5: p.extVal5 ?? "",
      extDesc6: p.extDesc6 ?? "", extVal6: p.extVal6 ?? "",
      purchasePrice: p.purchasePrice ?? "0",
      costPrice: p.costPrice ?? "0",
      salePrice: p.salePrice ?? "0",
      salePrice2: p.salePrice2 ?? "0",
      salePrice3: p.salePrice3 ?? "0",
      salePrice4: p.salePrice4 ?? "0",
      salePrice5: p.salePrice5 ?? "0",
      wholesalePrice: p.wholesalePrice ?? "0",
      minSalePrice: p.minSalePrice ?? "0",
      priceIncludesTax: p.priceIncludesTax ?? false,
      price1Tax: p.price1Tax ?? false,
      price2Tax: p.price2Tax ?? false,
      price3Tax: p.price3Tax ?? false,
      price4Tax: p.price4Tax ?? false,
      price5Tax: p.price5Tax ?? false,
      wholesaleTax: p.wholesaleTax ?? false,
      pricingPlan: p.pricingPlan ?? "",
      stdCost: p.stdCost ?? "0",
      defaultSupplier: p.defaultSupplier ?? "",
      lastSupplier1: p.lastSupplier1 ?? "",
      lastSupplier2: p.lastSupplier2 ?? "",
      defaultOrderQty: p.defaultOrderQty ?? "0",
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("اسم الصنف مطلوب");
      return;
    }
    if (form.salePrice === "" || Number(form.salePrice) < 0) {
      toast.error("سعر البيع مطلوب");
      return;
    }

    const data = {
      name: form.name.trim(),
      name2: form.name2.trim() || undefined,
      nameEn: form.nameEn.trim() || undefined,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      barcode2: form.barcode2.trim() || undefined,
      barcode3: form.barcode3.trim() || undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      groupId: form.groupId ? Number(form.groupId) : undefined,
      parentItem: form.parentItem ? Number(form.parentItem) : undefined,
      brand: form.brand.trim() || undefined,
      model: form.model.trim() || undefined,
      description: form.description.trim() || undefined,
      itemType: form.itemType || "مخزون",
      unit: form.unit || "قطعة",
      unit2: form.unit2.trim() || undefined,
      unit3: form.unit3.trim() || undefined,
      purchaseUnit: form.purchaseUnit.trim() || undefined,
      saleUnit: form.saleUnit.trim() || undefined,
      conversionFactor: form.conversionFactor || "1",
      convFactor2: form.convFactor2 || "1",
      convFactor3: form.convFactor3 || "1",
      category1: form.category1.trim() || undefined,
      category2: form.category2.trim() || undefined,
      category3: form.category3.trim() || undefined,
      distinguishNo: form.distinguishNo.trim() || undefined,
      weight: form.weight.trim() || undefined,
      size: form.size.trim() || undefined,
      colorCode: form.colorCode.trim() || undefined,
      itemSize: form.itemSize.trim() || undefined,
      taxType: form.taxType.trim() || undefined,
      prevTaxType: form.prevTaxType.trim() || undefined,
      minStock: Number(form.minStock) || 0,
      maxStock: Number(form.maxStock) || 0,
      reorderPoint: Number(form.reorderPoint) || 0,
      trackBatch: form.trackBatch,
      trackSerial: form.trackSerial,
      hasBOM: form.hasBOM,
      extDesc1: form.extDesc1.trim() || undefined, extVal1: form.extVal1.trim() || undefined,
      extDesc2: form.extDesc2.trim() || undefined, extVal2: form.extVal2.trim() || undefined,
      extDesc3: form.extDesc3.trim() || undefined, extVal3: form.extVal3.trim() || undefined,
      extDesc4: form.extDesc4.trim() || undefined, extVal4: form.extVal4.trim() || undefined,
      extDesc5: form.extDesc5.trim() || undefined, extVal5: form.extVal5.trim() || undefined,
      extDesc6: form.extDesc6.trim() || undefined, extVal6: form.extVal6.trim() || undefined,
      purchasePrice: form.purchasePrice || "0",
      costPrice: form.costPrice || "0",
      salePrice: form.salePrice || "0",
      salePrice2: form.salePrice2 || "0",
      salePrice3: form.salePrice3 || "0",
      salePrice4: form.salePrice4 || "0",
      salePrice5: form.salePrice5 || "0",
      wholesalePrice: form.wholesalePrice || "0",
      minSalePrice: form.minSalePrice || "0",
      priceIncludesTax: form.priceIncludesTax,
      pricingPlan: form.pricingPlan.trim() || undefined,
      stdCost: form.stdCost || "0",
      defaultSupplier: form.defaultSupplier.trim() || undefined,
      lastSupplier1: form.lastSupplier1.trim() || undefined,
      lastSupplier2: form.lastSupplier2.trim() || undefined,
      defaultOrderQty: form.defaultOrderQty || "0",
      vatRate: form.vatRate || "15",
      taxable: form.taxable,
    };

    if (editId) {
      updateProduct.mutate({ id: editId, ...data });
    } else {
      createProduct.mutate(data);
    }
  };

  const formatCurrency = (val: string | number | null) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(
      Number(val ?? 0)
    );

  const getCategoryName = (id: number | null) =>
    categories?.find((c) => c.id === id)?.name ?? "—";
  const getGroupName = (id: number | null) => {
    const g = (groups as any[])?.find((g: any) => g.id === id);
    return g ? (g.groupCode ? `[${g.groupCode}] ${g.name}` : g.name) : "—";
  };

  const sortedProducts = useMemo(() => {
    let list = [...(products ?? [])];
    if (groupFilter !== "all") list = list.filter((p: any) => String(p.groupId ?? "") === groupFilter);
    list.sort((a: any, b: any) => {
      let av = a[sortField] ?? "";
      let bv = b[sortField] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [products, groupFilter, sortField, sortDir]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            دليل الأصناف
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            إدارة وتنظيم أصناف المخزون
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة صنف جديد
        </Button>
      </div>

      {/* تبويبات العرض */}
      <div className="flex border-b border-border bg-muted/10">
        <button
          onClick={() => setViewTab("products")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            viewTab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          حسب الأصناف
          {products && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
              {products.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewTab("categories")}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            viewTab === "categories" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag className="w-4 h-4" />
          حسب الفئات
          {categories && (
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
              {categories.length}
            </span>
          )}
        </button>
      </div>

      {/* ===== تبويب حسب الأصناف ===== */}
      {viewTab === "products" && (
        <>
      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الباركود أو الكود..."
                className="pr-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="كل التصنيفات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="كل المجموعات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المجموعات</SelectItem>
                {(groups as any[])?.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="w-4 h-4 text-primary" />
            قائمة الأصناف
            {products && (
              <Badge variant="secondary" className="mr-auto text-xs">
                {products.length} صنف
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("sku")}>
                  <span className="flex items-center gap-1">الكود {sortField === "sku" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">اسم الصنف {sortField === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right">الباركود</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("categoryId")}>
                  <span className="flex items-center gap-1">التصنيف {sortField === "categoryId" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("groupId")}>
                  <span className="flex items-center gap-1">المجموعة {sortField === "groupId" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right">الوحدة</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("costPrice")}>
                  <span className="flex items-center gap-1">التكلفة {sortField === "costPrice" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => toggleSort("salePrice")}>
                  <span className="flex items-center gap-1">سعر البيع {sortField === "salePrice" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !products?.length ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>لا توجد أصناف</p>
                    <p className="text-xs mt-1">اضغط "إضافة صنف جديد" للبدء</p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedProducts.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell
                      className="font-mono text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                      onClick={() => openEdit(p)}
                    >
                      {p.sku ?? "—"}
                    </TableCell>
                    <TableCell
                      className="font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={() => openEdit(p)}
                    >
                      <div>
                        <p>{p.name}</p>
                        {p.name2 && (
                          <p className="text-xs text-muted-foreground font-normal" dir="ltr">{p.name2}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {p.barcode ?? "—"}
                    </TableCell>
                    <TableCell>{getCategoryName(p.categoryId)}</TableCell>
                    <TableCell className="text-xs">{getGroupName(p.groupId)}</TableCell>
                    <TableCell>{p.unit}</TableCell>
                    <TableCell>{formatCurrency(p.costPrice ?? 0)}</TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatCurrency(p.salePrice)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {p.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(p)}
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("هل تريد حذف هذا الصنف؟")) {
                              deleteProduct.mutate({ id: p.id });
                            }
                          }}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      </>
      )}

      {/* ===== تبويب حسب الفئات ===== */}
      {viewTab === "categories" && (
        <div className="flex gap-4">
          {/* قائمة الفئات */}
          <div className="w-56 shrink-0 border border-border rounded-lg overflow-hidden bg-card">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-bold">الفئات</span>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <button
                onClick={() => setSelectedCatId(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right ${
                  selectedCatId === null ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                الكل
                {products && (
                  <span className="mr-auto text-[10px] bg-muted rounded-full px-1.5">{products.length}</span>
                )}
              </button>
              {categories?.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right ${
                    selectedCatId === cat.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
          {/* جدول الأصناف حسب الفئة */}
          <div className="flex-1">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Archive className="w-4 h-4 text-primary" />
                  {selectedCatId === null
                    ? "جميع الأصناف"
                    : categories?.find((c: any) => c.id === selectedCatId)?.name ?? "الفئة المختارة"}
                  <Badge variant="secondary" className="mr-auto text-xs">
                    {(selectedCatId === null ? products : catProducts)?.length ?? 0} صنف
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">اسم الصنف</TableHead>
                      <TableHead className="text-right">الوحدة</TableHead>
                      <TableHead className="text-right">التكلفة</TableHead>
                      <TableHead className="text-right">سعر البيع</TableHead>
                      <TableHead className="text-right w-20">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCatProducts ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : !(selectedCatId === null ? products : catProducts)?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">لا توجد أصناف في هذه الفئة</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selectedCatId === null ? products : catProducts)?.map((p: any) => (
                        <TableRow key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(p)}>
                          <TableCell className="font-mono text-xs text-blue-600 dark:text-blue-400">{p.sku ?? "—"}</TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <p>{p.name}</p>
                              {p.name2 && <p className="text-xs text-muted-foreground">{p.name2}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{p.unit}</TableCell>
                          <TableCell>{formatCurrency(p.costPrice ?? 0)}</TableCell>
                          <TableCell className="font-semibold text-primary">{formatCurrency(p.salePrice)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(p); }} title="تعديل">
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); if (confirm("هل تريد حذف هذا الصنف؟")) deleteProduct.mutate({ id: p.id }); }} title="حذف">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===== Dialog كارت الصنف — يملأ منطقة المحتوى بالكامل ===== */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && setIsOpen(false)}>
        <DialogContent
          showCloseButton={false}
          className="inset-0 flex flex-col p-0 gap-0 overflow-hidden shadow-xl"
          style={dialogSize === "full" ? {
            position: "fixed",
            top: "56px",
            bottom: "16px",
            left: "8px",
            right: "var(--sidebar-width, 260px)",
            width: "auto",
            height: "auto",
            maxWidth: "none",
            transform: "none",
            borderRadius: "6px",
          } : {
            position: "fixed",
            top: "90px",
            bottom: "60px",
            left: "6%",
            right: "calc(var(--sidebar-width, 260px) + 6%)",
            width: "auto",
            height: "auto",
            maxWidth: "none",
            transform: "none",
            borderRadius: "8px",
          }}
          dir="rtl"
        >
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-2.5 border-b border-border bg-slate-100 dark:bg-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-700 dark:text-slate-200">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {editId ? `تعديل بيانات الصنف${form.sku ? ` - ${form.sku}` : ""}` : "إضافة صنف جديد"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createProduct.isPending || updateProduct.isPending}
                className="gap-1 h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {createProduct.isPending || updateProduct.isPending
                  ? "جارِ الحفظ..."
                  : editId ? "حفظ التعديلات" : "إضافة الصنف"}
              </Button>
              <Button
                variant="outline" size="icon"
                className="h-8 w-8 shrink-0"
                title={dialogSize === "full" ? "تصغير النافذة" : "تكبير النافذة"}
                onClick={() => setDialogSize(s => s === "full" ? "compact" : "full")}
              >
                {dialogSize === "full"
                  ? <Minimize2 className="w-3.5 h-3.5" />
                  : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setIsOpen(false)}>
                <X className="w-3.5 h-3.5" />
                إغلاق
              </Button>
            </div>
          </DialogHeader>
          {/* محتوى الكارت */}
          <div className="flex-1 overflow-hidden">
            <ProductCard
              form={form}
              setForm={setForm}
              categories={categories}
              groups={groups as any}
              productId={editId}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
