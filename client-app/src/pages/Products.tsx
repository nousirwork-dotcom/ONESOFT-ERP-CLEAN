import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
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
import { useState, useMemo, useEffect, useRef } from "react";
import { useWorkspaceEl } from "@/contexts/WorkspaceContext";
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
  // وحدات/فئات إضافية (JSON)
  unitsJson: string;
  catsJson: string;
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
  unitsJson: "", catsJson: "",
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isEdit = !!productId;

  // ── Imperative auto-code generation on group select ──────────────────────
  const trpcUtils = trpc.useUtils();
  const [skuLoading, setSkuLoading] = useState(false);

  const handleGroupSelect = async (groupId: string) => {
    // Update groupId immediately; only clear sku when creating new product
    setForm(prev => ({ ...prev, groupId, ...(isEdit ? {} : { sku: "" }) }));
    if (!groupId || isEdit) return;
    setSkuLoading(true);
    try {
      // staleTime: 0 forces a fresh server fetch every time (bypass cache)
      const code = await trpcUtils.productGroups.nextCode.fetch(
        { groupId: Number(groupId) },
        { staleTime: 0 }
      );
      console.log("[handleGroupSelect] groupId:", groupId, "→ code:", code);
      if (code) {
        setForm(prev => ({ ...prev, sku: code }));
      } else {
        toast.warning("لم يتمكن النظام من توليد كود تلقائي لهذه المجموعة — أدخل الكود يدوياً");
      }
    } catch (err: any) {
      console.error("[handleGroupSelect] fetch error:", err?.message ?? err);
      toast.error("فشل توليد كود الصنف — " + (err?.message ?? "تحقق من إعدادات المجموعة"));
    } finally {
      setSkuLoading(false);
    }
  };

  // ── Build leaf group list (only groups with no children are selectable) ──
  const leafGroups = useMemo(() => {
    const allGroups = groups ?? [];
    const parentIds = new Set(allGroups.map(g => g.parentId).filter(Boolean));
    return allGroups.filter(g => !parentIds.has(g.id));
  }, [groups]);

  // ── Units list from DB ────────────────────────────────────────────────────
  const { data: unitsList, refetch: refetchUnits } = trpc.units.list.useQuery(undefined, { staleTime: 30000 });
  const createUnitMutation = trpc.units.create.useMutation();

  type UnitRow = { unit: string; conv: string; barcode: string };
  const [unitRows, setUnitRows] = useState<UnitRow[]>(() => {
    const rows: UnitRow[] = [{ unit: form.unit || "", conv: "1", barcode: form.barcode || "" }];
    if (form.unit2) rows.push({ unit: form.unit2, conv: form.convFactor2 || "1", barcode: form.barcode2 || "" });
    if (form.unit3) rows.push({ unit: form.unit3, conv: form.convFactor3 || "1", barcode: form.barcode3 || "" });
    return rows;
  });
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [addingToRow, setAddingToRow] = useState(0);

  const syncRows = (next: UnitRow[]) => {
    setUnitRows(next);
    setForm(prev => ({
      ...prev,
      unit:         next[0]?.unit    || "",
      barcode:      next[0]?.barcode || "",
      unit2:        next[1]?.unit    || "",
      barcode2:     next[1]?.barcode || "",
      convFactor2:  next[1]?.conv    || "1",
      unit3:        next[2]?.unit    || "",
      barcode3:     next[2]?.barcode || "",
      convFactor3:  next[2]?.conv    || "1",
      unitsJson:    next.length > 1 ? JSON.stringify(next) : "",
    }));
  };
  const updateUnitRow = (idx: number, field: keyof UnitRow, value: string) =>
    syncRows(unitRows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const addUnitRow = () => {
    syncRows([...unitRows, { unit: "", conv: "1", barcode: "" }]);
  };
  const removeUnitRow = (idx: number) => {
    if (unitRows.length <= 1) return;
    syncRows(unitRows.filter((_, i) => i !== idx));
  };
  const handleQuickAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      const u = await createUnitMutation.mutateAsync({ name: newUnitName.trim() });
      await refetchUnits();
      updateUnitRow(addingToRow, "unit", u.name);
      setNewUnitName("");
      setAddUnitOpen(false);
    } catch {
      toast.error("فشل إضافة الوحدة");
    }
  };

  // ── Categories dynamic rows ───────────────────────────────────────────────
  const createCatMutation = trpc.categories.create.useMutation();
  const [catRows, setCatRows] = useState<string[]>(() => {
    const rows: string[] = [form.category1 || ""];
    if (form.category2) rows.push(form.category2);
    if (form.category3) rows.push(form.category3);
    return rows;
  });
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingToCatRow, setAddingToCatRow] = useState(0);

  const syncCatRows = (next: string[]) => {
    setCatRows(next);
    setForm(prev => ({
      ...prev,
      category1: next[0] || "",
      category2: next[1] || "",
      category3: next[2] || "",
      catsJson:  next.length > 1 ? JSON.stringify(next) : "",
    }));
  };
  const updateCatRow = (idx: number, value: string) =>
    syncCatRows(catRows.map((r, i) => i === idx ? value : r));
  const addCatRow = () => {
    syncCatRows([...catRows, ""]);
  };
  const removeCatRow = (idx: number) => {
    if (catRows.length <= 1) return;
    syncCatRows(catRows.filter((_, i) => i !== idx));
  };
  const handleQuickAddCat = async () => {
    if (!newCatName.trim()) return;
    try {
      const c = await createCatMutation.mutateAsync({ name: newCatName.trim() });
      await trpcUtils.categories.list.invalidate();
      updateCatRow(addingToCatRow, c.name);
      setNewCatName("");
      setAddCatOpen(false);
    } catch {
      toast.error("فشل إضافة الفئة");
    }
  };

  // ── Extra description dynamic rows ───────────────────────────────────────
  const [extRows, setExtRows] = useState<{ desc: string; val: string }[]>(() => {
    const rows: { desc: string; val: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = (form as any)[`extDesc${i}`] ?? "";
      const v = (form as any)[`extVal${i}`] ?? "";
      if (i === 1 || d || v) rows.push({ desc: d, val: v });
    }
    return rows.length ? rows : [{ desc: "", val: "" }];
  });

  const syncExtRows = (next: { desc: string; val: string }[]) => {
    setExtRows(next);
    const patch: Partial<ProductForm> = {};
    for (let i = 1; i <= 6; i++) {
      (patch as any)[`extDesc${i}`] = next[i - 1]?.desc ?? "";
      (patch as any)[`extVal${i}`] = next[i - 1]?.val ?? "";
    }
    setForm(prev => ({ ...prev, ...patch }));
  };
  const updateExtRow = (idx: number, field: "desc" | "val", value: string) =>
    syncExtRows(extRows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const addExtRow = () => syncExtRows([...extRows, { desc: "", val: "" }]);
  const removeExtRow = (idx: number) => {
    if (extRows.length <= 1) return;
    syncExtRows(extRows.filter((_, i) => i !== idx));
  };

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
      <div className="flex border-b border-[#CFCFCF] dark:border-slate-600 bg-[#E8E1D3] dark:bg-slate-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-l border-[#CFCFCF] dark:border-slate-600 transition-colors
              ${activeTab === tab.id
                ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-b-2 border-b-blue-600 -mb-px"
                : "text-[#444] dark:text-slate-400 hover:bg-[#DDD4C4] dark:hover:bg-slate-700"
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

      {/* ── الصف الثابت: مواصفات + نوع (يظهر في كل التبويبات) ── */}
      <div className="flex-shrink-0 border-b border-slate-300 dark:border-slate-600 text-sm">
        <div className="flex">

          {/* يمين: مواصفات — رقم، اسم 1، اسم 2 */}
          <div className="flex-1 border-l border-slate-300 dark:border-slate-600">
            <div className="bg-[#EDE7DF] dark:bg-blue-900/20 px-2 py-0.5 border-b border-[#D6CFC6] dark:border-slate-600 text-center">
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">مواصفات</span>
            </div>
            {/* رقم */}
            {(() => {
              const selGroup = form.groupId ? leafGroups.find(g => String(g.id) === form.groupId) : null;
              const autoNum = selGroup?.autoNumbering ?? false;
              return (
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <div className="w-24 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                    <span className="text-xs text-slate-600 dark:text-slate-400">رقم</span>
                  </div>
                  <div className="flex-1 px-1 py-1 relative">
                    {skuLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/70 dark:bg-slate-800/70 rounded">
                        <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <CInput
                      value={form.sku}
                      onChange={(v) => { if (!autoNum || isEdit) set("sku", v); }}
                      placeholder={autoNum && !isEdit ? "يُولَّد تلقائياً..." : "SKU-001"}
                      className={`w-full ${autoNum && !isEdit ? "bg-slate-100 dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-mono font-semibold cursor-not-allowed" : ""}`}
                      readOnly={autoNum && !isEdit}
                    />
                  </div>
                </div>
              );
            })()}
            {/* اسم 1 */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <div className="w-24 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">إسم 1</span>
              </div>
              <div className="flex-1 px-1 py-1">
                <CInput value={form.name} onChange={(v) => set("name", v)} placeholder="اسم الصنف بالعربية" className="w-full" />
              </div>
            </div>
            {/* اسم 2 */}
            <div className="flex">
              <div className="w-24 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">إسم 2</span>
              </div>
              <div className="flex-1 px-1 py-1">
                <CInput value={form.name2} onChange={(v) => set("name2", v)} placeholder="English Name" dir="ltr" className="w-full" />
              </div>
            </div>
          </div>

          {/* يسار: نوع السجل، رقم المجموعة، الصنف الرئيسي */}
          <div className="w-72 shrink-0">
            <div className="bg-[#EDE7DF] dark:bg-blue-900/20 px-2 py-0.5 border-b border-[#D6CFC6] dark:border-slate-600 text-center">
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">نوع</span>
            </div>
            {/* نوع السجل */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <div className="w-28 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">نوع السجل</span>
              </div>
              <div className="flex-1 px-1 py-1">
                <select value={form.itemType} onChange={(e) => set("itemType", e.target.value)}
                  className="h-7 w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500">
                  <option value="مخزون">مخزون</option>
                  <option value="خدمة">خدمة</option>
                  <option value="تجميع">تجميع</option>
                  <option value="صنف مصنوع">صنف مصنوع</option>
                  <option value="تصنيع المخزون">تصنيع المخزون</option>
                  <option value="تصنيع للعميل">تصنيع للعميل</option>
                  <option value="صنف مصنع">صنف مصنع</option>
                </select>
              </div>
            </div>
            {/* رقم المجموعة */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <div className="w-28 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">رقم المجموعة</span>
              </div>
              <div className="flex-1 px-1 py-1">
                <select
                  value={form.groupId || "none"}
                  onChange={(e) => handleGroupSelect(e.target.value === "none" ? "" : e.target.value)}
                  disabled={skuLoading}
                  className="h-7 w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                >
                  <option value="none">-- بدون --</option>
                  {leafGroups.map(g => (
                    <option key={g.id} value={String(g.id)}>
                      {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* الصنف الرئيسي */}
            <div className="flex">
              <div className="w-28 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-400">الصنف الرئيسي</span>
              </div>
              <div className="flex-1 px-1 py-1">
                <CInput value={form.parentItem} onChange={(v) => set("parentItem", v)} placeholder="" className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* محتوى التبويبات */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* ===== التبويب 1: النافذة الرئيسية ===== */}
        {activeTab === "main" && (
          <div className="space-y-0 border border-slate-300 dark:border-slate-600 rounded overflow-hidden text-sm">

            {/* ── جدول الوحدات والباركود (ديناميكي) ── */}
            <div className="border-b border-slate-300 dark:border-slate-600">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600">
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 border-l border-slate-300 dark:border-slate-600">#</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 border-l border-slate-300 dark:border-slate-600">وحدة</th>
                    <th className="text-center px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 w-28 border-l border-slate-300 dark:border-slate-600">م. تحويل</th>
                    <th className="text-right px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 border-l border-slate-300 dark:border-slate-600">باركود</th>
                    <th className="w-8 border-l border-slate-300 dark:border-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                      {/* رقم */}
                      <td className="text-center px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700">
                        {idx + 1}
                      </td>
                      {/* اختيار الوحدة */}
                      <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1">
                          <select
                            value={row.unit}
                            onChange={(e) => updateUnitRow(idx, "unit", e.target.value)}
                            className="h-7 flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- اختر --</option>
                            {unitsList?.map(u => (
                              <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            title="إضافة وحدة جديدة"
                            onClick={() => { setAddingToRow(idx); setNewUnitName(""); setAddUnitOpen(true); }}
                            className="h-7 w-7 shrink-0 flex items-center justify-center rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-bold"
                          >+</button>
                        </div>
                      </td>
                      {/* معامل التحويل */}
                      <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                        {idx === 0
                          ? <CInput value="1.000" readOnly className="w-full text-center bg-slate-50 dark:bg-slate-700 text-slate-500" />
                          : <CInput value={row.conv} onChange={(v) => updateUnitRow(idx, "conv", v)} type="number" className="w-full text-center" />
                        }
                      </td>
                      {/* باركود */}
                      <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                        <CInput value={row.barcode} onChange={(v) => updateUnitRow(idx, "barcode", v)} placeholder="" dir="ltr" className="w-full" />
                      </td>
                      {/* حذف */}
                      <td className="px-1 py-1 text-center border-l border-slate-200 dark:border-slate-700">
                        {unitRows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeUnitRow(idx)}
                            className="h-6 w-6 flex items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 mx-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : <span className="block w-6" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* زر إضافة وحدة أخرى */}
              <button
                type="button"
                onClick={addUnitRow}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50 border-t border-dashed border-slate-300 dark:border-slate-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة وحدة أخرى
              </button>
            </div>

            {/* ── Dialog إضافة وحدة جديدة ── */}
            <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
              <DialogContent className="max-w-sm" dir="rtl">
                <DialogHeader>
                  <DialogTitle className="text-right">إضافة وحدة جديدة</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <input
                    type="text"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickAddUnit()}
                    placeholder="اسم الوحدة (مثال: كرتون، لتر، كيلو...)"
                    autoFocus
                    className="w-full h-9 text-sm border border-slate-300 dark:border-slate-600 rounded px-3 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setAddUnitOpen(false)}>إلغاء</Button>
                    <Button
                      size="sm"
                      onClick={handleQuickAddUnit}
                      disabled={!newUnitName.trim() || createUnitMutation.isPending}
                    >
                      {createUnitMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* ── الصف السفلي: فئات | مواصفات تفصيلية ── */}
            <div className="flex border-b border-slate-300 dark:border-slate-600">

              {/* يمين: فئات — نظام ديناميكي مطابق للوحدات */}
              <div className="w-80 shrink-0 border-l border-slate-300 dark:border-slate-600 flex flex-col">
                <div className="bg-[#EDE7DF] dark:bg-blue-900/20 px-2 py-0.5 border-b border-[#D6CFC6] dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">فئات</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {catRows.map((cat, idx) => (
                      <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                        {/* رقم */}
                        <td className="text-center px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 w-8">
                          {idx + 1}
                        </td>
                        {/* اختيار الفئة */}
                        <td className="px-1 py-1 border-l border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-1">
                            <select
                              value={cat}
                              onChange={(e) => updateCatRow(idx, e.target.value)}
                              className="h-7 flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- اختر --</option>
                              {categories?.map((c) => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              title="إضافة فئة جديدة"
                              onClick={() => { setAddingToCatRow(idx); setNewCatName(""); setAddCatOpen(true); }}
                              className="h-7 w-7 shrink-0 flex items-center justify-center rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-bold"
                            >+</button>
                          </div>
                        </td>
                        {/* حذف */}
                        <td className="px-1 py-1 text-center w-8">
                          {catRows.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeCatRow(idx)}
                              className="h-6 w-6 flex items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 mx-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : <span className="block w-6" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* زر إضافة فئة أخرى */}
                <button
                  type="button"
                  onClick={addCatRow}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50 border-t border-dashed border-slate-300 dark:border-slate-600 transition-colors mt-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة فئة أخرى
                </button>

                {/* Dialog إضافة فئة جديدة */}
                <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                  <DialogContent className="max-w-sm" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-right">إضافة فئة جديدة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleQuickAddCat()}
                        placeholder="اسم الفئة (مثال: إلكترونيات، مواد بناء...)"
                        autoFocus
                        className="w-full h-9 text-sm border border-slate-300 dark:border-slate-600 rounded px-3 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setAddCatOpen(false)}>إلغاء</Button>
                        <Button
                          size="sm"
                          onClick={handleQuickAddCat}
                          disabled={!newCatName.trim() || createCatMutation.isPending}
                        >
                          {createCatMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* يسار: مواصفات تفصيلية */}
              <div className="flex-1">
                <div className="bg-[#EDE7DF] dark:bg-blue-900/20 px-2 py-0.5 border-b border-[#D6CFC6] dark:border-slate-600 text-center">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">مواصفات</span>
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
                    <div className="w-28 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
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
                <div className="w-36 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
                  <span className="text-xs text-slate-600 dark:text-slate-400">نوع الضريبة السابقة</span>
                </div>
                <div className="flex-1 px-1 py-1">
                  <CInput value={form.prevTaxType} onChange={(v) => set("prevTaxType", v)} placeholder="" className="w-full" />
                </div>
              </div>
              <div className="w-72 shrink-0 flex">
                <div className="w-28 shrink-0 bg-[#F0EDE8] dark:bg-slate-800 px-2 flex items-center border-l border-[#D6D6D6] dark:border-slate-700">
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
          <div className="flex gap-3 h-full">

            {/* العمود الأيسر: وصف + جدول مضغوط */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* الوصف */}
              <div className="border border-slate-200 dark:border-slate-700 rounded">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">الوصف</span>
                </div>
                <div className="p-2">
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={2}
                    className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500 resize-none w-full"
                    placeholder="وصف الصنف..."
                  />
                </div>
              </div>

              {/* جدول الأوصاف الإضافية — مضغوط */}
              <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-0.5 border-b border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">وصف إضافي</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F0EDE8] dark:bg-slate-800/50 border-b border-[#D6D6D6] dark:border-slate-700">
                      <th className="text-center px-1 py-0.5 font-semibold text-slate-500 w-6 border-l border-slate-200 dark:border-slate-700">#</th>
                      <th className="text-right px-2 py-0.5 font-semibold text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700">وصف إضافي</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="text-center px-1 py-0.5 font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 w-6">
                          {idx + 1}
                        </td>
                        {/* وصف إضافي */}
                        <td className="px-1 py-0.5 border-l border-slate-200 dark:border-slate-700">
                          <input
                            type="text"
                            value={row.desc}
                            onChange={(e) => updateExtRow(idx, "desc", e.target.value)}
                            placeholder={`وصف إضافي ${idx + 1}`}
                            className="h-6 w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-1 py-0.5 text-center w-6">
                          {extRows.length > 1 ? (
                            <button type="button" onClick={() => removeExtRow(idx)}
                              className="h-5 w-5 flex items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 mx-auto">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : <span className="block w-5" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addExtRow}
                  className="w-full flex items-center justify-center gap-1 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50 border-t border-dashed border-slate-300 dark:border-slate-600 transition-colors">
                  <Plus className="w-3 h-3" />
                  إضافة وصف إضافي
                </button>
              </div>
            </div>

            {/* العمود الأيمن: صورة الصنف */}
            <div className="w-72 shrink-0 flex flex-col">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">صورة الصنف</span>
              {/* مربع الصورة */}
              <div className="relative flex-1 flex flex-col border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 overflow-hidden min-h-[200px]">
                {/* الصورة أو الأيقونة */}
                <div className="flex-1 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="صورة الصنف" className="w-full h-full object-contain absolute inset-0" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-300 dark:text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">لا توجد صورة</span>
                    </div>
                  )}
                </div>
                {/* شريط الأزرار السفلي */}
                <div className="relative z-10 flex items-center justify-center gap-1 p-1.5 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                  {/* رفع */}
                  <label htmlFor="product-image-upload"
                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded cursor-pointer bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    رفع
                  </label>
                  {/* حذف */}
                  <button type="button" onClick={() => setImagePreview(null)}
                    disabled={!imagePreview}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    حذف
                  </button>
                  {/* فتح */}
                  <button type="button"
                    disabled={!imagePreview}
                    onClick={() => imagePreview && window.open(imagePreview, "_blank")}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-slate-600 hover:bg-slate-700 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    فتح
                  </button>
                </div>
              </div>
              <input id="product-image-upload" type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
            </div>

          </div>
        )}

        {/* ===== التبويب 3: الأسعار ===== */}
        {activeTab === "prices" && (
          <div className="space-y-4">
            {/* جدول الأسعار */}
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">جدول الأسعار</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F0EDE8] dark:bg-slate-800/50 border-b border-[#D6D6D6] dark:border-slate-700">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700 flex items-center justify-between">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700 flex items-center gap-2">
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
                      <tr className="bg-[#F0EDE8] dark:bg-slate-800/50 border-b border-[#D6D6D6] dark:border-slate-700">
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
                <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700 flex items-center justify-between">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">الكميات حسب المخزن / الفرع</span>
              </div>
              {isEdit ? (
                loadingStock ? (
                  <div className="p-4 text-center text-slate-400 text-sm">جاري التحميل...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F0EDE8] dark:bg-slate-800/50 border-b border-[#D6D6D6] dark:border-slate-700">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
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
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">الإحصائيات الشهرية</span>
              </div>
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                <p>تُعرض الإحصائيات بعد تسجيل حركات المبيعات والمشتريات.</p>
                <p className="text-xs mt-1">الجدول الشهري: الفترة، مبيعات كميات/قيمة، مشتريات كميات/قيمة، هدف، %.</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded">
              <div className="bg-[#EBE7DF] dark:bg-slate-800 px-3 py-1.5 border-b border-[#CFCFCF] dark:border-slate-700">
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
  const workspaceEl = useWorkspaceEl();
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [winPos, setWinPos] = useState<{ x: number; y: number }>(() => {
    try { const s = localStorage.getItem("pdlg-pos"); if (s) return JSON.parse(s); } catch {}
    return { x: 60, y: 30 };
  });
  const [winSize, setWinSize] = useState<{ w: number; h: number }>(() => {
    try { const s = localStorage.getItem("pdlg-size"); if (s) return JSON.parse(s); } catch {}
    return { w: 880, h: 580 };
  });
  const saveWinBounds = (x: number, y: number, w: number, h: number) => {
    try {
      localStorage.setItem("pdlg-pos", JSON.stringify({ x, y }));
      localStorage.setItem("pdlg-size", JSON.stringify({ w, h }));
    } catch {}
  };
  const toggleMaximize = () => {
    if (isMaximized) {
      setIsMaximized(false);
      if (preMaxRef.current) {
        setWinPos({ x: preMaxRef.current.x, y: preMaxRef.current.y });
        setWinSize({ w: preMaxRef.current.w, h: preMaxRef.current.h });
      }
    } else {
      preMaxRef.current = { x: winPos.x, y: winPos.y, w: winSize.w, h: winSize.h };
      const ww = workspaceEl?.offsetWidth ?? 900;
      const wh = workspaceEl?.offsetHeight ?? 600;
      setWinPos({ x: 0, y: 0 });
      setWinSize({ w: ww, h: wh });
      setIsMaximized(true);
    }
  };

  // توسيط النافذة عند أول فتح (إذا لم يكن هناك موضع محفوظ)
  const hasCentered = useRef(false);
  useEffect(() => {
    if (isOpen && workspaceEl && !hasCentered.current) {
      const saved = localStorage.getItem("pdlg-pos");
      if (!saved) {
        const ww = workspaceEl.offsetWidth;
        const wh = workspaceEl.offsetHeight;
        setWinPos({
          x: Math.max(20, Math.floor((ww - winSize.w) / 2)),
          y: Math.max(10, Math.floor((wh - winSize.h) / 4)),
        });
      }
      hasCentered.current = true;
    }
  }, [isOpen, workspaceEl]);

  const [toolsOpen, setToolsOpen] = useState(false);

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

  const leafGroups = useMemo(() => {
    const all = groups ?? [];
    const parentIds = new Set(all.map(g => g.parentId).filter(Boolean));
    return all.filter(g => !parentIds.has(g.id));
  }, [groups]);
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

  // F1 shortcut for add product
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); openCreate(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ─── التنقل بين الأصناف ──────────────────────────────────────────────────────
  const navigateTo = (p: any) => {
    if (!p) return;
    setEditId(p.id);
    setForm({
      name: p.name ?? "",
      name2: p.name2 ?? "",
      sku: p.code ?? p.sku ?? "",
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
      nameEn: p.nameEn ?? "",
      brand: p.brand ?? "",
      model: p.model ?? "",
      description: p.description ?? "",
      hasColors: p.hasColors ?? false,
      hasSizes: p.hasSizes ?? false,
      hasSerialNo: p.hasSerialNo ?? false,
      hasExpiry: p.hasExpiry ?? false,
      canSell: p.canSell ?? true,
      canBuy: p.canBuy ?? true,
      canReturn: p.canReturn ?? true,
      taxable: p.taxable ?? false,
      taxRate: p.taxRate ?? "15",
      allowNegative: p.allowNegative ?? false,
      isActive: p.isActive ?? true,
      unitsJson: p.unitsJson ?? "",
      catsJson: p.catsJson ?? "",
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
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name ?? "",
      name2: p.name2 ?? "",
      sku: p.code ?? p.sku ?? "",
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
      toast.error("اسم الصنف (إسم 1) مطلوب");
      return;
    }

    const data = {
      name:          form.name.trim(),
      name2:         form.name2.trim() || undefined,
      nameEn:        form.nameEn.trim() || undefined,
      sku:           form.sku.trim() || undefined,
      barcode:       form.barcode.trim() || undefined,
      barcode2:      form.barcode2.trim() || undefined,
      barcode3:      form.barcode3.trim() || undefined,
      groupId:       form.groupId ? Number(form.groupId) : undefined,
      categoryId:    form.categoryId ? Number(form.categoryId) : undefined,
      unit:          form.unit || "قطعة",
      unit2:         form.unit2.trim() || undefined,
      unit3:         form.unit3.trim() || undefined,
      unitsJson:     form.unitsJson || undefined,
      catsJson:      form.catsJson  || undefined,
      itemType:      form.itemType || "مخزون",
      brand:         form.brand.trim() || undefined,
      model:         form.model.trim() || undefined,
      description:   form.description.trim() || undefined,
      purchasePrice: form.purchasePrice || "0",
      costPrice:     form.costPrice || "0",
      salePrice:     form.salePrice || "0",
      salePrice2:    form.salePrice2 || undefined,
      salePrice3:    form.salePrice3 || undefined,
      salePrice4:    form.salePrice4 || undefined,
      salePrice5:    form.salePrice5 || undefined,
      wholesalePrice: form.wholesalePrice || undefined,
      vatRate:       form.vatRate || "15",
      taxRate:       form.taxRate || undefined,
      taxable:       form.taxable,
      taxType:       form.taxType.trim() || undefined,
      minStock:      Number(form.minStock) || 0,
      maxStock:      Number(form.maxStock) || 0,
      reorderPoint:  Number(form.reorderPoint) || 0,
    };

    console.log("[handleSubmit] data:", data);

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

  const currentNavIdx = editId ? sortedProducts.findIndex((p: any) => p.id === editId) : -1;
  const navFirst  = () => { if (sortedProducts.length) navigateTo(sortedProducts[0]); };
  const navLast   = () => { if (sortedProducts.length) navigateTo(sortedProducts[sortedProducts.length - 1]); };
  const navPrev   = () => { if (currentNavIdx > 0) navigateTo(sortedProducts[currentNavIdx - 1]); };
  const navNext   = () => { if (currentNavIdx < sortedProducts.length - 1) navigateTo(sortedProducts[currentNavIdx + 1]); };

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
        <button
          onClick={openCreate}
          title="إضافة صنف (F1)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 20px",
            background: "#406B93",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontFamily: "'Cairo', Tahoma, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(64,107,147,0.35)",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#365E80")}
          onMouseLeave={e => (e.currentTarget.style.background = "#406B93")}
        >
          <Plus style={{ width: 18, height: 18, strokeWidth: 2.5 }} />
          إضافة صنف
          <span style={{
            fontSize: 10,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 3,
            padding: "1px 5px",
            fontFamily: "monospace",
            fontWeight: 400,
          }}>F1</span>
        </button>
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

      {/* ===== نافذة الصنف — قابلة للسحب والتكبير (react-rnd) ===== */}
      {isOpen && workspaceEl && createPortal(
        <>
          {/* طبقة الخلفية — داخل منطقة العمل فقط */}
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)", zIndex: 50 }}
            onClick={() => setIsOpen(false)}
          />

          <Rnd
            position={{ x: winPos.x, y: winPos.y }}
            size={{ width: winSize.w, height: winSize.h }}
            onDragStop={(_, d) => {
              if (!isMaximized) {
                setWinPos({ x: d.x, y: d.y });
                saveWinBounds(d.x, d.y, winSize.w, winSize.h);
              }
            }}
            onResizeStop={(_, __, ref, ___, pos) => {
              if (!isMaximized) {
                const w = ref.offsetWidth;
                const h = ref.offsetHeight;
                setWinSize({ w, h });
                setWinPos({ x: pos.x, y: pos.y });
                saveWinBounds(pos.x, pos.y, w, h);
              }
            }}
            dragHandleClassName="erp-drag-handle"
            minWidth={640}
            minHeight={420}
            bounds="parent"
            disableDragging={isMaximized}
            enableResizing={isMaximized ? false : {
              top: true, bottom: true, left: true, right: true,
              topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
            }}
            style={{ zIndex: 51 }}
          >
            {/* الحاوية الداخلية */}
            <div
              dir="rtl"
              onClick={e => e.stopPropagation()}
              style={{
                display: "flex", flexDirection: "column",
                width: "100%", height: "100%",
                background: "#fff",
                borderRadius: isMaximized ? 4 : 8,
                overflow: "hidden",
                border: "2px solid rgba(59,130,246,0.7)",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.15),0 20px 60px -10px rgba(59,130,246,0.35),0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              {/* ── شريط الأدوات الرئيسي — Enterprise ERP Action Bar ── */}
              <div
                dir="rtl"
                style={{
                  flexShrink: 0,
                  display: "flex", flexDirection: "row", alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #DDE3EC",
                  background: "#FFFFFF",
                  padding: "6px 10px",
                  gap: 6,
                  userSelect: "none",
                  minHeight: 48,
                }}
              >
                {/* ① العنوان — منطقة السحب */}
                <div
                  className="erp-drag-handle"
                  onDoubleClick={toggleMaximize}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    fontSize: 13, fontWeight: 600,
                    fontFamily: "'Cairo', Tahoma, sans-serif",
                    color: "#1E293B", whiteSpace: "nowrap", flexShrink: 0,
                    cursor: isMaximized ? "default" : "move",
                    paddingLeft: 2,
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: "#EFF6FF", border: "1px solid #BFDBFE",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Package style={{ width: 13, height: 13, color: "#2563EB", pointerEvents: "none" }} />
                  </div>
                  <span style={{ color: "#CA8A04" }}>
                    {editId ? "تعديل بيانات الصنف" : "إضافة صنف جديد"}
                  </span>
                </div>

                {/* فاصل رأسي */}
                <div style={{ width: 1, height: 24, background: "#DDE3EC", margin: "0 2px", flexShrink: 0 }} />

                {/* ② أزرار العمليات */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <BotBtn
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>}
                    label="حفظ" variant="primary"
                    disabled={createProduct.isPending || updateProduct.isPending}
                    onClick={handleSubmit}
                  />
                  <BotDivider />
                  <BotBtn
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                    label="نسخة"
                    disabled={!editId}
                    onClick={() => {
                      if (!editId) { toast.warning("لا يوجد صنف محدد للنسخ"); return; }
                      setEditId(null);
                      setForm({ ...form, sku: "", barcode: "", barcode2: "", barcode3: "" });
                      toast.info("تم إنشاء نسخة — عدّل الرقم واحفظ");
                    }}
                  />
                  <BotBtn
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>}
                    label="جديد"
                    onClick={() => { setEditId(null); setForm(emptyForm); }}
                  />
                  <BotDivider />
                  {/* أدوات */}
                  <div style={{ position: "relative" }}>
                    <BotBtn
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
                      label="أدوات ▾"
                      onClick={() => setToolsOpen(o => !o)}
                    />
                    {toolsOpen && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 2060 }} onClick={() => setToolsOpen(false)} />
                        <div style={{
                          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 2061,
                          background: "#fff", border: "1px solid #CFCFCF", borderRadius: 4,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 160, overflow: "hidden",
                          fontFamily: "'Cairo', Tahoma, sans-serif", fontSize: 12,
                        }}>
                          {[
                            { label: "نشاط المستخدمين", icon: "👤" },
                            { label: "توقيف الاستخدام",  icon: "🚫" },
                            { label: "قصر المطالعة على", icon: "🔒" },
                          ].map((item, i) => (
                            <button key={i}
                              onClick={() => { setToolsOpen(false); toast.info(item.label); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                width: "100%", padding: "7px 12px",
                                background: "none", border: "none", cursor: "pointer",
                                textAlign: "right", color: "#2B2B2B", fontSize: 12,
                                borderBottom: i < 2 ? "1px solid #F0EDE8" : "none",
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#F0EDE8")}
                              onMouseLeave={e => (e.currentTarget.style.background = "none")}
                            >
                              <span>{item.icon}</span>{item.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <BotDivider />
                  <BotBtn
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                    label="حذف" variant="danger" disabled={!editId}
                    onClick={() => {
                      if (!editId) return;
                      if (confirm("هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع.")) {
                        deleteProduct.mutate({ id: editId });
                        setIsOpen(false);
                      }
                    }}
                  />
                </div>

                {/* فاصل رأسي */}
                <div style={{ width: 1, height: 24, background: "#DDE3EC", margin: "0 2px", flexShrink: 0 }} />

                {/* ③ أسهم التنقل */}
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <NavBtn title="أول سجل" disabled={!editId || currentNavIdx <= 0} onClick={navFirst}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
                    </svg>
                    <span style={{ fontSize: 11 }}>أول</span>
                  </NavBtn>
                  <NavBtn title="السابق" disabled={!editId || currentNavIdx <= 0} onClick={navPrev}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    <span style={{ fontSize: 11 }}>السابق</span>
                  </NavBtn>
                  <div style={{
                    padding: "0 10px", fontSize: 11, color: "#475569",
                    fontFamily: "'Cairo', Tahoma, sans-serif", minWidth: 46, textAlign: "center",
                    background: "#F8FAFC", border: "1px solid #D6DCE5",
                    borderRadius: 6, height: 28, lineHeight: "28px", flexShrink: 0,
                  }}>
                    {editId && currentNavIdx >= 0
                      ? `${currentNavIdx + 1} / ${sortedProducts.length}`
                      : editId ? "—" : "جديد"}
                  </div>
                  <NavBtn
                    title="التالي"
                    disabled={!editId || currentNavIdx < 0 || currentNavIdx >= sortedProducts.length - 1}
                    onClick={navNext}
                  >
                    <span style={{ fontSize: 11 }}>التالي</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </NavBtn>
                  <NavBtn
                    title="آخر سجل"
                    disabled={!editId || currentNavIdx < 0 || currentNavIdx >= sortedProducts.length - 1}
                    onClick={navLast}
                  >
                    <span style={{ fontSize: 11 }}>آخر</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
                    </svg>
                  </NavBtn>
                </div>

                {/* spacer — منطقة السحب الثانية */}
                <div
                  className="erp-drag-handle"
                  onDoubleClick={toggleMaximize}
                  style={{ flex: 1, cursor: isMaximized ? "default" : "move", minWidth: 16 }}
                />

                {/* فاصل رأسي */}
                <div style={{ width: 1, height: 24, background: "#DDE3EC", margin: "0 2px", flexShrink: 0 }} />

                {/* ④ تكبير + إغلاق */}
                <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <button
                    onClick={toggleMaximize}
                    title={isMaximized ? "استعادة الحجم" : "تكبير النافذة"}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 32,
                      background: "#FFFFFF", border: "1px solid #D6DCE5",
                      borderRadius: 6, cursor: "pointer", color: "#6B7280",
                      transition: "background 0.15s ease, border-color 0.15s ease",
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "#F5F8FC";
                      e.currentTarget.style.borderColor = "#B8C7DA";
                      e.currentTarget.style.color = "#374151";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "#FFFFFF";
                      e.currentTarget.style.borderColor = "#D6DCE5";
                      e.currentTarget.style.color = "#6B7280";
                    }}
                  >
                    {isMaximized
                      ? <Minimize2 style={{ width: 13, height: 13, pointerEvents: "none" }} />
                      : <Maximize2 style={{ width: 13, height: 13, pointerEvents: "none" }} />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    title="إغلاق"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "0 12px", height: 32,
                      background: "#FFFFFF", border: "1px solid #D6DCE5",
                      borderRadius: 6, cursor: "pointer",
                      fontFamily: "'Cairo', Tahoma, sans-serif", fontSize: 12, fontWeight: 500,
                      color: "#6B7280", whiteSpace: "nowrap", flexShrink: 0,
                      transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "#FEF2F2";
                      e.currentTarget.style.borderColor = "#FECACA";
                      (e.currentTarget.style as any).color = "#DC2626";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "#FFFFFF";
                      e.currentTarget.style.borderColor = "#D6DCE5";
                      e.currentTarget.style.color = "#6B7280";
                    }}
                  >
                    <X style={{ width: 12, height: 12, pointerEvents: "none" }} />
                    إغلاق
                  </button>
                </div>
              </div>

              {/* محتوى الكارت */}
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                <ProductCard
                  key={editId ?? "new"}
                  form={form}
                  setForm={setForm}
                  categories={categories}
                  groups={groups as any}
                  productId={editId}
                />
              </div>
            </div>
          </Rnd>
        </>,
        workspaceEl
      )}
    </div>
  );
}

// ─── BotBtn: زر Toolbar (NamaSoft / SAP Style) ────────────────────────────────
function BotBtn({
  icon, label, onClick, disabled, variant,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "default";
}) {
  const [hovered, setHovered] = useState(false);

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "flex", alignItems: "center", gap: 6,
      padding: "0 12px", height: 32,
      border: "1px solid",
      borderRadius: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'Cairo', Tahoma, sans-serif",
      fontSize: 12, fontWeight: 500,
      whiteSpace: "nowrap", flexShrink: 0,
      transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
      outline: "none",
    };
    if (variant === "primary") return {
      ...base,
      background: hovered && !disabled ? "#1D4ED8" : "#2563EB",
      borderColor: hovered && !disabled ? "#1D4ED8" : "#2563EB",
      color: "#FFFFFF",
      opacity: disabled ? 0.55 : 1,
      boxShadow: hovered && !disabled ? "0 2px 8px rgba(37,99,235,0.35)" : "0 1px 3px rgba(37,99,235,0.18)",
    };
    if (variant === "danger") return {
      ...base,
      background: hovered && !disabled ? "#B91C1C" : "#DC2626",
      borderColor: hovered && !disabled ? "#B91C1C" : "#DC2626",
      color: "#FFFFFF",
      opacity: disabled ? 0.5 : 1,
      boxShadow: hovered && !disabled ? "0 2px 8px rgba(220,38,38,0.3)" : "none",
    };
    return {
      ...base,
      background: hovered && !disabled ? "#F5F8FC" : "#FFFFFF",
      borderColor: hovered && !disabled ? "#B8C7DA" : "#D6DCE5",
      color: disabled ? "#A8B4C2" : "#374151",
      opacity: disabled ? 0.65 : 1,
    };
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={getStyle()}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── BotDivider ───────────────────────────────────────────────────────────────
function BotDivider() {
  return (
    <div style={{ width: 1, height: 22, background: "#D6DCE5", margin: "0 4px", flexShrink: 0 }} />
  );
}

// ─── NavBtn: زر التنقل (Minimal ERP Style) ────────────────────────────────────
function NavBtn({
  children, onClick, disabled, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 3,
        padding: "0 8px", height: 28,
        background: hovered && !disabled ? "#F5F8FC" : "#FFFFFF",
        color: disabled ? "#C5CDD8" : "#4B5563",
        border: "1px solid",
        borderColor: hovered && !disabled ? "#B8C7DA" : "#D6DCE5",
        borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Cairo', Tahoma, sans-serif",
        fontSize: 11, fontWeight: 500,
        whiteSpace: "nowrap", flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}
