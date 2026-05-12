import { useState, useEffect, useCallback } from "react";
import {
  FilePlus, Save, Pencil, Trash2, Search, Printer,
  RefreshCw, Copy, SendHorizonal, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft,
  X, MoreHorizontal
} from "lucide-react";

/* ─────────────────── Types ─────────────────── */
type BtnDef = {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  variant?: "default" | "primary" | "danger" | "gold" | "ghost";
  dividerAfter?: boolean;
};

/* ─────────────────── Button config ─────────────────── */
const BUTTONS: BtnDef[] = [
  { id: "new",      label: "جديد",      icon: FilePlus,       shortcut: "F1",  variant: "primary" },
  { id: "save",     label: "حفظ",       icon: Save,           shortcut: "F2",  variant: "primary" },
  { id: "edit",     label: "تعديل",     icon: Pencil,         shortcut: "F4" },
  { id: "delete",   label: "حذف",       icon: Trash2,         shortcut: "Del", variant: "danger", dividerAfter: true },
  { id: "search",   label: "بحث",       icon: Search,         shortcut: "F3" },
  { id: "refresh",  label: "تحديث",     icon: RefreshCw },
  { id: "copy",     label: "نسخ",       icon: Copy,           dividerAfter: true },
  { id: "post",     label: "ترحيل",     icon: SendHorizonal,  variant: "gold" },
  { id: "approve",  label: "اعتماد",    icon: CheckCircle2,   variant: "gold" },
  { id: "cancel",   label: "إلغاء",     icon: XCircle,        variant: "danger", dividerAfter: true },
  { id: "print",    label: "طباعة",     icon: Printer,        dividerAfter: true },
  { id: "first",    label: "أول",       icon: ChevronsRight },
  { id: "prev",     label: "السابق",    icon: ChevronRight },
  { id: "next",     label: "التالي",    icon: ChevronLeft },
  { id: "last",     label: "آخر",       icon: ChevronsLeft,   dividerAfter: true },
  { id: "close",    label: "إغلاق",     icon: X,              variant: "ghost" },
];

/* ─────────────────── Colors ─────────────────── */
const C = {
  bg:          "#F8F7F4",
  border:      "#DDD8CE",
  text:        "#2B2B2B",
  textMuted:   "#6B7280",
  primary:     "#406B93",
  primaryText: "#FFFFFF",
  gold:        "#B89B5E",
  goldBg:      "#FDF8EE",
  danger:      "#C0392B",
  dangerBg:    "#FEF2F2",
  hoverBg:     "#ECEAE4",
  activeBg:    "#E0DDD7",
  ghostHover:  "#F0EDE8",
  divider:     "#D5D0C8",
};

/* ─────────────────── Single Button ─────────────────── */
function TBtn({ btn, active, onClick }: {
  btn: BtnDef;
  active: boolean;
  onClick: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const bg = () => {
    if (btn.variant === "primary") return hovered ? "#365E80" : C.primary;
    if (btn.variant === "danger")  return hovered ? "#A93226" : C.danger;
    if (btn.variant === "gold")    return hovered ? "#A8894E" : C.gold;
    if (btn.variant === "ghost")   return hovered ? C.ghostHover : "transparent";
    return hovered ? C.hoverBg : "transparent";
  };

  const color = () => {
    if (["primary","danger","gold"].includes(btn.variant ?? "")) return "#fff";
    return C.text;
  };

  const border = () => {
    if (["primary","danger","gold"].includes(btn.variant ?? "")) return "transparent";
    return hovered ? C.divider : "transparent";
  };

  return (
    <button
      onClick={() => onClick(btn.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "5px 9px",
        minWidth: 52,
        height: 52,
        borderRadius: 4,
        border: `1px solid ${border()}`,
        background: bg(),
        color: color(),
        cursor: "pointer",
        transition: "background 0.12s, border-color 0.12s",
        flexShrink: 0,
        outline: active ? `2px solid ${C.primary}` : "none",
        outlineOffset: 1,
        fontFamily: "'Cairo', 'Tahoma', sans-serif",
      }}
    >
      <btn.icon size={18} strokeWidth={1.8} />
      <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
        {btn.label}
      </span>
      {btn.shortcut && (
        <span style={{
          fontSize: 8.5, lineHeight: 1,
          color: ["primary","danger","gold"].includes(btn.variant ?? "") ? "rgba(255,255,255,0.7)" : C.textMuted,
          fontFamily: "monospace",
          letterSpacing: "0.02em",
        }}>
          {btn.shortcut}
        </span>
      )}
    </button>
  );
}

/* ─────────────────── Toolbar ─────────────────── */
function ERPToolbar({ activeBtn, onAction }: {
  activeBtn: string;
  onAction: (id: string) => void;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 2,
      padding: "6px 10px",
      background: C.bg,
      borderBottom: `1px solid ${C.border}`,
      flexWrap: "nowrap",
      overflowX: "auto",
      overflowY: "hidden",
      flexShrink: 0,
      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    }}>
      {BUTTONS.map((btn) => (
        <div key={btn.id} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <TBtn btn={btn} active={activeBtn === btn.id} onClick={onAction} />
          {btn.dividerAfter && (
            <div style={{
              width: 1, height: 32,
              background: C.divider,
              margin: "0 4px",
              flexShrink: 0,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Status Bar ─────────────────── */
function StatusBar({ mode, record }: { mode: string; record: number }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "3px 12px",
      background: C.bg,
      borderTop: `1px solid ${C.border}`,
      fontSize: 11,
      color: C.textMuted,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", gap: 16 }}>
        <span>الوضع: <strong style={{ color: C.primary }}>{mode}</strong></span>
        <span>السجل: <strong style={{ color: C.text }}>{record} / 124</strong></span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <span>F1=جديد · F2=حفظ · F3=بحث · F4=تعديل · Del=حذف</span>
      </div>
    </div>
  );
}

/* ─────────────────── Mock Invoice Form ─────────────────── */
function InvoiceForm() {
  const fields1 = [
    { label: "رقم الفاتورة", value: "INV-2026-00421", w: "160px" },
    { label: "التاريخ",      value: "١٢/٠٥/٢٠٢٦",     w: "120px" },
    { label: "نوع الفاتورة", value: "بيع",             w: "120px", select: true },
    { label: "العميل",       value: "شركة النور التجارية", w: "220px" },
    { label: "المخزن",       value: "المخزن الرئيسي",   w: "160px", select: true },
  ];

  const rows = [
    { code: "ITM-001", name: "طابعة HP LaserJet Pro", qty: "2", unit: "قطعة", price: "1,250", disc: "5%", total: "2,375" },
    { code: "ITM-002", name: "حبر طابعة أسود HP",     qty: "5", unit: "علبة",  price: "85",   disc: "—",  total: "425" },
    { code: "ITM-003", name: "ورق A4 80 جرام",        qty: "10",unit: "ريمة",  price: "22",   disc: "—",  total: "220" },
    { code: "",        name: "",                        qty: "",  unit: "",      price: "",     disc: "",   total: "" },
  ];

  const inp = (val: string, w: string, sel?: boolean) => (
    <div style={{
      width: w, height: 26, borderRadius: 2,
      border: `1px solid #D4CDC1`,
      background: "#fff",
      padding: "0 7px",
      display: "flex", alignItems: "center",
      fontSize: 12.5, color: "#2B2B2B",
      flexShrink: 0,
    }}>
      {val || <span style={{ color: "#aaa" }}>...</span>}
    </div>
  );

  return (
    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header fields */}
      <div style={{
        background: "#fff", borderRadius: 4, border: "1px solid #DDD8CE",
        padding: "12px 14px",
        display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "flex-end",
      }}>
        {fields1.map(f => (
          <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280" }}>{f.label}</label>
            {inp(f.value, f.w, f.select)}
          </div>
        ))}
      </div>

      {/* Lines table */}
      <div style={{
        background: "#fff", borderRadius: 4, border: "1px solid #DDD8CE", overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F8F7F4", borderBottom: "1px solid #DDD8CE" }}>
              {["#","الكود","اسم الصنف","الكمية","الوحدة","السعر","الخصم","الإجمالي"].map((h,i) => (
                <th key={h} style={{
                  padding: "7px 10px", textAlign: "right",
                  fontWeight: 600, fontSize: 11, color: "#6B7280",
                  borderLeft: i > 0 ? "1px solid #EDE9E3" : "none",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{
                background: i === 0 ? "#EEF4FA" : "#fff",
                borderBottom: "1px solid #F0EDE8",
              }}>
                <td style={{ padding: "6px 10px", color: "#6B7280", fontSize: 11, width: 28 }}>{r.code ? i+1 : ""}</td>
                <td style={{ padding: "6px 10px", color: "#406B93", fontWeight: 600 }}>{r.code}</td>
                <td style={{ padding: "6px 10px" }}>{r.name}</td>
                <td style={{ padding: "6px 10px", textAlign: "center" }}>{r.qty}</td>
                <td style={{ padding: "6px 10px", textAlign: "center" }}>{r.unit}</td>
                <td style={{ padding: "6px 10px", textAlign: "center" }}>{r.price}</td>
                <td style={{ padding: "6px 10px", textAlign: "center", color: "#B89B5E" }}>{r.disc}</td>
                <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 600 }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <div style={{
          background: "#fff", borderRadius: 4, border: "1px solid #DDD8CE",
          padding: "10px 16px", minWidth: 240,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {[
            { label: "المجموع", value: "3,020 ر.س" },
            { label: "الخصم",   value: "118.75 ر.س", color: "#C0392B" },
            { label: "الضريبة 15%", value: "435.19 ر.س" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 40, fontSize: 12.5 }}>
              <span style={{ color: "#6B7280" }}>{r.label}</span>
              <span style={{ fontWeight: 600, color: r.color ?? "#2B2B2B" }}>{r.value}</span>
            </div>
          ))}
          <div style={{
            borderTop: "1px solid #DDD8CE", marginTop: 4, paddingTop: 6,
            display: "flex", justifyContent: "space-between", gap: 40,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2B2B2B" }}>الإجمالي</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#406B93" }}>3,336.44 ر.س</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Main Preview ─────────────────── */
export function Toolbar() {
  const [activeBtn, setActiveBtn] = useState("");
  const [mode, setMode] = useState("عرض");
  const [record, setRecord] = useState(12);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const onAction = useCallback((id: string) => {
    setActiveBtn(id);
    setTimeout(() => setActiveBtn(""), 300);
    const actions: Record<string, () => void> = {
      new:     () => { setMode("إدخال"); showToast("تم فتح سجل جديد"); },
      save:    () => { setMode("عرض");   showToast("تم الحفظ بنجاح ✓"); },
      edit:    () => { setMode("تعديل"); showToast("وضع التعديل"); },
      delete:  () => showToast("تم حذف السجل"),
      search:  () => { setMode("بحث");  showToast("بحث..."); },
      refresh: () => showToast("تم التحديث"),
      copy:    () => showToast("تم النسخ"),
      post:    () => showToast("تم الترحيل"),
      approve: () => showToast("تم الاعتماد ✓"),
      cancel:  () => { setMode("عرض"); showToast("تم الإلغاء"); },
      print:   () => showToast("جاري الطباعة..."),
      first:   () => setRecord(1),
      prev:    () => setRecord(r => Math.max(1, r - 1)),
      next:    () => setRecord(r => Math.min(124, r + 1)),
      last:    () => setRecord(124),
      close:   () => showToast("إغلاق"),
    };
    actions[id]?.();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1")  { e.preventDefault(); onAction("new"); }
      if (e.key === "F2")  { e.preventDefault(); onAction("save"); }
      if (e.key === "F3")  { e.preventDefault(); onAction("search"); }
      if (e.key === "F4")  { e.preventDefault(); onAction("edit"); }
      if (e.key === "Delete") onAction("delete");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAction]);

  return (
    <div dir="rtl" style={{
      fontFamily: "'Cairo', 'Tahoma', sans-serif",
      minHeight: "100vh",
      background: "#ECE7DD",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Window title bar */}
      <div style={{
        background: "#406B93",
        color: "#fff",
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <span>فواتير المبيعات</span>
        <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 400 }}>INV-2026-00421</span>
      </div>

      {/* Toolbar */}
      <ERPToolbar activeBtn={activeBtn} onAction={onAction} />

      {/* Form content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <InvoiceForm />
      </div>

      {/* Status bar */}
      <StatusBar mode={mode} record={record} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 36, left: "50%", transform: "translateX(-50%)",
          background: "#2B2B2B", color: "#fff",
          padding: "8px 20px", borderRadius: 6,
          fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 9999,
          animation: "fadeIn 0.15s ease",
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn { from { opacity:0; transform: translateX(-50%) translateY(6px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        ::-webkit-scrollbar { height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CCC9C2; border-radius: 2px; }
      `}</style>
    </div>
  );
}
