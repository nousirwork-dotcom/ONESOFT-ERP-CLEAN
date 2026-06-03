import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Type, Building2, Image, QrCode, BarChart2, Users, FileText,
  LayoutGrid, Calculator, PenLine, MessageSquare, Minus,
  Trash2, Save, ArrowLeft, AlignRight, AlignLeft, AlignCenter,
  Bold, Plus, Eye, EyeOff, Layers, CornerDownLeft,
  Settings2, Palette, Globe2, Table2,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
export type ElementType =
  | "text" | "image" | "qr" | "barcode"
  | "company_info" | "customer_info" | "invoice_info"
  | "items_table" | "totals" | "signature" | "notes" | "line";

export type LayoutElement = {
  id: string;
  type: ElementType;
  x: number; y: number;   // mm from top-left
  w: number; h: number;   // mm
  content?:    string;
  fontSize?:   number;
  fontWeight?: "normal" | "bold";
  textAlign?:  "right" | "left" | "center";
  color?:      string;
  bgColor?:    string;
  border?:     boolean;
};

export type TemplateLayout = {
  version:     1;
  type:        "config_v1";
  paperSize:   string;
  orientation: "portrait" | "landscape";
  elements:    LayoutElement[];
  // ─── config_v1 fields (used by InvoicePrintModal) ───────────────────
  language:    "ar" | "bilingual";
  primaryColor: string;
  columns: {
    num: boolean; code: boolean; name: boolean; unit: boolean;
    qty: boolean; price: boolean; discount: boolean;
    taxable: boolean; taxRate: boolean; taxAmt: boolean; total: boolean;
  };
  minRows:  number;
  sections: {
    sellerInfo: boolean; customerInfo: boolean;
    amountInWords: boolean; pageNumber: boolean; signatures: boolean;
  };
};

const DEFAULT_COLS: TemplateLayout["columns"] = {
  num: true, code: true, name: true, unit: false,
  qty: true, price: true, discount: true,
  taxable: true, taxRate: true, taxAmt: true, total: true,
};
const DEFAULT_SECS: TemplateLayout["sections"] = {
  sellerInfo: true, customerInfo: true,
  amountInWords: true, pageNumber: true, signatures: false,
};

const COL_LIST: { key: keyof TemplateLayout["columns"]; ar: string; en: string }[] = [
  { key: "num",      ar: "م",               en: "No."            },
  { key: "code",     ar: "رمز الصنف",       en: "Item Code"      },
  { key: "name",     ar: "اسم الصنف",       en: "Item Name"      },
  { key: "unit",     ar: "وحدة",            en: "Unit"           },
  { key: "qty",      ar: "الكمية",          en: "Qty"            },
  { key: "price",    ar: "السعر",           en: "Price"          },
  { key: "discount", ar: "الخصم",           en: "Discount"       },
  { key: "taxable",  ar: "خاضع للضريبة",   en: "Taxable"        },
  { key: "taxRate",  ar: "نسبة الضريبة",   en: "Tax Rate"       },
  { key: "taxAmt",   ar: "مبلغ الضريبة",   en: "Tax Amt"        },
  { key: "total",    ar: "الإجمالي",        en: "Total Incl VAT" },
];

const THEME_COLORS = [
  "#406B93","#1D4ED8","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#374151",
];

/* ─── Paper sizes (mm) ─── */
const PAPERS: Record<string, { w: number; h: number; label: string }> = {
  A4:        { w: 210, h: 297, label: "A4" },
  A5:        { w: 148, h: 210, label: "A5" },
  Letter:    { w: 216, h: 279, label: "Letter" },
  Thermal80: { w:  80, h: 280, label: "حراري 80mm" },
  Thermal58: { w:  58, h: 280, label: "حراري 58mm" },
};

/* ─── Default element sizes (mm) ─── */
const DEFAULTS: Record<ElementType, { w: number; h: number }> = {
  text:         { w: 80,  h: 8  },
  image:        { w: 40,  h: 25 },
  qr:           { w: 25,  h: 25 },
  barcode:      { w: 60,  h: 15 },
  company_info: { w: 90,  h: 30 },
  customer_info:{ w: 90,  h: 35 },
  invoice_info: { w: 90,  h: 30 },
  items_table:  { w: 190, h: 65 },
  totals:       { w: 80,  h: 35 },
  signature:    { w: 60,  h: 20 },
  notes:        { w: 150, h: 20 },
  line:         { w: 190, h: 1  },
};

/* ─── Palette ─── */
const PALETTE: { type: ElementType; label: string; icon: React.ReactNode }[] = [
  { type: "text",          label: "نص / متغير",     icon: <Type className="w-3.5 h-3.5" />         },
  { type: "company_info",  label: "بيانات الشركة",  icon: <Building2 className="w-3.5 h-3.5" />    },
  { type: "image",         label: "صورة / شعار",    icon: <Image className="w-3.5 h-3.5" />        },
  { type: "qr",            label: "QR Code",          icon: <QrCode className="w-3.5 h-3.5" />      },
  { type: "barcode",       label: "باركود",           icon: <BarChart2 className="w-3.5 h-3.5" />   },
  { type: "customer_info", label: "بيانات العميل",   icon: <Users className="w-3.5 h-3.5" />        },
  { type: "invoice_info",  label: "بيانات الفاتورة", icon: <FileText className="w-3.5 h-3.5" />    },
  { type: "items_table",   label: "جدول الأصناف",    icon: <LayoutGrid className="w-3.5 h-3.5" />  },
  { type: "totals",        label: "الإجماليات",      icon: <Calculator className="w-3.5 h-3.5" />  },
  { type: "signature",     label: "التوقيع",          icon: <PenLine className="w-3.5 h-3.5" />     },
  { type: "notes",         label: "ملاحظات",         icon: <MessageSquare className="w-3.5 h-3.5" />},
  { type: "line",          label: "خط فاصل",         icon: <Minus className="w-3.5 h-3.5" />       },
];

/* ─── Dynamic variables ─── */
const VARS = [
  ["CompanyName","اسم الشركة"], ["CompanyAddress","عنوان الشركة"], ["CompanyPhone","هاتف الشركة"],
  ["CompanyTaxNo","رقم الضريبي"], ["CompanyLogo","شعار الشركة"],
  ["InvoiceNo","رقم الفاتورة"],  ["InvoiceDate","تاريخ الفاتورة"], ["DueDate","تاريخ الاستحقاق"],
  ["InvoiceType","نوع الفاتورة"], ["InvoiceRef","مرجع الفاتورة"],
  ["CustomerName","اسم العميل"],  ["CustomerPhone","هاتف العميل"],  ["CustomerAddress","عنوان العميل"],
  ["CustomerCode","كود العميل"],  ["CustomerTaxNo","رقم ضريبي العميل"],
  ["Total","المجموع"],            ["TaxAmount","الضريبة"],          ["Discount","الخصم"],
  ["NetTotal","الصافي"],          ["Paid","المدفوع"],               ["Balance","الرصيد"],
  ["Notes","ملاحظات"],            ["WarehouseName","المخزن"],       ["SalesmanName","المندوب"],
  ["CashierName","أمين الصندوق"],
];

/* ─── ID generator ─── */
let _seq = 0;
const uid = () => `el_${Date.now()}_${++_seq}`;

/* ─── Element preview renderer ─── */
function ElementPreview({ el, scale, selected }: { el: LayoutElement; scale: number; selected: boolean }) {
  const base: React.CSSProperties = {
    position:    "absolute",
    left:        el.x * scale,
    top:         el.y * scale,
    width:       el.w * scale,
    height:      el.h * scale,
    boxSizing:   "border-box",
    overflow:    "hidden",
    cursor:      "move",
    userSelect:  "none",
    direction:   "rtl",
    border:      selected
      ? "2px solid #3b82f6"
      : el.border
        ? `1px solid ${el.color ?? "#aaa"}`
        : "1px dashed #cbd5e1",
    background:  el.bgColor ?? (selected ? "#eff6ff" : "rgba(255,255,255,0.6)"),
  };

  const txt: React.CSSProperties = {
    fontSize:   Math.max(6, (el.fontSize ?? 10) * scale),
    fontWeight: el.fontWeight ?? "normal",
    textAlign:  (el.textAlign ?? "right") as any,
    color:      el.color ?? "#1a1a1a",
    lineHeight: 1.35,
    padding:    "1px 3px",
    width:      "100%",
  };

  if (el.type === "line") {
    return (
      <div style={{ ...base, border: selected ? "2px solid #3b82f6" : "none", display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%", height: 1, background: el.color ?? "#333" }} />
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <Image style={{ width: 14 * scale, height: 14 * scale, opacity: 0.4 }} />
        <span style={{ fontSize: 7 * scale, color: "#94a3b8" }}>صورة / شعار</span>
      </div>
    );
  }
  if (el.type === "qr") {
    const cell = 4 * scale;
    const pat = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1];
    return (
      <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(4,${cell}px)`, gap: 1 }}>
          {pat.map((b,i) => <div key={i} style={{ width: cell, height: cell, background: b ? "#333" : "transparent" }} />)}
        </div>
        <span style={{ fontSize: 7 * scale, color: "#94a3b8" }}>QR Code</span>
      </div>
    );
  }
  if (el.type === "barcode") {
    return (
      <div style={{ ...base, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <div style={{ display: "flex", gap: 1, height: 12 * scale }}>
          {Array.from({ length: 24 }).map((_,i) => (
            <div key={i} style={{ width: (i % 3 === 0 ? 2.5 : 1.2) * scale, height: "100%", background: "#333" }} />
          ))}
        </div>
        <span style={{ fontSize: 7 * scale, color: "#666", fontFamily: "monospace" }}>||||||||||||||</span>
      </div>
    );
  }

  const PREVIEW_CONTENT: Record<ElementType, string> = {
    text:         el.content ?? "نص هنا",
    image:        "",
    qr:           "",
    barcode:      "",
    company_info: "اسم الشركة\nالعنوان | الهاتف\nالرقم الضريبي: {{CompanyTaxNo}}",
    customer_info:"العميل: {{CustomerName}}\n{{CustomerPhone}}  ·  {{CustomerAddress}}",
    invoice_info: "رقم: {{InvoiceNo}}   تاريخ: {{InvoiceDate}}\nنوع: {{InvoiceType}}   مرجع: {{InvoiceRef}}",
    items_table:  "الصنف          الكمية    السعر    الإجمالي\n─────────────────────────────────────\nاسم الصنف      1         100.00   100.00\n─────────────────────────────────────",
    totals:       "المجموع الفرعي: {{Total}}\nالضريبة (15%): {{TaxAmount}}\nالصافي:        {{NetTotal}}\nالمدفوع:       {{Paid}}\nالمتبقي:       {{Balance}}",
    signature:    "التوقيع: ___________________________",
    notes:        el.content ?? "ملاحظات: {{Notes}}",
    line:         "",
  };

  return (
    <div style={base}>
      <pre style={{ ...txt, margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
        {PREVIEW_CONTENT[el.type]}
      </pre>
    </div>
  );
}

/* ─── Main Designer Component ─── */
interface DesignerProps {
  templateName: string;
  paperSize:    string;
  orientation:  string;
  initialLayout?: TemplateLayout | null;
  onSave:  (layout: TemplateLayout) => void;
  onBack:  () => void;
  isSaving?: boolean;
}

export default function PrintTemplateDesigner({
  templateName, paperSize, orientation, initialLayout, onSave, onBack, isSaving,
}: DesignerProps) {
  const paper    = PAPERS[paperSize] ?? PAPERS.A4;
  const pW       = orientation === "landscape" ? paper.h : paper.w;
  const pH       = orientation === "landscape" ? paper.w : paper.h;
  const CWIDTH   = 510;
  const scale    = CWIDTH / pW;
  const cHeight  = pH * scale;

  const [elements,   setElements]   = useState<LayoutElement[]>(() => initialLayout?.elements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid,   setShowGrid]   = useState(true);
  const [isDirty,    setIsDirty]    = useState(false);
  const [rightTab,   setRightTab]   = useState<"element" | "settings">("element");

  // ─── config_v1 state ──────────────────────────────────────────────────
  const [cfgLanguage,     setCfgLanguage]     = useState<"ar"|"bilingual">(initialLayout?.language ?? "bilingual");
  const [cfgColor,        setCfgColor]        = useState(initialLayout?.primaryColor ?? "#406B93");
  const [cfgColumns,      setCfgColumns]      = useState<TemplateLayout["columns"]>({ ...DEFAULT_COLS, ...initialLayout?.columns });
  const [cfgSections,     setCfgSections]     = useState<TemplateLayout["sections"]>({ ...DEFAULT_SECS, ...initialLayout?.sections });
  const [cfgMinRows,      setCfgMinRows]      = useState(initialLayout?.minRows ?? 5);

  const patchCol = (k: keyof TemplateLayout["columns"], v: boolean) => {
    setCfgColumns(p => ({ ...p, [k]: v })); setIsDirty(true);
  };
  const patchSec = (k: keyof TemplateLayout["sections"], v: boolean) => {
    setCfgSections(p => ({ ...p, [k]: v })); setIsDirty(true);
  };

  const selected = elements.find(e => e.id === selectedId);

  const dragRef  = useRef<{ id: string; sx: number; sy: number; mx: number; my: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* reload when parent passes new layout */
  useEffect(() => {
    if (initialLayout) {
      setElements(initialLayout.elements ?? []);
      setCfgLanguage(initialLayout.language ?? "bilingual");
      setCfgColor(initialLayout.primaryColor ?? "#406B93");
      setCfgColumns({ ...DEFAULT_COLS, ...initialLayout.columns });
      setCfgSections({ ...DEFAULT_SECS, ...initialLayout.sections });
      setCfgMinRows(initialLayout.minRows ?? 5);
      setIsDirty(false);
    }
  }, [initialLayout]);

  /* global mouseup to end drag */
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  /* drag move */
  const onCanvasMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = (e.clientX - d.mx) / scale;
    const dy = (e.clientY - d.my) / scale;
    setElements(prev => prev.map(el => el.id !== d.id ? el : {
      ...el,
      x: Math.max(0, Math.min(pW - el.w, d.sx + dx)),
      y: Math.max(0, Math.min(pH - el.h, d.sy + dy)),
    }));
  }, [scale, pW, pH]);

  const addElement = useCallback((type: ElementType) => {
    const def = DEFAULTS[type];
    const newEl: LayoutElement = {
      id: uid(), type,
      x: Math.max(0, (pW - def.w) / 2),
      y: Math.max(0, pH * 0.1),
      w: Math.min(def.w, pW - 10),
      h: def.h,
      content:    type === "text" ? "{{InvoiceNo}}" : undefined,
      fontSize:   10,
      fontWeight: "normal",
      textAlign:  "right",
      color:      "#1a1a1a",
      border:     false,
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
    setIsDirty(true);
  }, [pW, pH]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
    setIsDirty(true);
  }, [selectedId]);

  const upd = useCallback(<K extends keyof LayoutElement>(k: K, v: LayoutElement[K]) => {
    if (!selectedId) return;
    setElements(prev => prev.map(e => e.id === selectedId ? { ...e, [k]: v } : e));
    setIsDirty(true);
  }, [selectedId]);

  const handleSave = () => {
    const layout: TemplateLayout = {
      version:      1,
      type:         "config_v1",
      paperSize,
      orientation:  orientation as any,
      elements,
      language:     cfgLanguage,
      primaryColor: cfgColor,
      columns:      cfgColumns,
      sections:     cfgSections,
      minRows:      cfgMinRows,
    };
    onSave(layout);
    setIsDirty(false);
  };

  /* ─── Render ─── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-100" dir="rtl">

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-slate-200 bg-white shadow-sm">
        <button onClick={() => {
          if (!isDirty || confirm("يوجد تعديلات غير محفوظة، هل تريد الخروج؟")) onBack();
        }}
          className="flex items-center gap-1 px-2 h-7 rounded text-[11px] text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> رجوع
        </button>
        <span className="font-semibold text-[12px] text-slate-700 truncate max-w-[200px]">{templateName}</span>
        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
          {PAPERS[paperSize]?.label ?? paperSize} · {orientation === "portrait" ? "عمودي" : "أفقي"}
        </span>
        <span className="text-[10px] text-slate-400">{elements.length} عنصر</span>
        {isDirty && <span className="text-[10px] text-amber-600">● غير محفوظ</span>}
        <div className="flex-1" />
        <button onClick={() => setShowGrid(v => !v)}
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[10px] transition-colors ${showGrid ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
          {showGrid ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          الشبكة
        </button>
        {selected && (
          <button onClick={deleteSelected}
            className="flex items-center gap-1 px-2 h-7 rounded text-[11px] text-red-600 hover:bg-red-50 border border-red-200 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </button>
        )}
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-1.5 px-3 h-8 rounded bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-60 transition-colors">
          <Save className="w-3.5 h-3.5" />
          {isSaving ? "جاري الحفظ…" : "حفظ التصميم"}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: palette ── */}
        <div className="w-36 shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-y-auto">
          <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">العناصر</span>
            </div>
          </div>
          <div className="py-1">
            {PALETTE.map(({ type, label, icon }) => (
              <button key={type} onClick={() => addElement(type)}
                className="group w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-50 text-right transition-colors">
                <span className="text-slate-400 group-hover:text-indigo-500 shrink-0 transition-colors">{icon}</span>
                <span className="flex-1">{label}</span>
                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Center: canvas ── */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-slate-300"
          style={{ backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
          <div className="relative bg-white shadow-2xl select-none"
            ref={canvasRef}
            style={{ width: CWIDTH, height: cHeight, flexShrink: 0, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
            onMouseMove={onCanvasMove}
            onMouseUp={() => { dragRef.current = null; }}
            onClick={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
          >
            {/* Margin guide */}
            <div style={{
              position: "absolute", inset: `${10 * scale}px`,
              border: "1px dashed #bfdbfe",
              pointerEvents: "none", zIndex: 0,
            }} />
            {/* Grid */}
            {showGrid && (
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.3,
                backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent ${5*scale-1}px,#e0e7ff ${5*scale-1}px,#e0e7ff ${5*scale}px),
                  repeating-linear-gradient(90deg,transparent,transparent ${5*scale-1}px,#e0e7ff ${5*scale-1}px,#e0e7ff ${5*scale}px)`,
              }} />
            )}
            {/* Elements */}
            {elements.map(el => (
              <div key={el.id} style={{ position: "absolute", left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale, zIndex: selectedId === el.id ? 10 : 1 }}
                onMouseDown={e => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                  dragRef.current = { id: el.id, sx: el.x, sy: el.y, mx: e.clientX, my: e.clientY };
                }}
              >
                <ElementPreview el={el} scale={scale} selected={selectedId === el.id} />
                {selectedId === el.id && (
                  <>
                    {/* resize handles */}
                    {[
                      { cursor: "nw-resize", top: -4, left: -4 },
                      { cursor: "ne-resize", top: -4, right: -4 },
                      { cursor: "sw-resize", bottom: -4, left: -4 },
                      { cursor: "se-resize", bottom: -4, right: -4 },
                    ].map((h, i) => (
                      <div key={i} style={{
                        position: "absolute", width: 8, height: 8, background: "#3b82f6",
                        border: "1px solid white", borderRadius: 2, ...h,
                      }} />
                    ))}
                    {/* coordinates tooltip */}
                    <div style={{
                      position: "absolute", top: -18, right: 0,
                      background: "#3b82f6", color: "#fff",
                      fontSize: 8, padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap",
                    }}>
                      {Math.round(el.x)},{Math.round(el.y)} mm · {Math.round(el.w)}×{Math.round(el.h)} mm
                    </div>
                  </>
                )}
              </div>
            ))}
            {/* Empty state */}
            {elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-40 pointer-events-none">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-[13px] font-medium text-slate-400">ورقة فارغة</p>
                <p className="text-[11px] text-slate-300 mt-1">اضغط على عنصر من القائمة اليسرى لإضافته</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: properties + settings ── */}
        <div className="w-56 shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-y-auto">
          {/* Tab header */}
          <div className="flex border-b border-slate-200 shrink-0 sticky top-0 bg-white z-10">
            <button
              onClick={() => setRightTab("element")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${rightTab === "element" ? "border-b-2 border-indigo-500 text-indigo-700 bg-indigo-50" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <Layers className="w-3 h-3" />العنصر
            </button>
            <button
              onClick={() => setRightTab("settings")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${rightTab === "settings" ? "border-b-2 border-purple-500 text-purple-700 bg-purple-50" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <Settings2 className="w-3 h-3" />الفاتورة
            </button>
          </div>

          {/* ── Settings Tab ── */}
          {rightTab === "settings" && (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
              {/* اللغة */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Globe2 className="w-3 h-3 text-purple-500" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">اللغة</span>
                </div>
                <div className="flex gap-1.5">
                  {[{ v: "bilingual", ar: "ثنائي اللغة" }, { v: "ar", ar: "عربي فقط" }].map(o => (
                    <button key={o.v} onClick={() => { setCfgLanguage(o.v as any); setIsDirty(true); }}
                      className={`flex-1 py-1 rounded border text-[10px] transition-colors ${cfgLanguage === o.v ? "border-purple-400 bg-purple-50 text-purple-700 font-bold" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      {o.ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* اللون الرئيسي */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Palette className="w-3 h-3 text-purple-500" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">اللون الرئيسي</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {THEME_COLORS.map(c => (
                    <button key={c} onClick={() => { setCfgColor(c); setIsDirty(true); }}
                      className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
                      style={{ background: c, borderColor: cfgColor === c ? "#fff" : "transparent", outline: cfgColor === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={cfgColor} onChange={e => { setCfgColor(e.target.value); setIsDirty(true); }}
                    className="w-7 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                  <span className="text-[9px] font-mono text-slate-500">{cfgColor}</span>
                </div>
              </div>

              {/* الأعمدة */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Table2 className="w-3 h-3 text-purple-500" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">أعمدة الجدول</span>
                </div>
                <div className="space-y-1">
                  {COL_LIST.map(c => (
                    <label key={c.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="w-3 h-3 accent-indigo-600" checked={cfgColumns[c.key]} onChange={e => patchCol(c.key, e.target.checked)} />
                      <span className={`text-[10px] ${cfgColumns[c.key] ? "text-slate-700" : "text-slate-300"}`}>{c.ar}</span>
                      <span className={`text-[8px] mr-auto ${cfgColumns[c.key] ? "text-slate-400" : "text-slate-200"}`}>{c.en}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* الأقسام */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <FileText className="w-3 h-3 text-purple-500" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">الأقسام</span>
                </div>
                <div className="space-y-1">
                  {([
                    { key: "sellerInfo",    ar: "بيانات البائع"    },
                    { key: "customerInfo",  ar: "بيانات العميل"    },
                    { key: "amountInWords", ar: "المبلغ كتابةً"    },
                    { key: "pageNumber",    ar: "رقم الصفحة"       },
                    { key: "signatures",    ar: "خانات التوقيع"    },
                  ] as { key: keyof TemplateLayout["sections"]; ar: string }[]).map(s => (
                    <label key={s.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="w-3 h-3 accent-indigo-600" checked={cfgSections[s.key]} onChange={e => patchSec(s.key, e.target.checked)} />
                      <span className={`text-[10px] ${cfgSections[s.key] ? "text-slate-700" : "text-slate-300"}`}>{s.ar}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* الصفوف الفارغة */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">الصفوف الفارغة</span>
                  <span className="text-[11px] font-bold text-purple-700">{cfgMinRows}</span>
                </div>
                <input type="range" min={0} max={15} step={1} value={cfgMinRows}
                  onChange={e => { setCfgMinRows(Number(e.target.value)); setIsDirty(true); }}
                  className="w-full accent-purple-600" />
              </div>
            </div>
          )}

          {/* ── Element Properties Tab ── */}
          {rightTab === "element" && (<>
          {selected ? (
            <div className="p-2.5 space-y-3">
              {/* type badge */}
              <div className="flex items-center gap-1.5 bg-indigo-50 rounded px-2 py-1">
                {PALETTE.find(p => p.type === selected.type)?.icon}
                <span className="text-[11px] text-indigo-700 font-medium">
                  {PALETTE.find(p => p.type === selected.type)?.label}
                </span>
              </div>

              {/* Position */}
              <div>
                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">الموضع والحجم</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["x","y","w","h"] as const).map(k => (
                    <div key={k}>
                      <div className="text-[8px] text-slate-400 mb-0.5">{k.toUpperCase()} (mm)</div>
                      <Input type="number" value={Math.round(selected[k] as number)}
                        onChange={e => upd(k, parseFloat(e.target.value) || 0)}
                        className="h-6 text-[10px] px-1.5 rounded focus-visible:ring-0 border-slate-200 font-mono" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Content (text / notes) */}
              {(selected.type === "text" || selected.type === "notes") && (
                <div>
                  <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">المحتوى</div>
                  <textarea value={selected.content ?? ""}
                    onChange={e => upd("content", e.target.value)}
                    placeholder="أدخل النص أو {{متغير}}"
                    className="w-full h-16 text-[10px] px-2 py-1 border border-slate-200 rounded resize-none focus:outline-none focus:border-indigo-400"
                    dir="rtl" />
                  <div className="text-[9px] text-slate-400 mt-1.5 mb-1">متغيرات جاهزة (اضغط لإدراج):</div>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                    {VARS.map(([v, lbl]) => (
                      <button key={v}
                        onClick={() => upd("content", (selected.content ?? "") + `{{${v}}}`)}
                        className="text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        title={`{{${v}}}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Typography */}
              {selected.type !== "line" && (
                <div>
                  <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">الخط</div>
                  <div className="flex gap-1.5 items-center mb-1.5">
                    <div className="flex-1">
                      <div className="text-[8px] text-slate-400 mb-0.5">الحجم</div>
                      <Input type="number" value={selected.fontSize ?? 10} min={6} max={60}
                        onChange={e => upd("fontSize", parseInt(e.target.value) || 10)}
                        className="h-6 text-[10px] px-1.5 rounded focus-visible:ring-0 border-slate-200" />
                    </div>
                    <div className="mt-3.5">
                      <button onClick={() => upd("fontWeight", selected.fontWeight === "bold" ? "normal" : "bold")}
                        className={`w-7 h-6 rounded border flex items-center justify-center transition-colors ${selected.fontWeight === "bold" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                        <Bold className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {/* Alignment */}
                  {selected.type !== "qr" && selected.type !== "image" && (
                    <div className="flex gap-1">
                      {(["right","center","left"] as const).map(a => (
                        <button key={a} onClick={() => upd("textAlign", a)}
                          className={`flex-1 h-6 rounded border flex items-center justify-center transition-colors ${selected.textAlign === a ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                          {a === "right" ? <AlignRight className="w-3 h-3" /> : a === "center" ? <AlignCenter className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Color */}
              <div>
                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">اللون</div>
                <div className="flex gap-1.5 items-center">
                  <input type="color" value={selected.color ?? "#1a1a1a"}
                    onChange={e => upd("color", e.target.value)}
                    className="w-8 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                  <Input value={selected.color ?? "#1a1a1a"}
                    onChange={e => upd("color", e.target.value)}
                    className="h-6 text-[10px] px-1.5 rounded flex-1 font-mono focus-visible:ring-0 border-slate-200" />
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {["#1a1a1a","#1e40af","#dc2626","#15803d","#7e22ce","#374151","#6b7280"].map(c => (
                    <button key={c} onClick={() => upd("color", c)}
                      className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                      style={{ background: c }} />
                  ))}
                </div>
              </div>

              {/* Border toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.border ?? false}
                  onChange={e => upd("border", e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-600" />
                <span className="text-[11px] text-slate-600">إطار حول العنصر</span>
              </label>

              {/* Delete */}
              <button onClick={deleteSelected}
                className="w-full flex items-center justify-center gap-1 h-7 rounded border border-red-200 text-red-600 text-[11px] hover:bg-red-50 transition-colors mt-1">
                <Trash2 className="w-3.5 h-3.5" /> حذف العنصر
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50">
              <CornerDownLeft className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-[11px] text-slate-400">اختر عنصراً من الورقة لعرض خصائصه</p>
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
