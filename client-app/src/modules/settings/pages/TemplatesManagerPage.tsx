/**
 * TemplatesManagerPage.tsx
 * شاشة إدارة القوالب الموحّدة — قوالب الطباعة + قوالب الواجهات
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/core/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { trpc } from "@/shared/lib/trpc";
import {
  Printer, BookOpen, BookMarked, RotateCcw, ClipboardList,
  ArrowLeftRight, Tag, Plus, Save, Trash2, ChevronFirst, ChevronLast,
  ChevronLeft as CLeft, ChevronRight as CRight, FileText, Star,
  Paintbrush, CheckCircle2, LayoutTemplate, Globe2, Table2,
  Copy, Settings2, Monitor, Layers, Sliders,
  Eye, EyeOff, GripVertical, Columns3,
  ChevronDown, ChevronRight as ChevronRt, Info, Palette,
} from "lucide-react";
import { toast } from "sonner";
import PrintTemplateDesigner, { type TemplateLayout } from "@/shared/components/PrintTemplateDesigner";

/* ══════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════ */

type TemplateCategory = "print" | "ui";
type FieldVisibility  = "visible" | "hidden" | "readonly";

type TplForm = {
  code: string; nameAr: string; nameEn: string;
  paperSize: string; orientation: string;
  isDefault: boolean; isActive: boolean;
  notes: string; layoutJson: string | null;
};
type Tpl = {
  id: number; docType: string; sortOrder: number;
  isActive: boolean; layoutJson?: string | null;
} & TplForm;

type UIFieldCfg = {
  key: string; label: string;
  visibility: FieldVisibility;
  required: boolean;
  order: number;
};
type UITemplateCfg = {
  version: 1; type: "ui_config_v1";
  primaryColor: string; bgColor: string; borderColor: string;
  borderRadius: number; fontSize: number; fontFamily: string;
  tableRowHeight: number; tableHeaderHeight: number;
  fields: UIFieldCfg[];
};

/* ══════════════════════════════════════════════════════════
   Constants
══════════════════════════════════════════════════════════ */

const DEFAULT_COLS: TemplateLayout["columns"] = {
  num: true, code: true, name: true, unit: false,
  qty: true, price: true, discount: true,
  taxable: true, taxRate: true, taxAmt: true, total: true,
};
const DEFAULT_SECS: TemplateLayout["sections"] = {
  sellerInfo: true, customerInfo: true,
  amountInWords: true, pageNumber: true, signatures: false,
};
const COL_LIST: { key: keyof TemplateLayout["columns"]; ar: string }[] = [
  { key: "num",      ar: "م"                      },
  { key: "code",     ar: "رقم الصنف"              },
  { key: "name",     ar: "اسم الصنف / الخدمة"     },
  { key: "unit",     ar: "وحدة"                   },
  { key: "qty",      ar: "الكمية"                  },
  { key: "price",    ar: "سعر الوحدة"             },
  { key: "discount", ar: "الخصومات"               },
  { key: "taxable",  ar: "المبلغ الخاضع للضريبة"  },
  { key: "taxRate",  ar: "نسبة الضريبة"           },
  { key: "taxAmt",   ar: "مبلغ الضريبة"           },
  { key: "total",    ar: "المجموع (شامل ضريبة)"   },
];
const SEC_LIST: { key: keyof TemplateLayout["sections"]; ar: string }[] = [
  { key: "sellerInfo",    ar: "بيانات البائع / المورد" },
  { key: "customerInfo",  ar: "بيانات العميل"          },
  { key: "amountInWords", ar: "المبلغ كتابةً"          },
  { key: "pageNumber",    ar: "رقم الصفحة"             },
  { key: "signatures",    ar: "خانات التوقيع"          },
];
const PRESET_COLORS = [
  "#406B93","#1D4ED8","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#374151","#D19C05",
];

const DOC_TYPES = [
  { id: "sales_invoice",    label: "فاتورة مبيعات",    icon: <BookOpen className="w-3.5 h-3.5" />,      cat: "sales"    },
  { id: "sales_quotation",  label: "عرض سعر",           icon: <FileText className="w-3.5 h-3.5" />,      cat: "sales"    },
  { id: "pos_receipt",      label: "إيصال نقاط البيع", icon: <LayoutTemplate className="w-3.5 h-3.5" />, cat: "sales"    },
  { id: "sales_return",     label: "مردود مبيعات",      icon: <RotateCcw className="w-3.5 h-3.5" />,     cat: "sales"    },
  { id: "purchase_invoice", label: "فاتورة مشتريات",   icon: <BookMarked className="w-3.5 h-3.5" />,    cat: "purchase" },
  { id: "purchase_order",   label: "أمر شراء",          icon: <ClipboardList className="w-3.5 h-3.5" />, cat: "purchase" },
  { id: "purchase_return",  label: "مردود مشتريات",     icon: <RotateCcw className="w-3.5 h-3.5" />,     cat: "purchase" },
  { id: "stock_receipt",    label: "استلام مخزني",      icon: <ClipboardList className="w-3.5 h-3.5" />, cat: "inventory"},
  { id: "stock_issue",      label: "إذن صرف مخزني",    icon: <ClipboardList className="w-3.5 h-3.5" />, cat: "inventory"},
  { id: "stock_transfer",   label: "تحويل مخزني",       icon: <ArrowLeftRight className="w-3.5 h-3.5" />,cat: "inventory"},
  { id: "receipt_voucher",  label: "سند قبض",           icon: <Tag className="w-3.5 h-3.5" />,           cat: "finance"  },
  { id: "payment_voucher",  label: "سند صرف",           icon: <Tag className="w-3.5 h-3.5" />,           cat: "finance"  },
];

const DOC_CATS = [
  { id: "sales",     label: "المبيعات",  color: "#60A5FA" },
  { id: "purchase",  label: "المشتريات", color: "#A78BFA" },
  { id: "inventory", label: "المخزون",   color: "#34D399" },
  { id: "finance",   label: "المالية",   color: "#FBBF24" },
];

const EMPTY: TplForm = {
  code: "", nameAr: "", nameEn: "",
  paperSize: "A4", orientation: "portrait",
  isDefault: false, isActive: true, notes: "", layoutJson: null,
};

const DEFAULT_UI_CFG: UITemplateCfg = {
  version: 1, type: "ui_config_v1",
  primaryColor: "#406B93", bgColor: "#FAFAF8", borderColor: "#E2E8F0",
  borderRadius: 6, fontSize: 12, fontFamily: "Noto Kufi Arabic",
  tableRowHeight: 32, tableHeaderHeight: 36, fields: [],
};

const UI_FIELDS_TEMPLATE: Omit<UIFieldCfg, "order">[] = [
  { key: "invoiceNo",    label: "رقم المستند",       visibility: "readonly", required: true  },
  { key: "invoiceDate",  label: "التاريخ",            visibility: "visible",  required: true  },
  { key: "dueDate",      label: "تاريخ الاستحقاق",   visibility: "visible",  required: false },
  { key: "customer",     label: "العميل / المورد",    visibility: "visible",  required: true  },
  { key: "branch",       label: "الفرع",              visibility: "visible",  required: false },
  { key: "salesperson",  label: "المسؤول / المندوب", visibility: "visible",  required: false },
  { key: "currency",     label: "العملة",             visibility: "visible",  required: false },
  { key: "paymentTerms", label: "شروط الدفع",         visibility: "visible",  required: false },
  { key: "notes",        label: "ملاحظات",            visibility: "visible",  required: false },
  { key: "discount",     label: "عمود الخصم",         visibility: "visible",  required: false },
  { key: "taxRate",      label: "نسبة الضريبة",       visibility: "visible",  required: false },
  { key: "attachments",  label: "المرفقات",           visibility: "visible",  required: false },
];

/* ══════════════════════════════════════════════════════════
   Small atoms
══════════════════════════════════════════════════════════ */

const FI = ({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className="h-7 text-[11px] px-2 border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded disabled:bg-slate-50 disabled:text-slate-400" />
);

const FS = ({ value, onValueChange, children }: {
  value: string; onValueChange: (v: string) => void; children: React.ReactNode;
}) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-7 text-[11px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
      <SelectValue placeholder="— اختر —" />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);

function Panel({ title, icon, children, action }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden" style={{ border: "1px solid #e8edf3", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="px-3 py-1.5 flex items-center justify-between gap-2"
        style={{ background: "linear-gradient(to left, #f0ece3, #e8e3d8)", borderBottom: "1px solid #d8d3c8" }}>
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-indigo-600">{icon}</span>}
          <span className="font-semibold text-indigo-800 text-[12px]">{title}</span>
        </div>
        {action}
      </div>
      <div className="px-3 py-2.5" style={{ background: "#FDFAF5" }}>{children}</div>
    </div>
  );
}

function Row({ label, lw = 110, children }: { label: string; lw?: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[11px] text-slate-500 font-medium shrink-0" style={{ width: lw }}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function CB({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-[11px] text-slate-600">{label}</span>
    </label>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════ */
export default function TemplatesManagerPage() {

  const [activeTab, setActiveTab]   = useState<TemplateCategory>("print");
  const [selectedType, setSelectedType] = useState("sales_invoice");
  const [view, setView]                 = useState<"list" | "form" | "designer">("list");
  const [editId, setEditId]             = useState<number | null>(null);
  const [form, setForm]                 = useState<TplForm>({ ...EMPTY });
  const [isDirty, setIsDirty]           = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);
  const [uiCfg, setUiCfg]             = useState<UITemplateCfg>({ ...DEFAULT_UI_CFG });
  const [uiDirty, setUiDirty]         = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [collapsedSecs, setCollapsedSecs] = useState<Record<string, boolean>>({});

  /* ── queries ── */
  const listQuery  = trpc.documentTemplates.list.useQuery({ docType: selectedType });
  const templates: Tpl[] = (listQuery.data ?? []) as Tpl[];

  const seedMut = trpc.documentTemplates.seedDefaults.useMutation({
    onSuccess: r => { if (r.seeded) listQuery.refetch(); },
  });
  const seedDefaultMut = trpc.documentTemplates.seedDefault.useMutation({
    onSuccess: r => { if (r.seeded) listQuery.refetch(); },
  });
  const seedCalledRef = useRef(false);
  useEffect(() => {
    if (!seedCalledRef.current) { seedCalledRef.current = true; seedMut.mutate(); }
  }, []);
  useEffect(() => {
    if (!listQuery.isLoading && listQuery.data?.length === 0 && !seedDefaultMut.isPending) {
      seedDefaultMut.mutate({ docType: selectedType });
    }
  }, [selectedType, listQuery.data, listQuery.isLoading]);

  useEffect(() => {
    if (activeTab !== "ui") return;
    const uiTpl = templates.find(t => {
      try { return t.layoutJson && JSON.parse(t.layoutJson).type === "ui_config_v1"; }
      catch { return false; }
    });
    if (uiTpl?.layoutJson) {
      try {
        const p = JSON.parse(uiTpl.layoutJson) as UITemplateCfg;
        if (!p.fields || p.fields.length === 0)
          p.fields = UI_FIELDS_TEMPLATE.map((f, i) => ({ ...f, order: i }));
        setUiCfg(p);
      } catch {}
    } else {
      setUiCfg({ ...DEFAULT_UI_CFG, fields: UI_FIELDS_TEMPLATE.map((f, i) => ({ ...f, order: i })) });
    }
    setUiDirty(false);
  }, [activeTab, selectedType, listQuery.data]);

  /* ── mutations ── */
  const createMut = trpc.documentTemplates.create.useMutation({
    onSuccess: row => { toast.success("تم حفظ النموذج ✓"); listQuery.refetch(); setEditId(row.id); setIsDirty(false); },
    onError:   e   => toast.error(e.message),
  });
  const updateMut = trpc.documentTemplates.update.useMutation({
    onSuccess: () => { toast.success("تم التحديث ✓"); listQuery.refetch(); setIsDirty(false); },
    onError:   e  => toast.error(e.message),
  });
  const deleteMut = trpc.documentTemplates.delete.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); listQuery.refetch(); setView("list"); setEditId(null); },
    onError:   e  => toast.error(e.message),
  });
  const cloneMut = trpc.documentTemplates.clone.useMutation({
    onSuccess: () => { toast.success("تم النسخ ✓"); listQuery.refetch(); },
    onError:   e  => toast.error(e.message),
  });

  /* ── helpers ── */
  const set = <K extends keyof TplForm>(k: K, v: TplForm[K]) => {
    setForm(p => ({ ...p, [k]: v })); setIsDirty(true);
  };

  const guardDirty = useCallback((action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  }, [isDirty]);

  const openNew = useCallback(() => {
    guardDirty(() => { setForm({ ...EMPTY }); setEditId(null); setIsDirty(false); setView("form"); });
  }, [guardDirty]);

  const openEdit = useCallback((t: Tpl) => {
    guardDirty(() => {
      setForm({
        code: t.code ?? "", nameAr: t.nameAr ?? "", nameEn: t.nameEn ?? "",
        paperSize: t.paperSize ?? "A4", orientation: t.orientation ?? "portrait",
        isDefault: t.isDefault ?? false, isActive: t.isActive ?? true,
        notes: t.notes ?? "", layoutJson: t.layoutJson ?? null,
      });
      setEditId(t.id); setIsDirty(false); setView("form");
    });
  }, [guardDirty]);

  const handleSave = useCallback(() => {
    if (!form.code.trim())   { toast.error("رقم النموذج مطلوب");  return; }
    if (!form.nameAr.trim()) { toast.error("اسم النموذج مطلوب"); return; }
    const payload = {
      code: form.code.trim(), nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || undefined,
      docType: selectedType, paperSize: form.paperSize,
      orientation: form.orientation, isDefault: form.isDefault,
      isActive: form.isActive, layoutJson: form.layoutJson ?? undefined,
      notes: form.notes || undefined, sortOrder: 0,
    };
    if (editId !== null) updateMut.mutate({ id: editId, ...payload });
    else                 createMut.mutate(payload);
  }, [form, editId, selectedType, createMut, updateMut]);

  const handleDesignerSave = useCallback((layout: TemplateLayout) => {
    if (editId === null) { toast.error("احفظ النموذج أولاً"); return; }
    const jsonStr = JSON.stringify(layout);
    setForm(p => ({ ...p, layoutJson: jsonStr }));
    updateMut.mutate({ id: editId, layoutJson: jsonStr });
  }, [editId, updateMut]);

  const openDesigner = () => {
    if (!editId) { handleSave(); return; }
    setView("designer");
  };
  const handleDelete = () => {
    if (editId !== null) deleteMut.mutate({ id: editId });
    setShowDelete(false);
  };

  const currentIdx      = editId !== null ? templates.findIndex(t => t.id === editId) : -1;
  const gotoIdx         = (idx: number) => { if (templates[idx]) openEdit(templates[idx]); };
  const selectType      = (id: string)  => guardDirty(() => { setSelectedType(id); setView("list"); setEditId(null); setIsDirty(false); });
  const currentTypeMeta = DOC_TYPES.find(d => d.id === selectedType);

  const parsedLayout = (() => {
    try { return form.layoutJson ? JSON.parse(form.layoutJson) as TemplateLayout : null; }
    catch { return null; }
  })();

  const getBaseCfg = (): TemplateLayout => parsedLayout ?? {
    version: 1, type: "config_v1", paperSize: form.paperSize,
    orientation: form.orientation as "portrait" | "landscape",
    elements: [], language: "bilingual", primaryColor: "#406B93",
    columns: { ...DEFAULT_COLS }, sections: { ...DEFAULT_SECS }, minRows: 5,
  };
  const setLayoutCfg = <K extends keyof TemplateLayout>(k: K, v: TemplateLayout[K]) => {
    setForm(p => ({ ...p, layoutJson: JSON.stringify({ ...getBaseCfg(), [k]: v }) })); setIsDirty(true);
  };
  const patchCol = (k: keyof TemplateLayout["columns"], v: boolean) => {
    const base = getBaseCfg();
    setForm(p => ({ ...p, layoutJson: JSON.stringify({ ...base, columns: { ...base.columns, [k]: v } }) })); setIsDirty(true);
  };
  const patchSec = (k: keyof TemplateLayout["sections"], v: boolean) => {
    const base = getBaseCfg();
    setForm(p => ({ ...p, layoutJson: JSON.stringify({ ...base, sections: { ...base.sections, [k]: v } }) })); setIsDirty(true);
  };
  const cfgLang    = parsedLayout?.language     ?? "bilingual";
  const cfgColor   = parsedLayout?.primaryColor ?? "#406B93";
  const cfgCols    = { ...DEFAULT_COLS, ...parsedLayout?.columns };
  const cfgSecs    = { ...DEFAULT_SECS, ...parsedLayout?.sections };
  const cfgMinRows = parsedLayout?.minRows ?? 5;
  const showCfgPanel = ["sales_invoice","sales_return","purchase_invoice","purchase_order",
                         "purchase_return","receipt_voucher","payment_voucher"].includes(selectedType);

  const patchUi = <K extends keyof UITemplateCfg>(k: K, v: UITemplateCfg[K]) => {
    setUiCfg(p => ({ ...p, [k]: v })); setUiDirty(true);
  };
  const patchField = (key: string, patch: Partial<UIFieldCfg>) => {
    setUiCfg(p => ({ ...p, fields: p.fields.map(f => f.key === key ? { ...f, ...patch } : f) }));
    setUiDirty(true);
  };
  const saveUiCfg = () => {
    const jsonStr = JSON.stringify(uiCfg);
    const existing = templates.find(t => {
      try { return t.layoutJson && JSON.parse(t.layoutJson).type === "ui_config_v1"; }
      catch { return false; }
    });
    if (existing) {
      updateMut.mutate({ id: existing.id, layoutJson: jsonStr, code: existing.code, nameAr: existing.nameAr, docType: selectedType, sortOrder: existing.sortOrder });
    } else {
      createMut.mutate({ code: `UI-${selectedType.toUpperCase().slice(0, 6)}`, nameAr: `قالب واجهة — ${currentTypeMeta?.label}`, docType: selectedType, paperSize: "A4", orientation: "portrait", isDefault: false, isActive: true, layoutJson: jsonStr, sortOrder: 99 });
    }
    setUiDirty(false);
  };

  /* ══════════════════ DESIGNER VIEW ══════════════════ */
  if (view === "designer") {
    return (
      <PrintTemplateDesigner
        templateName={form.nameAr || "نموذج جديد"}
        paperSize={form.paperSize}
        orientation={form.orientation}
        initialLayout={parsedLayout}
        onSave={handleDesignerSave}
        onBack={() => setView("form")}
        isSaving={updateMut.isPending}
      />
    );
  }

  /* ══════════════════ MAIN LAYOUT ══════════════════ */
  return (
    <div className="flex h-full overflow-hidden" dir="rtl">

      {/* ═══════════════════ SIDEBAR ═══════════════════ */}
      <div className="w-52 shrink-0 flex flex-col overflow-hidden"
        style={{ background: "#1E293B", borderLeft: "1px solid #0F172A" }}>

        <div className="px-3 pt-3 pb-2 shrink-0" style={{ background: "#0F172A" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#D19C05" }}>
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-[12px] leading-tight">إدارة القوالب</div>
              <div className="text-slate-500 text-[9px]">Templates Manager</div>
            </div>
          </div>
        </div>

        <div className="flex mx-2 mt-2 mb-1 rounded-lg overflow-hidden shrink-0"
          style={{ border: "1px solid #334155" }}>
          {(["print","ui"] as TemplateCategory[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors"
              style={{ background: activeTab === tab ? "#4A6FA5" : "transparent", color: activeTab === tab ? "#fff" : "#64748B" }}>
              {tab === "print" ? <><Printer className="w-3 h-3" />طباعة</> : <><Monitor className="w-3 h-3" />واجهة</>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {DOC_CATS.map(cat => {
            const items  = DOC_TYPES.filter(d => d.cat === cat.id);
            const isOpen = !collapsedCats[cat.id];
            return (
              <div key={cat.id}>
                <button onClick={() => setCollapsedCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold"
                  style={{ color: cat.color }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="flex-1 text-right">{cat.label}</span>
                  {isOpen ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRt className="w-3 h-3 opacity-60" />}
                </button>
                {isOpen && items.map(dt => {
                  const active = selectedType === dt.id;
                  return (
                    <button key={dt.id} onClick={() => selectType(dt.id)}
                      className="w-full flex items-center gap-2 py-1.5 text-[11px] transition-colors"
                      style={{ paddingRight: 20, paddingLeft: 8, background: active ? "#4A6FA5" : "transparent", color: active ? "#fff" : "#94A3B8" }}>
                      <span style={{ color: active ? "#fff" : cat.color, opacity: 0.8 }}>{dt.icon}</span>
                      <span className="flex-1 text-right leading-tight">{dt.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 shrink-0 text-[9px] text-slate-600 leading-relaxed"
          style={{ borderTop: "1px solid #334155", background: "#0F172A" }}>
          {activeTab === "print" ? "صمّم نموذج الطباعة لكل مستند" : "خصّص مظهر الشاشة وإظهار الحقول"}
        </div>
      </div>

      {/* ═══════════════════ MAIN AREA ═══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
          style={{ background: "#EBE7DE", borderBottom: "1px solid #d8d3c8" }}>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>القوالب</span>
            <span className="text-slate-300 mx-0.5">/</span>
            <span className="font-semibold text-slate-700">{currentTypeMeta?.label}</span>
            {activeTab === "ui" && (
              <><span className="text-slate-300 mx-0.5">/</span>
              <span className="text-purple-700 font-semibold">قالب الواجهة</span></>
            )}
          </div>
          <div className="flex-1" />

          {activeTab === "print" && (
            <>
              {view === "form" && (
                <>
                  <Button size="sm" variant="ghost"
                    className="h-7 px-2 text-[11px] gap-1 text-purple-700 hover:bg-purple-50 border border-purple-200"
                    onClick={openDesigner}>
                    <Paintbrush className="w-3.5 h-3.5" />تصميم بصري
                  </Button>
                  {editId !== null && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-indigo-600 hover:bg-indigo-50"
                      onClick={() => cloneMut.mutate({ id: editId })}>
                      <Copy className="w-3.5 h-3.5" />نسخ
                    </Button>
                  )}
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                </>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-green-700 hover:bg-green-50"
                onClick={handleSave} disabled={!isDirty || createMut.isPending || updateMut.isPending}>
                <Save className="w-3.5 h-3.5" />حفظ
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-indigo-700 hover:bg-indigo-50"
                onClick={openNew}>
                <Plus className="w-3.5 h-3.5" />جديد
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:bg-red-50"
                onClick={() => { if (editId !== null) setShowDelete(true); }} disabled={editId === null}>
                <Trash2 className="w-3.5 h-3.5" />حذف
              </Button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100"
                onClick={() => gotoIdx(0)} disabled={currentIdx <= 0}><ChevronLast className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100"
                onClick={() => gotoIdx(currentIdx - 1)} disabled={currentIdx <= 0}><CRight className="w-3.5 h-3.5" /></Button>
              <span className="text-[10px] text-slate-500 w-12 text-center">
                {view === "form" && currentIdx >= 0 ? `${currentIdx + 1}/${templates.length}` : `0/${templates.length}`}
              </span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100"
                onClick={() => gotoIdx(currentIdx + 1)} disabled={currentIdx >= templates.length - 1}><CLeft className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100"
                onClick={() => gotoIdx(templates.length - 1)} disabled={currentIdx >= templates.length - 1}><ChevronFirst className="w-3.5 h-3.5" /></Button>
            </>
          )}
          {activeTab === "ui" && (
            <Button size="sm" variant="ghost"
              className="h-7 px-3 text-[11px] gap-1 text-green-700 hover:bg-green-50 border border-green-200"
              onClick={saveUiCfg} disabled={!uiDirty || updateMut.isPending}>
              <Save className="w-3.5 h-3.5" />حفظ التخصيص
            </Button>
          )}
        </div>

        {/* ══════════════ PRINT TAB ══════════════ */}
        {activeTab === "print" && (
          <>
            {view === "list" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "إجمالي النماذج",  value: templates.length,                           color: "#4A6FA5", icon: <FileText className="w-4 h-4" /> },
                    { label: "مصمّمة بصرياً",   value: templates.filter(t => { try { return (JSON.parse(t.layoutJson ?? "{}") as TemplateLayout).elements?.length > 0; } catch { return false; } }).length, color: "#7C3AED", icon: <Paintbrush className="w-4 h-4" /> },
                    { label: "افتراضي",          value: templates.filter(t => t.isDefault).length,  color: "#D97706", icon: <Star className="w-4 h-4" /> },
                    { label: "فعالة",            value: templates.filter(t => t.isActive).length,   color: "#059669", icon: <CheckCircle2 className="w-4 h-4" /> },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: "#F8F5EE", border: "1px solid #E8E4DB" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: s.color + "18", color: s.color }}>{s.icon}</div>
                      <div>
                        <div className="text-[18px] font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {listQuery.isLoading ? (
                  <div className="text-center text-slate-400 text-[11px] py-8">جاري التحميل…</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-16">
                    <Printer className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p className="text-slate-400 text-[12px] mb-4">لا توجد نماذج لـ {currentTypeMeta?.label}</p>
                    <Button size="sm" onClick={openNew} className="gap-1.5 text-[12px] text-white" style={{ background: "#4A6FA5" }}>
                      <Plus className="w-3.5 h-3.5" />إنشاء نموذج جديد
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates
                      .filter(t => { try { return !t.layoutJson || JSON.parse(t.layoutJson).type !== "ui_config_v1"; } catch { return true; } })
                      .map(t => {
                        let elCount = 0;
                        try { if (t.layoutJson) elCount = (JSON.parse(t.layoutJson) as TemplateLayout).elements?.length ?? 0; } catch {}
                        const hasDesign = elCount > 0;
                        return (
                          <div key={t.id} onClick={() => openEdit(t)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group"
                            style={{ background: "#FDFAF5", border: "1px solid #E8E4DB" }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#4A6FA5"; el.style.background = "#F0EDE6"; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#E8E4DB"; el.style.background = "#FDFAF5"; }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: hasDesign ? "#7C3AED18" : "#94A3B818", color: hasDesign ? "#7C3AED" : "#94A3B8" }}>
                              {hasDesign ? <Paintbrush className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-slate-800 truncate">{t.nameAr}</span>
                                {t.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />}
                                {!t.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">معطّل</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-indigo-600">{t.code}</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-[10px] text-slate-400">{t.paperSize} / {t.orientation === "portrait" ? "عمودي" : "أفقي"}</span>
                                {hasDesign && (<><span className="text-slate-300">·</span><span className="text-[10px] text-purple-600">{elCount} عنصر</span></>)}
                              </div>
                            </div>
                            <button onClick={e => { e.stopPropagation(); cloneMut.mutate({ id: t.id }); }}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <CLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                          </div>
                        );
                      })}
                    <button onClick={openNew}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[11px] text-slate-400 transition-colors"
                      style={{ border: "2px dashed #D8D3C8" }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#4A6FA5"; el.style.color = "#4A6FA5"; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#D8D3C8"; el.style.color = ""; }}>
                      <Plus className="w-4 h-4" />إضافة نموذج طباعة جديد
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                <Panel title="بيانات النموذج" icon={<FileText className="w-3.5 h-3.5" />}>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                    <Row label="رقم النموذج *"><FI value={form.code} onChange={v => set("code", v)} placeholder="T001" /></Row>
                    <Row label="اسم النموذج *"><FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder="فاتورة ضريبية رئيسية" /></Row>
                    <Row label="الاسم الإنجليزي"><FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Tax Invoice" /></Row>
                    <Row label="نوع المستند"><FI value={currentTypeMeta?.label ?? ""} onChange={() => {}} disabled /></Row>
                    <Row label="حجم الورق">
                      <FS value={form.paperSize} onValueChange={v => set("paperSize", v)}>
                        <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                        <SelectItem value="A5">A5 (148×210mm)</SelectItem>
                        <SelectItem value="Letter">Letter (216×279mm)</SelectItem>
                        <SelectItem value="Thermal80">حراري 80mm</SelectItem>
                        <SelectItem value="Thermal58">حراري 58mm</SelectItem>
                      </FS>
                    </Row>
                    <Row label="الاتجاه">
                      <FS value={form.orientation} onValueChange={v => set("orientation", v)}>
                        <SelectItem value="portrait">عمودي (Portrait)</SelectItem>
                        <SelectItem value="landscape">أفقي (Landscape)</SelectItem>
                      </FS>
                    </Row>
                    <Row label="الحالة">
                      <FS value={form.isActive ? "active" : "inactive"} onValueChange={v => set("isActive", v === "active")}>
                        <SelectItem value="active">✓ فعال</SelectItem>
                        <SelectItem value="inactive">✗ غير فعال</SelectItem>
                      </FS>
                    </Row>
                    <div className="flex items-center">
                      <CB label="نموذج افتراضي لهذا النوع" checked={form.isDefault} onChange={v => set("isDefault", v)} />
                    </div>
                  </div>
                </Panel>

                <Panel title="التصميم البصري" icon={<Paintbrush className="w-3.5 h-3.5" />}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {parsedLayout && parsedLayout.elements.length > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-[11px] text-emerald-700 font-medium">يوجد تصميم · {parsedLayout.elements.length} عنصر</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {parsedLayout.elements.slice(0, 8).map(el => (
                              <span key={el.id} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500">{el.type}</span>
                            ))}
                            {parsedLayout.elements.length > 8 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{parsedLayout.elements.length - 8}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                          <span className="text-[11px] text-slate-400">لم يتم تصميم هذا النموذج بعد</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {parsedLayout && parsedLayout.elements.length > 0 && (
                        <button
                          onClick={() => { if (!confirm("سيُستبدل التصميم الحالي بالافتراضي. هل أنت متأكد؟")) return; seedDefaultMut.mutate({ docType: selectedType, forceReset: true }); }}
                          disabled={seedDefaultMut.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium hover:bg-slate-200 border border-slate-200 transition-colors">
                          <RotateCcw className="w-3.5 h-3.5" />الافتراضي
                        </button>
                      )}
                      <button onClick={openDesigner}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[12px] font-medium shadow-sm transition-colors"
                        style={{ background: "#7C3AED" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#6D28D9"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#7C3AED"; }}>
                        <Paintbrush className="w-4 h-4" />
                        {parsedLayout && parsedLayout.elements.length > 0 ? "تعديل التصميم" : "تصميم النموذج"}
                      </button>
                    </div>
                  </div>
                </Panel>

                {showCfgPanel && (
                  <Panel title="إعدادات طباعة الفاتورة" icon={<Settings2 className="w-3.5 h-3.5" />}>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-semibold text-slate-600">لغة الطباعة</span>
                        </div>
                        <div className="flex gap-2">
                          {[{ v: "bilingual", label: "ثنائي (عربي + English)" }, { v: "ar", label: "عربي فقط" }].map(o => (
                            <button key={o.v} onClick={() => setLayoutCfg("language", o.v as "ar" | "bilingual")}
                              className={`flex-1 py-1.5 rounded border text-[11px] transition-colors font-medium ${cfgLang === o.v ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Palette className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-semibold text-slate-600">اللون الرئيسي</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {PRESET_COLORS.map(c => (
                              <button key={c} onClick={() => setLayoutCfg("primaryColor", c)}
                                className="w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform"
                                style={{ background: c, borderColor: cfgColor === c ? "#fff" : "transparent", outline: cfgColor === c ? `2.5px solid ${c}` : "none", outlineOffset: 2 }} />
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input type="color" value={cfgColor} onChange={e => setLayoutCfg("primaryColor", e.target.value)}
                              className="w-8 h-7 rounded cursor-pointer border border-slate-200 p-0.5" />
                            <span className="text-[10px] font-mono text-slate-400">{cfgColor}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Table2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-semibold text-slate-600">أعمدة جدول الأصناف</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                          {COL_LIST.map(c => (
                            <label key={c.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={cfgCols[c.key]} onChange={e => patchCol(c.key, e.target.checked)} />
                              <span className={`text-[11px] ${cfgCols[c.key] ? "text-slate-700" : "text-slate-300"}`}>{c.ar}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[11px] font-semibold text-slate-600">الأقسام</span>
                          </div>
                          <div className="space-y-1">
                            {SEC_LIST.map(s => (
                              <label key={s.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={cfgSecs[s.key]} onChange={e => patchSec(s.key, e.target.checked)} />
                                <span className={`text-[11px] ${cfgSecs[s.key] ? "text-slate-700" : "text-slate-300"}`}>{s.ar}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-600 mb-2">
                            الصفوف الفارغة الأدنى: <span className="text-indigo-600 font-bold">{cfgMinRows}</span>
                          </div>
                          <input type="range" min={0} max={15} step={1} value={cfgMinRows}
                            onChange={e => setLayoutCfg("minRows", Number(e.target.value))}
                            className="w-full accent-indigo-600" />
                          <div className="flex justify-between text-[9px] text-slate-300 mt-0.5"><span>0</span><span>15</span></div>
                        </div>
                      </div>
                    </div>
                  </Panel>
                )}

                <Panel title="وصف وملاحظات" icon={<Info className="w-3.5 h-3.5" />}>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                    placeholder="وصف النموذج أو ملاحظات التخصيص…" rows={3}
                    className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded resize-none focus:outline-none focus:border-indigo-400 bg-white" />
                </Panel>
              </div>
            )}
          </>
        )}

        {/* ══════════════ UI TEMPLATE TAB ══════════════ */}
        {activeTab === "ui" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-blue-800">قالب الواجهة — {currentTypeMeta?.label}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">تحكم في مظهر الشاشة وترتيب الحقول وإظهارها.</p>
              </div>
            </div>

            <Panel title="المظهر العام" icon={<Palette className="w-3.5 h-3.5" />}
              action={
                <button onClick={() => setCollapsedSecs(p => ({ ...p, appearance: !p.appearance }))} className="text-slate-400 hover:text-slate-600">
                  {collapsedSecs.appearance ? <ChevronRt className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              }>
              {!collapsedSecs.appearance && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">اللون الرئيسي</label>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => patchUi("primaryColor", c)}
                            className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
                            style={{ background: c, borderColor: uiCfg.primaryColor === c ? "#fff" : "transparent", outline: uiCfg.primaryColor === c ? `2px solid ${c}` : "none", outlineOffset: 1.5 }} />
                        ))}
                      </div>
                      <input type="color" value={uiCfg.primaryColor} onChange={e => patchUi("primaryColor", e.target.value)}
                        className="w-7 h-6 rounded cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">لون الخلفية</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={uiCfg.bgColor} onChange={e => patchUi("bgColor", e.target.value)}
                        className="w-7 h-6 rounded cursor-pointer border border-slate-200" />
                      <span className="text-[10px] font-mono text-slate-400">{uiCfg.bgColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">نوع الخط</label>
                    <FS value={uiCfg.fontFamily} onValueChange={v => patchUi("fontFamily", v)}>
                      <SelectItem value="Noto Kufi Arabic">Noto Kufi Arabic</SelectItem>
                      <SelectItem value="Tajawal">Tajawal</SelectItem>
                      <SelectItem value="Cairo">Cairo</SelectItem>
                      <SelectItem value="Almarai">Almarai</SelectItem>
                    </FS>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">حجم الخط: {uiCfg.fontSize}px</label>
                    <input type="range" min={10} max={16} step={1} value={uiCfg.fontSize}
                      onChange={e => patchUi("fontSize", Number(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">تدوير الزوايا: {uiCfg.borderRadius}px</label>
                    <input type="range" min={0} max={16} step={2} value={uiCfg.borderRadius}
                      onChange={e => patchUi("borderRadius", Number(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="إعدادات الجدول" icon={<Columns3 className="w-3.5 h-3.5" />}
              action={
                <button onClick={() => setCollapsedSecs(p => ({ ...p, table: !p.table }))} className="text-slate-400 hover:text-slate-600">
                  {collapsedSecs.table ? <ChevronRt className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              }>
              {!collapsedSecs.table && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">ارتفاع الصف: {uiCfg.tableRowHeight}px</label>
                    <input type="range" min={24} max={56} step={4} value={uiCfg.tableRowHeight}
                      onChange={e => patchUi("tableRowHeight", Number(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5">ارتفاع رأس الجدول: {uiCfg.tableHeaderHeight}px</label>
                    <input type="range" min={28} max={56} step={4} value={uiCfg.tableHeaderHeight}
                      onChange={e => patchUi("tableHeaderHeight", Number(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="الحقول وعناصر الشاشة" icon={<Sliders className="w-3.5 h-3.5" />}
              action={
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400">
                    {uiCfg.fields.filter(f => f.visibility !== "hidden").length} من {uiCfg.fields.length} ظاهر
                  </span>
                  <button onClick={() => setCollapsedSecs(p => ({ ...p, fields: !p.fields }))} className="text-slate-400 hover:text-slate-600">
                    {collapsedSecs.fields ? <ChevronRt className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              }>
              {!collapsedSecs.fields && (
                <div>
                  <div className="grid gap-2 px-1 pb-1.5 mb-1 text-[9px] font-bold text-slate-400"
                    style={{ gridTemplateColumns: "24px 1fr 96px 52px" }}>
                    <span className="text-center">#</span>
                    <span>الحقل</span>
                    <span className="text-center">الإظهار</span>
                    <span className="text-center">إلزامي</span>
                  </div>
                  <div className="space-y-0.5">
                    {uiCfg.fields.map((f, i) => (
                      <div key={f.key} className="grid gap-2 items-center px-1 py-1 rounded hover:bg-slate-50 group"
                        style={{ gridTemplateColumns: "24px 1fr 96px 52px" }}>
                        <span className="text-[10px] text-slate-300 text-center font-mono">{i + 1}</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <GripVertical className="w-3 h-3 text-slate-200 group-hover:text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-700 truncate">{f.label}</span>
                        </div>
                        <div className="flex rounded overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
                          {(["visible","readonly","hidden"] as FieldVisibility[]).map(v => (
                            <button key={v} onClick={() => patchField(f.key, { visibility: v })}
                              className="flex-1 flex items-center justify-center py-0.5 transition-colors"
                              title={v === "visible" ? "ظاهر" : v === "readonly" ? "قراءة فقط" : "مخفي"}
                              style={{
                                background: f.visibility === v ? (v === "hidden" ? "#FEF2F2" : v === "readonly" ? "#FFFBEB" : "#F0FDF4") : "#fff",
                                color: f.visibility === v ? (v === "hidden" ? "#DC2626" : v === "readonly" ? "#D97706" : "#059669") : "#CBD5E1",
                              }}>
                              {v === "visible" ? <Eye className="w-3 h-3" /> : v === "readonly" ? <Sliders className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-center">
                          <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={f.required}
                            onChange={e => patchField(f.key, { required: e.target.checked })} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-emerald-500" />ظاهر وقابل للتعديل</span>
                    <span className="flex items-center gap-1"><Sliders className="w-3 h-3 text-amber-500" />للقراءة فقط</span>
                    <span className="flex items-center gap-1"><EyeOff className="w-3 h-3 text-red-500" />مخفي</span>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={showUnsaved} onOpenChange={open => { if (!open) { setShowUnsaved(false); setPendingAction(null); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm">تغييرات غير محفوظة</DialogTitle></DialogHeader>
          <p className="text-[12px] text-slate-500 py-1">يوجد تغييرات غير محفوظة، هل تريد الاستمرار؟</p>
          <DialogFooter className="gap-2">
            <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { handleSave(); setShowUnsaved(false); }}>حفظ أولاً</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => { setIsDirty(false); setShowUnsaved(false); pendingAction?.(); setPendingAction(null); }}>تجاهل</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => { setShowUnsaved(false); setPendingAction(null); }}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-sm">تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-[12px] text-slate-500 py-1">هل تريد حذف نموذج <strong>{form.nameAr}</strong>؟ سيُحذف معه التصميم المرفق.</p>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={handleDelete}>حذف</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
