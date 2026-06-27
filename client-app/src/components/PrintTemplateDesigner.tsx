import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Type, Building2, Image, QrCode, BarChart2, Users, FileText,
  LayoutGrid, Calculator, PenLine, MessageSquare, Minus,
  Trash2, Save, ArrowLeft, AlignRight, AlignLeft, AlignCenter,
  Bold, Plus, Eye, EyeOff, Layers, CornerDownLeft,
  Settings2, Palette, Globe2, Table2, Monitor,
  Undo2, Redo2, Copy, Clipboard, Download, Upload,
  BookOpen, Square, GripVertical, Magnet, X, Check, Hash, List,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildInvoiceHtml } from "@/lib/buildInvoiceHtml";
import type { InvPrintData } from "@/lib/buildInvoiceHtml";

/* ─── Types ─── */
export type ElementType =
  | "text" | "image" | "qr" | "barcode" | "rect" | "vline"
  | "company_info" | "customer_info" | "invoice_info"
  | "items_table" | "totals" | "signature" | "notes" | "line";

export type LayoutElement = {
  id: string;
  type: ElementType;
  x: number; y: number;
  w: number; h: number;
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

/* ─── Defaults ─── */
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
  A4:        { w: 210, h: 297, label: "A4"         },
  A5:        { w: 148, h: 210, label: "A5"         },
  Letter:    { w: 216, h: 279, label: "Letter"     },
  Thermal80: { w:  80, h: 280, label: "حراري 80mm" },
  Thermal58: { w:  58, h: 280, label: "حراري 58mm" },
};

/* ─── Default element sizes (mm) ─── */
const DEFAULTS: Record<ElementType, { w: number; h: number }> = {
  text:         { w: 80,  h: 8   },
  image:        { w: 40,  h: 25  },
  qr:           { w: 25,  h: 25  },
  barcode:      { w: 60,  h: 15  },
  company_info: { w: 90,  h: 30  },
  customer_info:{ w: 90,  h: 35  },
  invoice_info: { w: 90,  h: 30  },
  items_table:  { w: 190, h: 65  },
  totals:       { w: 80,  h: 35  },
  signature:    { w: 60,  h: 20  },
  notes:        { w: 150, h: 20  },
  line:         { w: 190, h: 1   },
  rect:         { w: 60,  h: 30  },
  vline:        { w: 1,   h: 60  },
};

/* ─── Palette ─── */
const PALETTE: { type: ElementType; label: string; icon: React.ReactNode }[] = [
  { type: "text",          label: "نص / متغير",     icon: <Type className="w-3.5 h-3.5" />          },
  { type: "company_info",  label: "بيانات الشركة",  icon: <Building2 className="w-3.5 h-3.5" />     },
  { type: "image",         label: "صورة / شعار",    icon: <Image className="w-3.5 h-3.5" />         },
  { type: "qr",            label: "QR Code",         icon: <QrCode className="w-3.5 h-3.5" />       },
  { type: "barcode",       label: "باركود",          icon: <BarChart2 className="w-3.5 h-3.5" />    },
  { type: "customer_info", label: "بيانات العميل",  icon: <Users className="w-3.5 h-3.5" />         },
  { type: "invoice_info",  label: "بيانات الفاتورة",icon: <FileText className="w-3.5 h-3.5" />     },
  { type: "items_table",   label: "جدول الأصناف",   icon: <LayoutGrid className="w-3.5 h-3.5" />   },
  { type: "totals",        label: "الإجماليات",     icon: <Calculator className="w-3.5 h-3.5" />   },
  { type: "signature",     label: "التوقيع",         icon: <PenLine className="w-3.5 h-3.5" />      },
  { type: "notes",         label: "ملاحظات",        icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { type: "line",          label: "خط أفقي",        icon: <Minus className="w-3.5 h-3.5" />        },
  { type: "vline",         label: "خط رأسي",        icon: <GripVertical className="w-3.5 h-3.5" /> },
  { type: "rect",          label: "مستطيل",         icon: <Square className="w-3.5 h-3.5" />       },
];

/* ─── Ready Templates ─── */
const READY_TEMPLATES: Array<{ id: string; name: string; desc: string; color: string; layout: TemplateLayout }> = [
  {
    id: "inv_simple", name: "فاتورة ضريبية بسيطة", desc: "تخطيط كلاسيكي بعربي فقط", color: "#406B93",
    layout: {
      version: 1, type: "config_v1", paperSize: "A4", orientation: "portrait",
      language: "ar", primaryColor: "#406B93", columns: DEFAULT_COLS, sections: DEFAULT_SECS, minRows: 5,
      elements: [
        { id:"ts_ci",  type:"company_info",  x:10, y:10,  w:190, h:25, fontSize:10, textAlign:"center", border:false, color:"#1a1a1a" },
        { id:"ts_l1",  type:"line",          x:10, y:37,  w:190, h:1,  color:"#406B93" },
        { id:"ts_ii",  type:"invoice_info",  x:10, y:40,  w:88,  h:25, fontSize:9,  textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"ts_cu",  type:"customer_info", x:112,y:40,  w:88,  h:25, fontSize:9,  textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"ts_l2",  type:"line",          x:10, y:67,  w:190, h:1,  color:"#406B93" },
        { id:"ts_tb",  type:"items_table",   x:10, y:70,  w:190, h:120,fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"ts_tt",  type:"totals",        x:110,y:195, w:90,  h:50, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"ts_qr",  type:"qr",            x:10, y:195, w:25,  h:25, color:"#1a1a1a" },
        { id:"ts_no",  type:"notes",         x:10, y:265, w:190, h:15, fontSize:8,  textAlign:"right", border:false, color:"#555555" },
        { id:"ts_l3",  type:"line",          x:10, y:282, w:190, h:1,  color:"#406B93" },
      ],
    },
  },
  {
    id: "inv_bilingual", name: "فاتورة ضريبية ثنائية (ZATCA)", desc: "عربي + إنجليزي معاً", color: "#1D4ED8",
    layout: {
      version: 1, type: "config_v1", paperSize: "A4", orientation: "portrait",
      language: "bilingual", primaryColor: "#1D4ED8",
      columns: DEFAULT_COLS, sections: { ...DEFAULT_SECS, signatures: true }, minRows: 5,
      elements: [
        { id:"tb_ci",  type:"company_info",  x:10, y:10,  w:190, h:30, fontSize:10, textAlign:"center", border:false, color:"#1a1a1a" },
        { id:"tb_l1",  type:"line",          x:10, y:42,  w:190, h:1,  color:"#1D4ED8" },
        { id:"tb_ii",  type:"invoice_info",  x:10, y:45,  w:88,  h:30, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"tb_cu",  type:"customer_info", x:112,y:45,  w:88,  h:30, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"tb_l2",  type:"line",          x:10, y:77,  w:190, h:1,  color:"#1D4ED8" },
        { id:"tb_tb",  type:"items_table",   x:10, y:80,  w:190, h:115,fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"tb_tt",  type:"totals",        x:110,y:200, w:90,  h:55, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"tb_qr",  type:"qr",            x:10, y:200, w:30,  h:30, color:"#1a1a1a" },
        { id:"tb_s1",  type:"signature",     x:10, y:245, w:80,  h:20, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"tb_s2",  type:"signature",     x:120,y:245, w:80,  h:20, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"tb_no",  type:"notes",         x:10, y:270, w:190, h:15, fontSize:8,  textAlign:"right", border:false, color:"#555555" },
      ],
    },
  },
  {
    id: "receipt", name: "سند قبض / صرف", desc: "وصل استلام أو صرف مالي", color: "#059669",
    layout: {
      version: 1, type: "config_v1", paperSize: "A4", orientation: "portrait",
      language: "ar", primaryColor: "#059669",
      columns: { num:true, code:false, name:true, unit:false, qty:true, price:true, discount:false, taxable:false, taxRate:false, taxAmt:false, total:true },
      sections: { sellerInfo:true, customerInfo:true, amountInWords:true, pageNumber:false, signatures:true }, minRows: 3,
      elements: [
        { id:"rc_ci",  type:"company_info",  x:10, y:10,  w:190, h:25, fontSize:10, textAlign:"center", border:false, color:"#1a1a1a" },
        { id:"rc_l1",  type:"line",          x:10, y:37,  w:190, h:1,  color:"#059669" },
        { id:"rc_ii",  type:"invoice_info",  x:10, y:42,  w:190, h:25, fontSize:9,  textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"rc_cu",  type:"customer_info", x:10, y:70,  w:190, h:20, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"rc_tb",  type:"items_table",   x:10, y:95,  w:190, h:80, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"rc_tt",  type:"totals",        x:110,y:180, w:90,  h:40, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"rc_no",  type:"notes",         x:10, y:230, w:190, h:15, fontSize:8,  textAlign:"right", border:false, color:"#555555" },
        { id:"rc_s1",  type:"signature",     x:10, y:255, w:80,  h:20, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"rc_s2",  type:"signature",     x:120,y:255, w:80,  h:20, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"rc_l3",  type:"line",          x:10, y:280, w:190, h:1,  color:"#059669" },
      ],
    },
  },
  {
    id: "quote", name: "عرض سعر / Quotation", desc: "ثنائي اللغة مع بنود مفصلة", color: "#7C3AED",
    layout: {
      version: 1, type: "config_v1", paperSize: "A4", orientation: "portrait",
      language: "bilingual", primaryColor: "#7C3AED",
      columns: { num:true, code:true, name:true, unit:true, qty:true, price:true, discount:true, taxable:false, taxRate:true, taxAmt:false, total:true },
      sections: { sellerInfo:true, customerInfo:true, amountInWords:false, pageNumber:true, signatures:true }, minRows: 8,
      elements: [
        { id:"qt_ci",  type:"company_info",  x:10, y:10,  w:190, h:28, fontSize:10, textAlign:"center", border:false, color:"#1a1a1a" },
        { id:"qt_l1",  type:"line",          x:10, y:40,  w:190, h:1,  color:"#7C3AED" },
        { id:"qt_ii",  type:"invoice_info",  x:10, y:43,  w:88,  h:25, fontSize:9,  textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"qt_cu",  type:"customer_info", x:112,y:43,  w:88,  h:25, fontSize:9,  textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"qt_l2",  type:"line",          x:10, y:70,  w:190, h:1,  color:"#7C3AED" },
        { id:"qt_tb",  type:"items_table",   x:10, y:73,  w:190, h:130,fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"qt_tt",  type:"totals",        x:110,y:208, w:90,  h:45, fontSize:9,  textAlign:"right", border:true,  color:"#1a1a1a" },
        { id:"qt_no",  type:"notes",         x:10, y:208, w:95,  h:20, fontSize:8,  textAlign:"right", border:true,  color:"#555555" },
        { id:"qt_s1",  type:"signature",     x:10, y:258, w:80,  h:18, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"qt_s2",  type:"signature",     x:120,y:258, w:80,  h:18, fontSize:8,  textAlign:"center", border:true,  color:"#555555" },
        { id:"qt_l3",  type:"line",          x:10, y:280, w:190, h:1,  color:"#7C3AED" },
      ],
    },
  },
  {
    id: "thermal", name: "إيصال حراري 80mm", desc: "نقاط البيع POS", color: "#374151",
    layout: {
      version: 1, type: "config_v1", paperSize: "Thermal80", orientation: "portrait",
      language: "ar", primaryColor: "#374151",
      columns: { num:false, code:false, name:true, unit:false, qty:true, price:true, discount:false, taxable:false, taxRate:false, taxAmt:false, total:true },
      sections: { sellerInfo:true, customerInfo:false, amountInWords:false, pageNumber:false, signatures:false }, minRows: 1,
      elements: [
        { id:"th_ci",  type:"company_info",  x:2,  y:5,   w:76, h:20, fontSize:8, textAlign:"center", border:false, color:"#1a1a1a" },
        { id:"th_l1",  type:"line",          x:2,  y:27,  w:76, h:1,  color:"#333333" },
        { id:"th_ii",  type:"invoice_info",  x:2,  y:30,  w:76, h:15, fontSize:7, textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"th_l2",  type:"line",          x:2,  y:47,  w:76, h:1,  color:"#333333" },
        { id:"th_tb",  type:"items_table",   x:2,  y:50,  w:76, h:80, fontSize:7, textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"th_tt",  type:"totals",        x:2,  y:133, w:76, h:35, fontSize:7, textAlign:"right", border:false, color:"#1a1a1a" },
        { id:"th_qr",  type:"qr",            x:25, y:172, w:30, h:30, color:"#1a1a1a" },
        { id:"th_l3",  type:"line",          x:2,  y:205, w:76, h:1,  color:"#333333" },
        { id:"th_no",  type:"notes",         x:2,  y:208, w:76, h:12, fontSize:7, textAlign:"center", border:false, color:"#555555" },
      ],
    },
  },
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

/* ─── Sample invoice data for live preview ─── */
const SAMPLE_DATA: InvPrintData = {
  invoiceNumber: "INV-2026-000123",
  invoiceDate: "2026-06-27",
  invoiceTime: "10:30:00",
  customerName: "شركة الأفق للتجارة",
  customerCode: "C0042",
  customerTaxNumber: "310012345600003",
  customerBuildingNo:  "3247",
  customerStreet:      "طريق الملك فهد",
  customerDistrict:    "العليا",
  customerCity:        "الرياض",
  customerCountry:     "المملكة العربية السعودية",
  customerPostalCode:  "12211",
  salesperson: "أحمد السالم",
  paymentType: "credit",
  currency: "SAR",
  notes: "يُرجى إرفاق نسخة من هذه الفاتورة عند الدفع",
  lines: [
    { productCode: "PRD-001", productName: "كمبيوتر محمول Dell XPS 15",     quantity: "2", unit: "قطعة", unitPrice: "3500.00", discountPct: "5",  taxPct: "15", taxAmt: "997.50",  total: "7472.50" },
    { productCode: "PRD-002", productName: "شاشة LG 27 بوصة 4K",            quantity: "3", unit: "قطعة", unitPrice: "1800.00", discountPct: "0",  taxPct: "15", taxAmt: "810.00",  total: "6210.00" },
    { productCode: "PRD-003", productName: "لوحة مفاتيح لاسلكية ميكانيكية", quantity: "5", unit: "قطعة", unitPrice: "250.00",  discountPct: "10", taxPct: "15", taxAmt: "168.75",  total: "1293.75" },
    { productCode: "PRD-004", productName: "ماوس Logitech MX Master 3",      quantity: "5", unit: "قطعة", unitPrice: "180.00",  discountPct: "0",  taxPct: "15", taxAmt: "138.00",  total: "1058.00" },
    { productCode: "PRD-005", productName: "حقيبة لابتوب جلدية 15.6 بوصة", quantity: "2", unit: "قطعة", unitPrice: "320.00",  discountPct: "0",  taxPct: "15", taxAmt: "98.00",   total: "738.00"  },
  ],
  subtotal: 14750.00, discountTotal: 477.50, taxTotal: 2212.25, grandTotal: 16484.75,
  paidAmount: 0, remainingAmount: 16484.75,
  sellerName:          "شركة ون سوفت لتقنية المعلومات",
  sellerNameEn:        "OneSoft Information Technology Co.",
  sellerTaxNumber:     "300123456700003",
  sellerCommercialReg: "1010123456",
  sellerBuildingNo:    "1234",
  sellerStreet:        "شارع العروبة",
  sellerDistrict:      "العليا",
  sellerCity:          "الرياض",
  sellerCountry:       "المملكة العربية السعودية",
  sellerPostalCode:    "12244",
  sellerPhone:         "+966 11 123 4567",
};

/* ─── ID generator ─── */
let _seq = 0;
const uid = () => `el_${Date.now()}_${++_seq}`;

/* ─── Element preview renderer ─── */
function ElementPreview({ el, scale, selected }: { el: LayoutElement; scale: number; selected: boolean }) {
  const base: React.CSSProperties = {
    position:   "absolute",
    left:       el.x * scale,
    top:        el.y * scale,
    width:      el.w * scale,
    height:     el.h * scale,
    boxSizing:  "border-box",
    overflow:   "hidden",
    cursor:     "move",
    userSelect: "none",
    direction:  "rtl",
    border:     selected
      ? "2px solid #3b82f6"
      : el.border
        ? `1px solid ${el.color ?? "#aaa"}`
        : "1px dashed #cbd5e1",
    background: el.bgColor ?? (selected ? "#eff6ff" : "rgba(255,255,255,0.6)"),
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

  /* ── line ── */
  if (el.type === "line") return (
    <div style={{ ...base, border: selected ? "2px solid #3b82f6" : "none", display:"flex", alignItems:"center" }}>
      <div style={{ width:"100%", height:1, background: el.color ?? "#333" }} />
    </div>
  );
  /* ── vertical line ── */
  if (el.type === "vline") return (
    <div style={{ ...base, border: selected ? "2px solid #3b82f6" : "none", display:"flex", justifyContent:"center" }}>
      <div style={{ width:1, height:"100%", background: el.color ?? "#333" }} />
    </div>
  );
  /* ── rect ── */
  if (el.type === "rect") return (
    <div style={{ ...base, border: selected ? "2px solid #3b82f6" : `1.5px solid ${el.color ?? "#333"}`, background: el.bgColor ?? "transparent" }}>
      {selected && <div style={{ position:"absolute", inset:0, background:"rgba(59,130,246,0.08)" }} />}
    </div>
  );
  /* ── image ── */
  if (el.type === "image") return (
    <div style={{ ...base, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
      <Image style={{ width: 14*scale, height: 14*scale, opacity:0.4 }} />
      <span style={{ fontSize: 7*scale, color:"#94a3b8" }}>صورة / شعار</span>
    </div>
  );
  /* ── qr ── */
  if (el.type === "qr") {
    const cell = 4*scale;
    const pat = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1];
    return (
      <div style={{ ...base, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(4,${cell}px)`, gap:1 }}>
          {pat.map((b,i) => <div key={i} style={{ width:cell, height:cell, background: b ? "#333":"transparent" }} />)}
        </div>
        <span style={{ fontSize:7*scale, color:"#94a3b8" }}>QR Code</span>
      </div>
    );
  }
  /* ── barcode ── */
  if (el.type === "barcode") return (
    <div style={{ ...base, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
      <div style={{ display:"flex", gap:1, height:12*scale }}>
        {Array.from({length:24}).map((_,i) => (
          <div key={i} style={{ width:(i%3===0?2.5:1.2)*scale, height:"100%", background:"#333" }} />
        ))}
      </div>
      <span style={{ fontSize:7*scale, color:"#666", fontFamily:"monospace" }}>||||||||||||||</span>
    </div>
  );

  /* ── text content types ── */
  const PREVIEW_CONTENT: Record<ElementType, string> = {
    text:         el.content ?? "نص هنا",
    image:        "",
    qr:           "",
    barcode:      "",
    rect:         "",
    vline:        "",
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
      <pre style={{ ...txt, margin:0, fontFamily:"inherit", whiteSpace:"pre-wrap" }}>
        {PREVIEW_CONTENT[el.type]}
      </pre>
    </div>
  );
}

/* ─── Ruler component ─── */
function Ruler({ orientation, length, scale, offset }: { orientation: "h"|"v"; length: number; scale: number; offset: number }) {
  const RULER_SIZE = 20;
  const ticks: React.ReactNode[] = [];
  const mmMax = Math.ceil(length);
  for (let mm = 0; mm <= mmMax; mm += 5) {
    const pos = mm * scale + offset;
    const isMajor = mm % 10 === 0;
    if (orientation === "h") {
      ticks.push(
        <div key={mm} style={{ position:"absolute", left: pos, top:0, bottom:0, display:"flex", flexDirection:"column", alignItems:"center" }}>
          <div style={{ width:1, height: isMajor ? 10 : 5, background: isMajor ? "#94a3b8" : "#cbd5e1", marginTop: isMajor ? 0 : 5 }} />
          {isMajor && <span style={{ fontSize:7, color:"#94a3b8", marginTop:0, lineHeight:1 }}>{mm}</span>}
        </div>
      );
    } else {
      ticks.push(
        <div key={mm} style={{ position:"absolute", top: pos, left:0, right:0, display:"flex", alignItems:"center" }}>
          <div style={{ height:1, width: isMajor ? 10 : 5, background: isMajor ? "#94a3b8" : "#cbd5e1", marginLeft: isMajor ? 0 : 5 }} />
          {isMajor && <span style={{ fontSize:7, color:"#94a3b8", writingMode:"vertical-rl", transform:"rotate(180deg)", marginLeft:1 }}>{mm}</span>}
        </div>
      );
    }
  }
  return (
    <div style={{
      position:"absolute",
      ...(orientation === "h"
        ? { top:0, left:RULER_SIZE, right:0, height:RULER_SIZE, borderBottom:"1px solid #e2e8f0" }
        : { top:RULER_SIZE, left:0, width:RULER_SIZE, bottom:0, borderRight:"1px solid #e2e8f0" }
      ),
      background:"#f8fafc", pointerEvents:"none", overflow:"hidden", zIndex:15,
    }}>
      {ticks}
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
  const RULER_SIZE = 20;

  /* ── Main state ── */
  const [elements,    setElements]   = useState<LayoutElement[]>(() => initialLayout?.elements ?? []);
  const [selectedId,  setSelectedId] = useState<string | null>(null);
  const [showGrid,    setShowGrid]   = useState(true);
  const [showRulers,  setShowRulers] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isDirty,     setIsDirty]    = useState(false);
  const [rightTab,    setRightTab]   = useState<"element" | "settings">("element");
  const [leftTab,     setLeftTab]    = useState<"elements" | "fields">("elements");
  const [showPreview, setShowPreview] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [clipboard,   setClipboard]  = useState<LayoutElement | null>(null);

  /* ── قاموس الحقول ── */
  const { data: fieldDictList = [] } = trpc.fieldDictionary.list.useQuery();

  /* ── config_v1 state ── */
  const [cfgLanguage,  setCfgLanguage]  = useState<"ar"|"bilingual">(initialLayout?.language ?? "bilingual");
  const [cfgColor,     setCfgColor]     = useState(initialLayout?.primaryColor ?? "#406B93");
  const [cfgColumns,   setCfgColumns]   = useState<TemplateLayout["columns"]>({ ...DEFAULT_COLS, ...initialLayout?.columns });
  const [cfgSections,  setCfgSections]  = useState<TemplateLayout["sections"]>({ ...DEFAULT_SECS, ...initialLayout?.sections });
  const [cfgMinRows,   setCfgMinRows]   = useState(initialLayout?.minRows ?? 5);

  /* ── History (undo/redo) ── */
  const historyRef  = useRef<LayoutElement[][]>([JSON.parse(JSON.stringify(initialLayout?.elements ?? []))]);
  const histIdxRef  = useRef(0);
  const [histTick,  setHistTick]  = useState(0);
  const canUndo = histIdxRef.current > 0;
  const canRedo = histIdxRef.current < historyRef.current.length - 1;

  const pushHistory = useCallback((els: LayoutElement[]) => {
    const snap = JSON.parse(JSON.stringify(els));
    historyRef.current = historyRef.current.slice(0, histIdxRef.current + 1);
    historyRef.current.push(snap);
    if (historyRef.current.length > 50) historyRef.current.shift();
    else histIdxRef.current++;
    setHistTick(t => t + 1);
  }, []);

  const undo = useCallback(() => {
    if (histIdxRef.current > 0) {
      histIdxRef.current--;
      setElements(JSON.parse(JSON.stringify(historyRef.current[histIdxRef.current])));
      setHistTick(t => t + 1);
      setIsDirty(true);
    }
  }, []);

  const redo = useCallback(() => {
    if (histIdxRef.current < historyRef.current.length - 1) {
      histIdxRef.current++;
      setElements(JSON.parse(JSON.stringify(historyRef.current[histIdxRef.current])));
      setHistTick(t => t + 1);
      setIsDirty(true);
    }
  }, []);

  /* ── Drag refs ── */
  const dragRef   = useRef<{ id: string; sx: number; sy: number; mx: number; my: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const selected = elements.find(e => e.id === selectedId);

  /* ── Snap helper ── */
  const SNAP_MM = 5;
  const snap = useCallback((v: number) => snapEnabled ? Math.round(v / SNAP_MM) * SNAP_MM : v, [snapEnabled]);

  /* ── Config patches ── */
  const patchCol = (k: keyof TemplateLayout["columns"], v: boolean) => { setCfgColumns(p => ({ ...p, [k]: v })); setIsDirty(true); };
  const patchSec = (k: keyof TemplateLayout["sections"], v: boolean) => { setCfgSections(p => ({ ...p, [k]: v })); setIsDirty(true); };

  /* ── Reload when parent passes new layout ── */
  useEffect(() => {
    if (initialLayout) {
      const els = initialLayout.elements ?? [];
      setElements(els);
      historyRef.current = [JSON.parse(JSON.stringify(els))];
      histIdxRef.current = 0;
      setHistTick(0);
      setCfgLanguage(initialLayout.language ?? "bilingual");
      setCfgColor(initialLayout.primaryColor ?? "#406B93");
      setCfgColumns({ ...DEFAULT_COLS, ...initialLayout.columns });
      setCfgSections({ ...DEFAULT_SECS, ...initialLayout.sections });
      setCfgMinRows(initialLayout.minRows ?? 5);
      setIsDirty(false);
    }
  }, [initialLayout]);

  /* ── Global mouseup to end drag ── */
  useEffect(() => {
    const up = () => {
      if (dragRef.current) {
        setElements(prev => { pushHistory(prev); return prev; });
        dragRef.current = null;
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [pushHistory]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inInput = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === "c") { e.preventDefault(); copySelected(); return; }
      if (ctrl && e.key === "v") { e.preventDefault(); pasteElement(); return; }
      if (!inInput && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault(); deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedId, clipboard, elements]);

  /* ── Drag move (with snap) ── */
  const onCanvasMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const dx = (e.clientX - d.mx) / scale;
    const dy = (e.clientY - d.my) / scale;
    setElements(prev => prev.map(el => el.id !== d.id ? el : {
      ...el,
      x: snap(Math.max(0, Math.min(pW - el.w, d.sx + dx))),
      y: snap(Math.max(0, Math.min(pH - el.h, d.sy + dy))),
    }));
  }, [scale, pW, pH, snap]);

  /* ── Add element ── */
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
    setElements(prev => { const next = [...prev, newEl]; pushHistory(next); return next; });
    setSelectedId(newEl.id);
    setIsDirty(true);
  }, [pW, pH, pushHistory]);

  /* ── إدراج حقل من قاموس الحقول كعنصر نص ── */
  const addFieldElement = useCallback((fieldCode: string) => {
    const def = DEFAULTS["text" as ElementType];
    const newEl: LayoutElement = {
      id: uid(), type: "text",
      x: Math.max(0, (pW - def.w) / 2),
      y: Math.max(0, pH * 0.1),
      w: Math.min(def.w, pW - 10),
      h: def.h,
      content:    `{{${fieldCode}}}`,
      fontSize:   10,
      fontWeight: "normal",
      textAlign:  "right",
      color:      "#1a1a1a",
      border:     false,
    };
    setElements(prev => { const next = [...prev, newEl]; pushHistory(next); return next; });
    setSelectedId(newEl.id);
    setIsDirty(true);
  }, [pW, pH, pushHistory]);

  /* ── Delete selected ── */
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => { const next = prev.filter(e => e.id !== selectedId); pushHistory(next); return next; });
    setSelectedId(null);
    setIsDirty(true);
  }, [selectedId, pushHistory]);

  /* ── Update element property ── */
  const upd = useCallback(<K extends keyof LayoutElement>(k: K, v: LayoutElement[K]) => {
    if (!selectedId) return;
    setElements(prev => { const next = prev.map(e => e.id === selectedId ? { ...e, [k]: v } : e); pushHistory(next); return next; });
    setIsDirty(true);
  }, [selectedId, pushHistory]);

  /* ── Copy / Paste ── */
  const copySelected = useCallback(() => {
    const el = elements.find(e => e.id === selectedId);
    if (el) { setClipboard({ ...el }); toast.success("تم النسخ"); }
  }, [elements, selectedId]);

  const pasteElement = useCallback(() => {
    if (!clipboard) return;
    const newEl: LayoutElement = { ...clipboard, id: uid(), x: clipboard.x + 5, y: clipboard.y + 5 };
    setElements(prev => { const next = [...prev, newEl]; pushHistory(next); return next; });
    setSelectedId(newEl.id);
    setIsDirty(true);
    toast.success("تم اللصق");
  }, [clipboard, pushHistory]);

  /* ── Save ── */
  const handleSave = () => {
    const layout: TemplateLayout = {
      version:1, type:"config_v1", paperSize, orientation: orientation as any,
      elements, language:cfgLanguage, primaryColor:cfgColor,
      columns:cfgColumns, sections:cfgSections, minRows:cfgMinRows,
    };
    onSave(layout);
    setIsDirty(false);
  };

  /* ── Export JSON ── */
  const handleExport = () => {
    const layout: TemplateLayout = {
      version:1, type:"config_v1", paperSize, orientation: orientation as any,
      elements, language:cfgLanguage, primaryColor:cfgColor,
      columns:cfgColumns, sections:cfgSections, minRows:cfgMinRows,
    };
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${templateName.replace(/\s+/g,"_")}_template.json`;
    a.click();
    toast.success("تم تصدير القالب");
  };

  /* ── Import JSON ── */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const layout = JSON.parse(ev.target?.result as string) as TemplateLayout;
        if (!layout.elements || !layout.type) throw new Error("ملف غير صالح");
        setElements(layout.elements);
        setCfgLanguage(layout.language ?? "bilingual");
        setCfgColor(layout.primaryColor ?? "#406B93");
        setCfgColumns({ ...DEFAULT_COLS, ...layout.columns });
        setCfgSections({ ...DEFAULT_SECS, ...layout.sections });
        setCfgMinRows(layout.minRows ?? 5);
        historyRef.current = [JSON.parse(JSON.stringify(layout.elements))];
        histIdxRef.current = 0;
        setHistTick(0);
        setIsDirty(true);
        toast.success(`تم استيراد القالب: ${layout.elements.length} عنصر`);
      } catch { toast.error("خطأ في قراءة ملف القالب"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  /* ── Apply ready template ── */
  const applyTemplate = (tpl: typeof READY_TEMPLATES[0]) => {
    if (!confirm(`سيتم استبدال التصميم الحالي بقالب «${tpl.name}». هل تريد المتابعة؟`)) return;
    setElements(tpl.layout.elements);
    setCfgLanguage(tpl.layout.language);
    setCfgColor(tpl.layout.primaryColor);
    setCfgColumns({ ...DEFAULT_COLS, ...tpl.layout.columns });
    setCfgSections({ ...DEFAULT_SECS, ...tpl.layout.sections });
    setCfgMinRows(tpl.layout.minRows);
    historyRef.current = [JSON.parse(JSON.stringify(tpl.layout.elements))];
    histIdxRef.current = 0;
    setHistTick(0);
    setIsDirty(true);
    setShowLibrary(false);
    toast.success(`تم تطبيق قالب: ${tpl.name}`);
  };

  /* ─── Render ─── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-100" dir="rtl">
      {/* ── Toolbar ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 h-11 border-b border-slate-200 bg-white shadow-sm flex-wrap">
        <button onClick={() => { if (!isDirty || confirm("يوجد تعديلات غير محفوظة، هل تريد الخروج؟")) onBack(); }}
          className="flex items-center gap-1 px-2 h-7 rounded text-[11px] text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> رجوع
        </button>
        <span className="font-semibold text-[12px] text-slate-700 truncate max-w-[160px]">{templateName}</span>
        <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
          {PAPERS[paperSize]?.label ?? paperSize} · {orientation === "portrait" ? "عمودي" : "أفقي"}
        </span>
        <span className="text-[10px] text-slate-400">{elements.length} عنصر</span>
        {isDirty && <span className="text-[10px] text-amber-600">● غير محفوظ</span>}

        <div className="flex-1" />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={!canUndo} title="تراجع (Ctrl+Z)"
          className="flex items-center gap-0.5 px-2 h-7 rounded border text-[10px] transition-colors disabled:opacity-30 border-slate-200 text-slate-600 hover:bg-slate-50">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={redo} disabled={!canRedo} title="إعادة (Ctrl+Y)"
          className="flex items-center gap-0.5 px-2 h-7 rounded border text-[10px] transition-colors disabled:opacity-30 border-slate-200 text-slate-600 hover:bg-slate-50">
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        {/* Copy / Paste */}
        <button onClick={copySelected} disabled={!selectedId} title="نسخ (Ctrl+C)"
          className="flex items-center gap-0.5 px-2 h-7 rounded border text-[10px] transition-colors disabled:opacity-30 border-slate-200 text-slate-600 hover:bg-slate-50">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={pasteElement} disabled={!clipboard} title="لصق (Ctrl+V)"
          className="flex items-center gap-0.5 px-2 h-7 rounded border text-[10px] transition-colors disabled:opacity-30 border-slate-200 text-slate-600 hover:bg-slate-50">
          <Clipboard className="w-3.5 h-3.5" />
        </button>

        {/* Snap toggle */}
        <button onClick={() => setSnapEnabled(v => !v)} title="محاذاة تلقائية"
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[10px] transition-colors ${snapEnabled ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-400"}`}>
          <Magnet className="w-3.5 h-3.5" />
        </button>

        {/* Grid / Ruler */}
        <button onClick={() => setShowGrid(v => !v)}
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[10px] transition-colors ${showGrid ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
          {showGrid ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} شبكة
        </button>
        <button onClick={() => setShowRulers(v => !v)} title="مسطرة"
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[10px] transition-colors ${showRulers ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
          مسطرة
        </button>

        {/* Preview */}
        <button onClick={() => setShowPreview(v => !v)}
          className={`flex items-center gap-1 px-2 h-7 rounded border text-[10px] transition-colors ${showPreview ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
          <Monitor className="w-3.5 h-3.5" /> {showPreview ? "إخفاء المعاينة" : "معاينة"}
        </button>

        {/* Template Library */}
        <button onClick={() => setShowLibrary(true)}
          className="flex items-center gap-1 px-2 h-7 rounded border border-purple-200 text-purple-600 text-[10px] hover:bg-purple-50 transition-colors">
          <BookOpen className="w-3.5 h-3.5" /> قوالب
        </button>

        {/* Export / Import */}
        <button onClick={handleExport}
          className="flex items-center gap-1 px-2 h-7 rounded border border-slate-200 text-slate-600 text-[10px] hover:bg-slate-50 transition-colors">
          <Download className="w-3.5 h-3.5" /> تصدير
        </button>
        <button onClick={() => importRef.current?.click()}
          className="flex items-center gap-1 px-2 h-7 rounded border border-slate-200 text-slate-600 text-[10px] hover:bg-slate-50 transition-colors">
          <Upload className="w-3.5 h-3.5" /> استيراد
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

        {/* Delete */}
        {selected && !showPreview && (
          <button onClick={deleteSelected}
            className="flex items-center gap-1 px-2 h-7 rounded text-[11px] text-red-600 hover:bg-red-50 border border-red-200 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </button>
        )}
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-1.5 px-3 h-8 rounded bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm disabled:opacity-60 transition-colors">
          <Save className="w-3.5 h-3.5" /> {isSaving ? "جاري الحفظ…" : "حفظ التصميم"}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: palette + available fields ── */}
        <div className="w-40 shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-hidden">

          {/* تبويبان */}
          <div className="shrink-0 flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setLeftTab("elements")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                leftTab === "elements"
                  ? "border-indigo-500 text-indigo-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Layers className="w-3 h-3" /> العناصر
            </button>
            <button
              onClick={() => setLeftTab("fields")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors border-b-2 ${
                leftTab === "fields"
                  ? "border-emerald-500 text-emerald-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Hash className="w-3 h-3" /> الحقول
            </button>
          </div>

          {/* ── تبويب العناصر ── */}
          {leftTab === "elements" && (
            <div className="flex-1 overflow-y-auto py-1">
              {PALETTE.map(({ type, label, icon }) => (
                <button key={type} onClick={() => addElement(type)}
                  className="group w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-50 text-right transition-colors">
                  <span className="text-slate-400 group-hover:text-indigo-500 shrink-0 transition-colors">{icon}</span>
                  <span className="flex-1">{label}</span>
                  <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── تبويب الحقول المتاحة ── */}
          {leftTab === "fields" && (
            <div className="flex-1 overflow-y-auto">
              {fieldDictList.length === 0 && (
                <div className="px-3 py-6 text-center text-[10px] text-slate-400 leading-relaxed">
                  لا توجد حقول<br />في قاموس الحقول
                </div>
              )}
              {(() => {
                const CAT_AR: Record<string, string> = {
                  "Document Fields":   "المستند",
                  "Customer Fields":   "العميل",
                  "Vendor Fields":     "المورد",
                  "Sales Fields":      "المبيعات",
                  "Item Fields":       "الأصناف",
                  "Inventory Fields":  "المخزون",
                  "System Fields":     "النظام",
                  "Accounting Fields": "المحاسبة",
                  "Payment Fields":    "المدفوعات",
                };
                const grouped: Record<string, typeof fieldDictList> = {};
                for (const f of fieldDictList) {
                  const cat = f.category ?? "أخرى";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(f);
                }
                return Object.entries(grouped).map(([cat, fields]) => (
                  <div key={cat}>
                    <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 sticky top-0">
                      {CAT_AR[cat] ?? cat}
                    </div>
                    {fields.map((f) => (
                      <button
                        key={f.code}
                        onClick={() => addFieldElement(f.code)}
                        className="group w-full flex items-start gap-1.5 px-2.5 py-1.5 border-b border-slate-50 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-right"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-mono font-semibold text-slate-600 group-hover:text-emerald-700 truncate">
                            {f.code}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate leading-tight">
                            {f.nameAr}
                          </div>
                        </div>
                        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 shrink-0 mt-0.5 transition-opacity" />
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}

        </div>

        {/* ── Center: canvas OR live preview ── */}
        {showPreview ? (
          <div className="flex-1 overflow-auto flex flex-col items-center p-4 bg-slate-400"
            style={{ backgroundImage:"radial-gradient(circle, #64748b 1px, transparent 1px)", backgroundSize:"14px 14px" }}>
            <div className="mb-2 flex items-center gap-2 bg-emerald-700 text-white text-[10px] px-3 py-1 rounded-full shadow">
              <Monitor className="w-3 h-3" /> معاينة بالبيانات النموذجية — التغييرات في تبويب «الفاتورة» تظهر فوراً
            </div>
            <iframe
              key={`${cfgLanguage}_${cfgColor}_${JSON.stringify(cfgColumns)}_${JSON.stringify(cfgSections)}_${cfgMinRows}`}
              srcDoc={buildInvoiceHtml(SAMPLE_DATA, {
                type:"config_v1", language:cfgLanguage, primaryColor:cfgColor,
                columns:cfgColumns, minRows:cfgMinRows, sections:cfgSections,
              })}
              className="bg-white shadow-2xl"
              style={{ width:CWIDTH, height:cHeight * 1.15, border:"none", flexShrink:0, boxShadow:"0 4px 24px rgba(0,0,0,0.3)" }}
              title="معاينة الفاتورة"
            />
          </div>
        ) : (
          /* ── Element canvas with rulers ── */
          <div className="flex-1 overflow-auto flex items-start justify-center p-6 bg-slate-300"
            style={{ backgroundImage:"radial-gradient(circle, #94a3b8 1px, transparent 1px)", backgroundSize:"16px 16px" }}>
            {/* Wrapper with rulers */}
            <div className="relative" style={{ width: CWIDTH + (showRulers ? RULER_SIZE : 0), height: cHeight + (showRulers ? RULER_SIZE : 0) }}>
              {/* Corner square */}
              {showRulers && (
                <div style={{ position:"absolute", top:0, left:0, width:RULER_SIZE, height:RULER_SIZE, background:"#f1f5f9", border:"1px solid #e2e8f0", zIndex:16 }} />
              )}
              {/* Rulers */}
              {showRulers && <>
                <Ruler orientation="h" length={pW} scale={scale} offset={0} />
                <Ruler orientation="v" length={pH} scale={scale} offset={0} />
              </>}

              {/* Canvas */}
              <div className="relative bg-white shadow-2xl select-none"
                ref={canvasRef}
                style={{
                  position:"absolute",
                  left: showRulers ? RULER_SIZE : 0,
                  top:  showRulers ? RULER_SIZE : 0,
                  width: CWIDTH, height: cHeight,
                  boxShadow:"0 4px 24px rgba(0,0,0,0.25)",
                }}
                onMouseMove={onCanvasMove}
                onMouseUp={() => { /* handled in global listener */ }}
                onClick={e => { if (e.target === canvasRef.current) setSelectedId(null); }}
              >
                {/* Margin guide */}
                <div style={{ position:"absolute", inset:`${10*scale}px`, border:"1px dashed #bfdbfe", pointerEvents:"none", zIndex:0 }} />
                {/* Grid */}
                {showGrid && (
                  <div style={{
                    position:"absolute", inset:0, pointerEvents:"none", zIndex:0, opacity:0.3,
                    backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent ${5*scale-1}px,#e0e7ff ${5*scale-1}px,#e0e7ff ${5*scale}px),
                      repeating-linear-gradient(90deg,transparent,transparent ${5*scale-1}px,#e0e7ff ${5*scale-1}px,#e0e7ff ${5*scale}px)`,
                  }} />
                )}
                {/* Elements */}
                {elements.map(el => (
                  <div key={el.id}
                    style={{ position:"absolute", left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale, zIndex: selectedId===el.id ? 10 : 1 }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setSelectedId(el.id);
                      dragRef.current = { id:el.id, sx:el.x, sy:el.y, mx:e.clientX, my:e.clientY };
                    }}
                  >
                    <ElementPreview el={el} scale={scale} selected={selectedId===el.id} />
                    {selectedId === el.id && (<>
                      {[
                        { cursor:"nw-resize", top:-4, left:-4 },
                        { cursor:"ne-resize", top:-4, right:-4 },
                        { cursor:"sw-resize", bottom:-4, left:-4 },
                        { cursor:"se-resize", bottom:-4, right:-4 },
                      ].map((h, i) => (
                        <div key={i} style={{ position:"absolute", width:8, height:8, background:"#3b82f6", border:"1px solid white", borderRadius:2, ...h }} />
                      ))}
                      <div style={{ position:"absolute", top:-18, right:0, background:"#3b82f6", color:"#fff", fontSize:8, padding:"1px 4px", borderRadius:3, whiteSpace:"nowrap" }}>
                        {Math.round(el.x)},{Math.round(el.y)} mm · {Math.round(el.w)}×{Math.round(el.h)} mm
                        {snapEnabled && " ⊞"}
                      </div>
                    </>)}
                  </div>
                ))}
                {/* Empty state */}
                {elements.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-40 pointer-events-none">
                    <FileText className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-[13px] font-medium text-slate-400">ورقة فارغة</p>
                    <p className="text-[11px] text-slate-300 mt-1">اضغط على عنصر من القائمة اليسرى أو اختر قالباً جاهزاً</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Right: properties + settings ── */}
        <div className="w-56 shrink-0 flex flex-col bg-white border-r border-slate-200 overflow-y-auto">
          <div className="flex border-b border-slate-200 shrink-0 sticky top-0 bg-white z-10">
            <button onClick={() => setRightTab("element")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${rightTab==="element" ? "border-b-2 border-indigo-500 text-indigo-700 bg-indigo-50" : "text-slate-500 hover:bg-slate-50"}`}>
              <Layers className="w-3 h-3" />العنصر
            </button>
            <button onClick={() => setRightTab("settings")}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${rightTab==="settings" ? "border-b-2 border-purple-500 text-purple-700 bg-purple-50" : "text-slate-500 hover:bg-slate-50"}`}>
              <Settings2 className="w-3 h-3" />الفاتورة
            </button>
          </div>

          {/* Settings Tab */}
          {rightTab === "settings" && (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
              <div>
                <div className="flex items-center gap-1 mb-1.5"><Globe2 className="w-3 h-3 text-purple-500" /><span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">اللغة</span></div>
                <div className="flex gap-1.5">
                  {[{ v:"bilingual", ar:"ثنائي اللغة" },{ v:"ar", ar:"عربي فقط" }].map(o => (
                    <button key={o.v} onClick={() => { setCfgLanguage(o.v as any); setIsDirty(true); }}
                      className={`flex-1 py-1 rounded border text-[10px] transition-colors ${cfgLanguage===o.v ? "border-purple-400 bg-purple-50 text-purple-700 font-bold" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      {o.ar}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5"><Palette className="w-3 h-3 text-purple-500" /><span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">اللون الرئيسي</span></div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {THEME_COLORS.map(c => (
                    <button key={c} onClick={() => { setCfgColor(c); setIsDirty(true); }}
                      className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
                      style={{ background:c, borderColor:cfgColor===c?"#fff":"transparent", outline:cfgColor===c?`2px solid ${c}`:"none", outlineOffset:1 }} />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="color" value={cfgColor} onChange={e => { setCfgColor(e.target.value); setIsDirty(true); }} className="w-7 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                  <span className="text-[9px] font-mono text-slate-500">{cfgColor}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5"><Table2 className="w-3 h-3 text-purple-500" /><span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">أعمدة الجدول</span></div>
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

              <div>
                <div className="flex items-center gap-1 mb-1.5"><FileText className="w-3 h-3 text-purple-500" /><span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">الأقسام</span></div>
                <div className="space-y-1">
                  {([
                    { key:"sellerInfo",    ar:"بيانات البائع"  },
                    { key:"customerInfo",  ar:"بيانات العميل"  },
                    { key:"amountInWords", ar:"المبلغ كتابةً"  },
                    { key:"pageNumber",    ar:"رقم الصفحة"     },
                    { key:"signatures",    ar:"خانات التوقيع"  },
                  ] as { key: keyof TemplateLayout["sections"]; ar: string }[]).map(s => (
                    <label key={s.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="w-3 h-3 accent-indigo-600" checked={cfgSections[s.key]} onChange={e => patchSec(s.key, e.target.checked)} />
                      <span className={`text-[10px] ${cfgSections[s.key] ? "text-slate-700" : "text-slate-300"}`}>{s.ar}</span>
                    </label>
                  ))}
                </div>
              </div>

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

          {/* Element Properties Tab */}
          {rightTab === "element" && (<>
            {selected ? (
              <div className="p-2.5 space-y-3">
                <div className="flex items-center gap-1.5 bg-indigo-50 rounded px-2 py-1">
                  {PALETTE.find(p => p.type === selected.type)?.icon}
                  <span className="text-[11px] text-indigo-700 font-medium">{PALETTE.find(p => p.type === selected.type)?.label}</span>
                </div>

                {/* Copy/Delete shortcuts */}
                <div className="flex gap-1">
                  <button onClick={copySelected} className="flex-1 flex items-center justify-center gap-1 h-6 rounded border border-slate-200 text-[10px] text-slate-600 hover:bg-slate-50 transition-colors">
                    <Copy className="w-3 h-3" /> نسخ
                  </button>
                  <button onClick={deleteSelected} className="flex-1 flex items-center justify-center gap-1 h-6 rounded border border-red-200 text-[10px] text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3 h-3" /> حذف
                  </button>
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

                {/* Content */}
                {(selected.type === "text" || selected.type === "notes") && (
                  <div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">المحتوى</div>
                    <textarea value={selected.content ?? ""}
                      onChange={e => upd("content", e.target.value)}
                      placeholder="أدخل النص أو {{متغير}}"
                      className="w-full h-16 text-[10px] px-2 py-1 border border-slate-200 rounded resize-none focus:outline-none focus:border-indigo-400"
                      dir="rtl" />
                    <div className="text-[9px] text-slate-400 mt-1.5 mb-1">متغيرات جاهزة:</div>
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
                {selected.type !== "line" && selected.type !== "vline" && selected.type !== "rect" && (
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
                    {selected.type !== "qr" && selected.type !== "image" && (
                      <div className="flex gap-1">
                        {(["right","center","left"] as const).map(a => (
                          <button key={a} onClick={() => upd("textAlign", a)}
                            className={`flex-1 h-6 rounded border flex items-center justify-center transition-colors ${selected.textAlign===a ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                            {a==="right" ? <AlignRight className="w-3 h-3" /> : a==="center" ? <AlignCenter className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
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
                        style={{ background:c }} />
                    ))}
                  </div>
                </div>

                {/* Background color (rect only) */}
                {selected.type === "rect" && (
                  <div>
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">لون التعبئة</div>
                    <div className="flex gap-1.5 items-center">
                      <input type="color" value={selected.bgColor ?? "#ffffff"}
                        onChange={e => upd("bgColor", e.target.value)}
                        className="w-8 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                      <button onClick={() => upd("bgColor", "transparent")}
                        className="text-[9px] px-2 h-6 border border-slate-200 rounded text-slate-500 hover:bg-slate-50">
                        شفاف
                      </button>
                    </div>
                  </div>
                )}

                {/* Border toggle */}
                {selected.type !== "rect" && selected.type !== "vline" && selected.type !== "line" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selected.border ?? false}
                      onChange={e => upd("border", e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-600" />
                    <span className="text-[11px] text-slate-600">إطار حول العنصر</span>
                  </label>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50">
                <CornerDownLeft className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-[11px] text-slate-400">اختر عنصراً من الورقة لعرض خصائصه</p>
                <p className="text-[10px] text-slate-300 mt-1">Ctrl+Z للتراجع · Ctrl+C للنسخ · Ctrl+V للصق</p>
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* ── Template Library Modal ── */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLibrary(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-slate-800 text-[15px]">مكتبة القوالب الجاهزة</h2>
              </div>
              <button onClick={() => setShowLibrary(false)} className="p-1.5 rounded hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {READY_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                  className="group flex items-start gap-3 p-3.5 rounded-xl border-2 border-slate-100 hover:border-purple-300 hover:bg-purple-50 text-right transition-all">
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: `${tpl.color}18`, border:`2px solid ${tpl.color}40` }}>
                    <div className="w-3 h-4 rounded-sm" style={{ background:tpl.color, opacity:0.8 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] text-slate-800 group-hover:text-purple-800">{tpl.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background:`${tpl.color}18`, color:tpl.color }}>
                        {PAPERS[tpl.layout.paperSize]?.label ?? tpl.layout.paperSize}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {tpl.layout.language === "bilingual" ? "عربي + إنجليزي" : "عربي فقط"}
                      </span>
                      <span className="text-[9px] text-slate-400">{tpl.layout.elements.length} عنصر</span>
                    </div>
                  </div>
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-0.5 text-[10px] text-purple-600 font-medium">
                      <Check className="w-3 h-3" /> تطبيق
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <p className="text-[10px] text-slate-400 text-center">سيتم استبدال التصميم الحالي بالقالب المختار</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
