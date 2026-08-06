/**
 * ZatcaCenterPage.tsx — مركز التكامل مع هيئة الزكاة والضريبة والجمارك
 * النسخة 2.0: Workflow متكامل + مؤشرات الحالة + لوحة تحكم محسّنة
 */
import React, { useEffect, useState } from "react";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type Section =
  | "activation" | "followup" | "dashboard" | "readiness" | "units" | "otp-sim" | "env" | "devices" | "certs" | "keys"
  | "xmlcheck"  | "csr" | "register" | "csid" | "test" | "compliance"
  | "send"      | "tracking" | "uncertain" | "oplogs" | "errlogs" | "diag" | "reports"
  | "support";

type SetupStepStatus = "done" | "active" | "pending" | "error";
type LinkingEnvironment = "simulation" | "production";

const ENVIRONMENT_COPY: Record<LinkingEnvironment, {
  title: string;
  fullTitle: string;
  shortTitle: string;
  description: string;
  color: string;
  softColor: string;
}> = {
  simulation: {
    title: "الاختبار التجريبي",
    fullTitle: "الاختبار التجريبي — (منصة محاكاة فاتورة) Fatoora Simulation",
    shortTitle: "الاختبار التجريبي — Fatoora Simulation",
    description: "بيئة اختيارية لاختبار ربط OneSoft وإنشاء XML والتوقيع الإلكتروني واختبارات المطابقة قبل استخدام الفواتير الحقيقية.",
    color: "#2563eb",
    softColor: "#eff6ff",
  },
  production: {
    title: "الربط الفعلي",
    fullTitle: "الربط الفعلي — (منصة فاتورة) Production",
    shortTitle: "الربط الفعلي — Production",
    description: "ربط وحدة الفوترة بمنصة فاتورة الفعلية وإصدار اعتمادات الإنتاج اللازمة لإرسال الفواتير الحقيقية إلى الهيئة.",
    color: "#15803d",
    softColor: "#f0fdf4",
  },
};

// ─── قائمة الأقسام ────────────────────────────────────────────────────────────
const PRIMARY_SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "activation", label: "التفعيل والربط",       icon: "🔗" },
  { id: "followup",   label: "التقارير والمتابعة",   icon: "📊" },
];

const TECHNICAL_SECTIONS: { id: Exclude<Section, "activation" | "followup">; label: string; icon: string }[] = [
  { id: "env",      label: "إعدادات الربط والبيئة", icon: "🌐" },
  { id: "register", label: "تسجيل وحدة EGS",        icon: "📱" },
  { id: "csid",     label: "حالة CSID",             icon: "🔑" },
  { id: "devices",  label: "إدارة EGS",       icon: "💻" },
  { id: "certs",    label: "الشهادات",         icon: "🛡️" },
  { id: "keys",     label: "مفاتيح التشفير",   icon: "🔐" },
  { id: "csr",      label: "إنشاء CSR",        icon: "📜" },
  { id: "test",     label: "اختبار الاتصال",  icon: "🔌" },
  { id: "xmlcheck", label: "التحقق من XML",    icon: "🔎" },
  { id: "diag",     label: "التشخيص",          icon: "🧰" },
  { id: "oplogs",   label: "السجلات الفنية",   icon: "📋" },
  { id: "errlogs",  label: "الأخطاء والتنبيهات", icon: "🚨" },
];

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  sales_invoice: "فاتورة مبيعات",
  sales_return: "مردود مبيعات",
  credit_note: "إشعار دائن مبيعات",
  debit_note: "إشعار مدين مبيعات",
};

function journalTypeLabel(docType: string) {
  return JOURNAL_TYPE_LABELS[docType] ?? "دفتر مبيعات";
}

function locationLabel(item: { branchName?: string | null; warehouseName?: string | null }) {
  return item.branchName && item.warehouseName
    ? `${item.branchName} — ${item.warehouseName}`
    : item.warehouseName ?? item.branchName ?? "غير محدد";
}

// ─── خطوات الإعداد ────────────────────────────────────────────────────────────
const SETUP_STEPS: { id: number; label: string; sublabel: string; section: Section; icon: string }[] = [
  { id: 1,  label: "بيانات المنشأة",          sublabel: "التحقق من بيانات المنشأة", section: "readiness", icon: "🏢" },
  { id: 2,  label: "وحدة الفوترة والدفاتر",   sublabel: "ربط الوحدة بالدفاتر والفروع", section: "units", icon: "🧩" },
  { id: 3,  label: "نوع الفواتير",            sublabel: "مبسطة أو قياسية أو كلاهما", section: "readiness", icon: "🧾" },
  { id: 4,  label: "المحاكاة الرسمية للهيئة", sublabel: "مرحلة الاعتماد قبل الإنتاج", section: "otp-sim", icon: "🌐" },
  { id: 5,  label: "اختبارات المطابقة",       sublabel: "التحقق قبل التفعيل الفعلي", section: "test", icon: "📋" },
  { id: 6,  label: "الإنتاج الفعلي",          sublabel: "يُفتح بعد اكتمال المتطلبات", section: "env", icon: "🚀" },
];

// ─── أنماط مشتركة ─────────────────────────────────────────────────────────────
const fld: React.CSSProperties = { height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", fontSize: 12, width: "100%", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 };
const grp: React.CSSProperties = { marginBottom: 14 };
const smallBtn: React.CSSProperties = { height: 24, padding: "0 8px", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" };

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_submitted:         { label: "لم تُرسَل",                    color: "#6b7280", bg: "#f3f4f6" },
  ready_to_submit:       { label: "جاهزة للإرسال",                color: "#475569", bg: "#f1f5f9" },
  submitting:            { label: "جاري الإرسال",                 color: "#7c3aed", bg: "#ede9fe" },
  submitted_pending:     { label: "أُرسل — بانتظار الرد",         color: "#d97706", bg: "#fef3c7" },
  cleared:               { label: "مقبولة — تخليص",                color: "#16a34a", bg: "#dcfce7" },
  reported:              { label: "مقبولة — إبلاغ",                color: "#0ea5e9", bg: "#e0f2fe" },
  accepted_with_warnings:{ label: "مقبولة مع تحذيرات",             color: "#ca8a04", bg: "#fef9c3" },
  rejected:              { label: "مرفوضة",                         color: "#dc2626", bg: "#fee2e2" },
  connection_issue:      { label: "مشكلة اتصال",                  color: "#dc2626", bg: "#fee2e2" },
  retry_pending:         { label: "بانتظار إعادة المحاولة",       color: "#ea580c", bg: "#ffedd5" },
  uncertain:             { label: "حالة غير مؤكدة",               color: "#9333ea", bg: "#f3e8ff" },
  pending:               { label: "في الانتظار",                  color: "#d97706", bg: "#fef3c7" },
  error:                 { label: "خطأ",                          color: "#dc2626", bg: "#fee2e2" },
  success:               { label: "ناجحة",                        color: "#16a34a", bg: "#dcfce7" },
};

// ─── مكوّنات مشتركة ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_MAP[status ?? "not_submitted"] ?? STATUS_MAP.not_submitted;
  return (
    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
}

function SecTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ fontWeight: 800, fontSize: 14, color: "#D19C05", marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #fde68a", display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 18 }}>{icon}</span> {title}
    </div>
  );
}

/** نقطة حالة ملوّنة — 🟢🟡🔴⚪ */
function StatusDot({ status }: { status: "ok" | "warn" | "error" | "none" }) {
  const colors = { ok: "#16a34a", warn: "#d97706", error: "#dc2626", none: "#9ca3af" };
  const labels = { ok: "مكتمل", warn: "يحتاج إعداد", error: "يوجد خطأ", none: "لم يبدأ" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status], boxShadow: `0 0 0 2px ${colors[status]}33`, flexShrink: 0 }} />
      <span style={{ color: colors[status], fontWeight: 600 }}>{labels[status]}</span>
    </span>
  );
}

/** بطاقة حالة موحّدة — تدعم onClick للتنقل */
function StatusCard({ label, value, dot, sub, onClick }: { label: string; value: string; dot: "ok" | "warn" | "error" | "none"; sub?: string; onClick?: () => void }) {
  const bg = { ok: "#f0fdf4", warn: "#fffbeb", error: "#fef2f2", none: "#f8fafc" };
  const border = { ok: "#bbf7d0", warn: "#fde68a", error: "#fecaca", none: "#e2e8f0" };
  return (
    <div onClick={onClick}
      title={onClick ? "انقر للانتقال" : undefined}
      style={{ background: bg[dot], borderRadius: 10, padding: "12px 14px", border: `1px solid ${border[dot]}`, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.15s, transform 0.1s" }}
      onMouseEnter={e => { if (onClick) { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
        {onClick && <span style={{ fontSize: 9, color: "#9ca3af" }}>↗</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>{sub}</div>}
      <StatusDot status={dot} />
    </div>
  );
}

/** Skeleton loading placeholder */
function Skeleton({ width = "100%", height = 16, radius = 4 }: { width?: string | number; height?: number; radius?: number }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
}

/** بطاقة KPI للأداء */
function KpiCard({ label, value, icon, color, sub, onClick }: { label: string; value: string | number; icon: string; color: string; sub?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick}
      title={onClick ? "انقر للتفاصيل" : undefined}
      style={{ background: "#fff", borderRadius: 10, padding: "14px 12px", border: `1px solid ${color}22`, cursor: onClick ? "pointer" : "default", transition: "all 0.15s", textAlign: "center", borderTop: `3px solid ${color}` }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${color}22`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** سجل زمني — Timeline */
function Timeline({ items }: { items: { icon: string; label: string; detail: string; time: string; user?: string; color?: string }[] }) {
  if (!items.length) return (
    <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "20px 0" }}>لا توجد عمليات مسجّلة بعد</div>
  );
  return (
    <div style={{ position: "relative" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: item.color ? `${item.color}18` : "#f1f5f9", border: `2px solid ${item.color ?? "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{item.icon}</div>
            {i < items.length - 1 && <div style={{ width: 2, flex: 1, background: "#e2e8f0", marginTop: 4, minHeight: 16 }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}>{item.label}</span>
              <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{item.time}</span>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{item.detail}</div>
            {item.user && <span style={{ fontSize: 10, color: "#D19C05", fontWeight: 600 }}>👤 {item.user}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// معالج الإعداد (Setup Wizard)
// ══════════════════════════════════════════════════════════════════════════════
function SetupWizard({ onClose, onNavigate, cfg, stats }: {
  onClose: () => void;
  onNavigate: (s: Section) => void;
  cfg: any;
  stats: any;
}) {
  const [activeStep, setActiveStep] = useState(1);

  const getStepStatus = (id: number): SetupStepStatus => {
    if (id === 1)  return cfg?.legalName && cfg?.vatNumber ? "done" : "active";
    if (id === 2)  return "pending";
    if (id === 3)  return cfg?.sellerType ? "done" : "pending";
    if (id === 4)  return cfg?.csid ? "done" : "pending";
    if (id === 5)  return (cfg as any)?.lastConnectionStatus === "success" ? "done" : "pending";
    if (id === 6)  return cfg?.enabled && cfg?.environment === "production" ? "done" : "pending";
    return "pending";
  };

  const doneCount = SETUP_STEPS.filter(s => getStepStatus(s.id) === "done").length;
  const progress  = Math.round((doneCount / SETUP_STEPS.length) * 100);

  const stepColors: Record<SetupStepStatus, { bg: string; border: string; text: string; icon: string }> = {
    done:    { bg: "#dcfce7", border: "#16a34a", text: "#16a34a", icon: "✅" },
    active:  { bg: "#fef3c7", border: "#D19C05", text: "#D19C05", icon: "⏳" },
    pending: { bg: "#f8fafc", border: "#e2e8f0", text: "#9ca3af", icon: "⌛" },
    error:   { bg: "#fee2e2", border: "#dc2626", text: "#dc2626", icon: "❌" },
  };

  const step = SETUP_STEPS[activeStep - 1];
  const st   = getStepStatus(activeStep);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 780, maxHeight: "90vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* رأس الـ Wizard */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", padding: "20px 24px", color: "#fff", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 32 }}>🏛️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>مراجعة مراحل التفعيل والربط</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>اتبع المراحل الست لإعداد الفوترة الإلكترونية والانتقال إلى الإنتاج</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#D19C05" }}>{progress}%</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{doneCount} / {SETUP_STEPS.length} خطوة</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* شريط التقدم */}
        <div style={{ height: 4, background: "#e2e8f0" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#D19C05,#f59e0b)", transition: "width 0.5s", borderRadius: "0 2px 2px 0" }} />
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* قائمة الخطوات — يسار */}
          <div style={{ width: 240, borderLeft: "1px solid #e2e8f0", overflowY: "auto", padding: "12px 0" }}>
            {SETUP_STEPS.map(s => {
              const st = getStepStatus(s.id);
              const c  = stepColors[st];
              const isActive = s.id === activeStep;
              return (
                <div key={s.id} onClick={() => setActiveStep(s.id)} style={{ display: "flex", gap: 10, padding: "10px 16px", cursor: "pointer", borderRight: isActive ? `3px solid #D19C05` : "3px solid transparent", background: isActive ? "#fffbeb" : "transparent", transition: "all 0.1s" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: c.bg, border: `2px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, fontWeight: 800, color: c.text }}>
                    {st === "done" ? "✓" : s.id}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 600, color: isActive ? "#D19C05" : "#374151" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.sublabel}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* تفاصيل الخطوة — يمين */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: stepColors[st].bg, border: `2px solid ${stepColors[st].border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#1e293b" }}>الخطوة {step.id}: {step.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{step.sublabel}</div>
              </div>
              <div style={{ marginRight: "auto" }}>
                <span style={{ padding: "3px 12px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: stepColors[st].bg, color: stepColors[st].text, border: `1px solid ${stepColors[st].border}` }}>
                  {stepColors[st].icon} {st === "done" ? "مكتمل" : st === "active" ? "يحتاج إعداد" : st === "error" ? "يوجد خطأ" : "لم يبدأ"}
                </span>
              </div>
            </div>

            <StepDetail step={activeStep} cfg={cfg} stats={stats} />

            {/* أزرار التنقل */}
            <div style={{ display: "flex", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setActiveStep(s => Math.max(1, s - 1))} disabled={activeStep === 1}
                style={{ height: 34, padding: "0 16px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: activeStep === 1 ? "not-allowed" : "pointer", opacity: activeStep === 1 ? 0.5 : 1 }}>
                ← السابق
              </button>
              <button onClick={() => { onNavigate(step.section); onClose(); }}
                style={{ height: 34, padding: "0 20px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                 فتح المرحلة
              </button>
              <button onClick={() => setActiveStep(s => Math.min(SETUP_STEPS.length, s + 1))} disabled={activeStep === SETUP_STEPS.length}
                style={{ height: 34, padding: "0 16px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: activeStep === SETUP_STEPS.length ? "not-allowed" : "pointer", opacity: activeStep === SETUP_STEPS.length ? 0.5 : 1, marginRight: "auto" }}>
                التالي →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDetail({ step, cfg, stats }: { step: number; cfg: any; stats: any }) {
  const stepInfo: Record<number, { desc: string; items: string[]; note?: string }> = {
    1: { desc: "ابدأ بمراجعة بيانات المنشأة ورقم التسجيل الضريبي والعنوان قبل إنشاء وحدة الفوترة.", items: ["اسم المنشأة القانوني", "الرقم الضريبي", "العنوان وبيانات التواصل"] },
    2: { desc: "أنشئ وحدة فوترة واربطها بالفرع ونقطة الإصدار والدفاتر المناسبة.", items: ["اختيار دفتر مبيعات", "تحديد الفرع والمخزن", "ربط دفاتر دورة المبيعات"] },
    3: { desc: "حدد نطاق الفواتير التي ستخضع للربط: مبسطة أو قياسية أو كلاهما.", items: ["Reporting للفواتير المبسطة", "Clearance للفواتير القياسية", "مراجعة الإعداد قبل الاعتماد"] },
    4: { desc: "استخدم المحاكاة الرسمية للهيئة كمرحلة اعتماد لإصدار الشهادة وتجهيز وحدة الفوترة.", items: ["إنشاء CSR على الخادم", "إدخال OTP الصادر من البوابة الرسمية", "طلب Compliance وProduction CSID وفق الصلاحيات"] },
    5: { desc: "تحقق من صحة XML والتوقيع وتدفق الإرسال قبل طلب التفعيل الفعلي.", items: ["فحص XML", "اختبار الاتصال", "مراجعة نتيجة المطابقة والتنبيهات"] },
    6: { desc: "لا يُفتح الإنتاج إلا بعد اكتمال المراحل السابقة واعتماد مسؤول الربط.", items: ["اعتماد الانتقال إلى الإنتاج", "تفعيل وحدة EGS", "مراقبة الشهادة والاتصال بعد التفعيل"] },
  };

  const info = stepInfo[step];
  if (!info) return null;

  return (
    <div>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, marginBottom: 14, border: "1px solid #e2e8f0" }}>
        <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.7 }}>{info.desc}</p>
      </div>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 8 }}>📋 ما يجب فعله:</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        {info.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#fff", borderRadius: 6, padding: "8px 12px", border: "1px solid #e2e8f0", fontSize: 12 }}>
            <span style={{ color: "#D19C05", flexShrink: 0 }}>◆</span>
            <span style={{ color: "#374151" }}>{item}</span>
          </div>
        ))}
      </div>
      {info.note && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#fef3c7", borderRadius: 8, padding: "10px 14px", border: "1px solid #fde68a" }}>
          <span>ℹ️</span>
          <span style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>{info.note}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. لوحة التحكم — محسّنة
// ══════════════════════════════════════════════════════════════════════════════
function DashboardSection({ onStartSetup, onNavigate }: { onStartSetup: () => void; onNavigate: (s: Section) => void }) {
  const statsQ = trpc.zatca.getStats.useQuery();
  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const s   = statsQ.data;
  const cfg = cfgQ.data;

  const envDot:  "ok"|"warn"|"error"|"none" = cfg?.environment === "production" ? "ok" : cfg?.environment === "sandbox" ? "warn" : "none";
  const connDot: "ok"|"warn"|"error"|"none" = (cfg as any)?.lastConnectionStatus === "success" ? "ok" : (cfg as any)?.lastConnectionStatus === "failed" ? "error" : "none";
  const certDays = cfg?.certExpiryDate ? Math.ceil((new Date(cfg.certExpiryDate).getTime() - Date.now()) / 86400000) : null;
  const certDot: "ok"|"warn"|"error"|"none" = certDays === null ? "none" : certDays <= 0 ? "error" : certDays <= 30 ? "warn" : "ok";
  const csidDot: "ok"|"warn"|"error"|"none" = cfg?.csid ? "ok" : "none";
  const keyDot:  "ok"|"warn"|"error"|"none" = cfg?.csid ? "ok" : "none";
  const devDot:  "ok"|"warn"|"error"|"none" = "none";
  const enabledDot: "ok"|"warn"|"error"|"none" = cfg?.enabled ? "ok" : "warn";

  const setupDone = [envDot, csidDot, connDot, certDot].filter(d => d === "ok").length;
  const readyPct  = Math.round((setupDone / 4) * 100);

  const statCards = [
    { label: "إجمالي الفواتير", value: s?.totalInvoices ?? 0, icon: "📄", color: "#6366f1" },
    { label: "Mock: تخليص تجريبي", value: s?.cleared ?? 0,        icon: "✅", color: "#16a34a" },
    { label: "في الانتظار",    value: s?.pending ?? 0,        icon: "⏳", color: "#d97706" },
    { label: "Mock: رفض تجريبي", value: s?.rejected ?? 0,       icon: "❌", color: "#dc2626" },
    { label: "أخطاء",           value: s?.errors ?? 0,         icon: "⚠️", color: "#7c3aed" },
    { label: "لم تُرسَل",       value: s?.notSubmitted ?? 0,   icon: "📭", color: "#6b7280" },
  ];

  return (
    <div>
       <SecTitle icon="🏠" title="لوحة التحكم — مركز الفوترة الإلكترونية" />

      {/* زر بدء الإعداد */}
      {readyPct < 100 && (
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: 12, padding: "20px 24px", marginBottom: 20, display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ fontSize: 48 }}>🏛️</div>
          <div style={{ flex: 1 }}>
             <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 4 }}>إعداد مركز الفوترة الإلكترونية</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>أنشئ وحدة ربط من دفتر مبيعات، وسيُعد OneSoft الربط الفني تلقائيًا داخل البيئة التجريبية.</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)" }}>
                <div style={{ height: "100%", width: `${readyPct}%`, background: "#D19C05", borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, color: "#D19C05", fontWeight: 700, whiteSpace: "nowrap" }}>{readyPct}% مكتمل</span>
            </div>
          </div>
          <button onClick={onStartSetup}
            style={{ height: 44, padding: "0 24px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            ▶ بدء إعداد الربط
          </button>
        </div>
      )}

      {readyPct === 100 && (
        <div style={{ background: "#dcfce7", border: "1px solid #16a34a", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#16a34a" }}>نموذج الربط الداخلي مكتمل</div>
            <div style={{ fontSize: 12, color: "#166534" }}>هذا لا يعني جاهزية ZATCA للإنتاج؛ Production محجوبة</div>
          </div>
        </div>
      )}

      {/* ══ تنبيهات متعددة ══ */}
      {cfgQ.isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          <Skeleton height={36} radius={8} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: readyPct < 100 || certDot !== "none" || (s?.rejected ?? 0) > 0 || (s?.pending ?? 0) > 0 ? 16 : 0 }}>
          {certDot === "error" && (
            <div style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              🚨 <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 12, flex: 1 }}>{(certDays ?? 0) <= 0 ? "انتهت صلاحية الشهادة — تجديد فوري مطلوب!" : `تنتهي الشهادة خلال ${certDays} أيام فقط!`}</span>
              <button onClick={() => onNavigate("certs")} style={{ height: 26, padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>تجديد الآن</button>
            </div>
          )}
          {certDot === "warn" && (
            <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ⚠️ <span style={{ color: "#92400e", fontWeight: 700, fontSize: 12, flex: 1 }}>الشهادة ستنتهي خلال {certDays} يوماً — خطط للتجديد مبكراً</span>
              <button onClick={() => onNavigate("certs")} style={{ height: 26, padding: "0 12px", background: "#d97706", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>عرض الشهادات</button>
            </div>
          )}
          {devDot === "none" && (
            <div style={{ background: "#f0f9ff", border: "1px solid #0ea5e9", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              💻 <span style={{ color: "#0c4a6e", fontWeight: 700, fontSize: 12, flex: 1 }}>لا يوجد جهاز فوترة مسجّل — سجّل جهازك لبدء الإرسال</span>
              <button onClick={() => onNavigate("devices")} style={{ height: 26, padding: "0 12px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>تسجيل جهاز</button>
            </div>
          )}
          {(s?.rejected ?? 0) > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ❌ <span style={{ color: "#7f1d1d", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.rejected} فاتورة Mock مرفوضة تجريبيًا تحتاج مراجعة داخلية</span>
              <button onClick={() => onNavigate("errlogs")} style={{ height: 26, padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>سجل الأخطاء</button>
            </div>
          )}
          {(s?.pending ?? 0) > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ⏳ <span style={{ color: "#78350f", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.pending} فاتورة في الانتظار — أرسلها للهيئة</span>
              <button onClick={() => onNavigate("send")} style={{ height: 26, padding: "0 12px", background: "#d97706", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>إرسال الآن</button>
            </div>
          )}
          {(s?.simplifiedReportingOverdue ?? 0) > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ⏰ <span style={{ color: "#991b1b", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.simplifiedReportingOverdue} فاتورة مبسطة تجاوزت مهلة الإبلاغ 24 ساعة</span>
              <button onClick={() => onNavigate("uncertain")} style={{ height: 26, padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>مراجعة الآن</button>
            </div>
          )}
          {(s?.simplifiedReportingDueSoon ?? 0) > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fb923c", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ⚠️ <span style={{ color: "#9a3412", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.simplifiedReportingDueSoon} فاتورة مبسطة تقترب من مهلة الإبلاغ 24 ساعة</span>
              <button onClick={() => onNavigate("send")} style={{ height: 26, padding: "0 12px", background: "#ea580c", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>إرسال الآن</button>
            </div>
          )}
        </div>
      )}

      {/* ══ مؤشرات الحالة التفاعلية ══ */}
      <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>⚙️ حالة المكوّنات الأساسية — انقر على أي بطاقة للانتقال</div>
      {cfgQ.isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={80} radius={10} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatusCard label="البيئة الحالية"      value={cfg?.environment === "production" ? "🟢 الإنتاج" : cfg?.environment === "sandbox" ? "🧪 الاختبار" : "غير محدد"} dot={envDot} sub={cfg?.environment ? "تم التهيئة" : "اضغط لإعداد البيئة"} onClick={() => onNavigate("env")} />
           <StatusCard label="حالة Mock"        value={(cfg as any)?.lastConnectionStatus === "success" ? "Mock ✓" : (cfg as any)?.lastConnectionStatus === "failed" ? "Mock ✗" : "لم تُختبر"} dot={connDot} sub={cfg?.lastConnectionTest ? `آخر اختبار Mock: ${new Date(cfg.lastConnectionTest).toLocaleDateString("ar-SA")}` : "لا يوجد اتصال خارجي"} onClick={() => onNavigate("test")} />
          <StatusCard label="شهادة CSID"          value={cfg?.csid ? "موجودة ✓" : "غير موجودة"} dot={csidDot} sub={certDays !== null ? (certDays > 0 ? `${certDays} يوم متبقٍ` : "منتهية!") : "—"} onClick={() => onNavigate("certs")} />
          <StatusCard label="Secret Key"          value={cfg?.csid ? "موجود ✓" : "غير موجود"} dot={keyDot} sub="مشفّر AES-256-GCM في DB" onClick={() => onNavigate("keys")} />
          <StatusCard label="الأجهزة (EGS)"       value="0 جهاز مسجّل" dot={devDot} sub="انقر لإدارة الأجهزة" onClick={() => onNavigate("devices")} />
          <StatusCard label="تفعيل ZATCA"         value={cfg?.enabled ? "مُفعَّلة ✓" : "غير مُفعَّلة"} dot={enabledDot} sub={cfg?.vatNumber ?? "الرقم الضريبي غير محدد"} onClick={() => onNavigate("env")} />
           <StatusCard label="فواتير اليوم (Mock)" value={String(s?.todayCount ?? s?.cleared ?? 0)} dot={(s?.todayCount ?? 0) > 0 ? "ok" : "none"} sub={`إجمالي تخليص تجريبي: ${s?.cleared ?? 0}`} onClick={() => onNavigate("oplogs")} />
          <StatusCard label="نسبة نجاح Mock"  value={s?.totalInvoices ? `${Math.round((s.cleared / s.totalInvoices) * 100)}%` : "—"} dot={s?.totalInvoices && s.cleared / s.totalInvoices > 0.8 ? "ok" : s?.totalInvoices ? "warn" : "none"} sub={`${s?.rejected ?? 0} رفض Mock تجريبي`} onClick={() => onNavigate("reports")} />
        </div>
      )}

      {/* ══ مؤشرات الأداء KPIs ══ */}
      <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>📊 مؤشرات الأداء</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <KpiCard label="الأجهزة النشطة"     icon="💻" value={0}                                                        color="#0ea5e9" sub="من 1 جهاز إجمالي"         onClick={() => onNavigate("devices")} />
        <KpiCard label="شهادات سارية"        icon="🛡️" value={cfg?.csid ? 1 : 0}                                       color="#16a34a" sub={certDays !== null ? `${certDays} يوم متبقٍ` : "—"} onClick={() => onNavigate("certs")} />
        <KpiCard label="CSID نشطة"           icon="🔑" value={cfg?.csid ? 1 : 0}                                       color="#8b5cf6" sub="معرّفات الاتصال"            onClick={() => onNavigate("csid")} />
         <KpiCard label="إجمالي الفواتير"     icon="📄" value={s?.totalInvoices ?? 0}                                   color="#6366f1" sub={`${s?.cleared ?? 0} تخليص Mock تجريبي`} onClick={() => onNavigate("oplogs")} />
        <KpiCard label="شهادات منتهية"       icon="⏰" value={certDays !== null && certDays <= 0 ? 1 : 0}             color="#dc2626" sub="تحتاج تجديد فوري"           onClick={() => onNavigate("certs")} />
        <KpiCard label="ستنتهي قريباً"       icon="🕐" value={certDays !== null && certDays > 0 && certDays <= 30 ? 1 : 0} color="#d97706" sub="خلال 30 يوم"         onClick={() => onNavigate("certs")} />
         <KpiCard label="رفض Mock تجريبي"      icon="❌" value={s?.rejected ?? 0}                                        color="#ef4444" sub="تحتاج مراجعة داخلية"              onClick={() => onNavigate("errlogs")} />
        <KpiCard label="في الانتظار"         icon="⏳" value={s?.pending ?? 0}                                         color="#f59e0b" sub="لم تُرسَل بعد"             onClick={() => onNavigate("send")} />
      </div>

      {/* ══ شريط الامتثال + Timeline ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* شريط الامتثال */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📈 إحصائيات الفواتير</span>
            <button onClick={() => onNavigate("reports")} style={{ fontSize: 10, color: "#D19C05", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>عرض التقرير ↗</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {statCards.map(c => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontSize: 16 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>
          {s && s.totalInvoices > 0 && (
            <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>نسبة نجاح Mock</div>
              <div style={{ height: 10, borderRadius: 5, background: "#f1f5f9", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.round((s.cleared / s.totalInvoices) * 100)}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: 5, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>{Math.round((s.cleared / s.totalInvoices) * 100)}%</span>
                <span style={{ color: "#6b7280" }}>{s.cleared} تخليص Mock تجريبي من {s.totalInvoices}</span>
                {s.rejected > 0 && <span style={{ color: "#dc2626" }}>• {s.rejected} رفض Mock تجريبي</span>}
              </div>
            </>
          )}
          {!s?.totalInvoices && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "12px 0" }}>لا توجد فواتير بعد</div>}
        </div>

        {/* Timeline — سجل زمني */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🕒 آخر العمليات</span>
            <button onClick={() => onNavigate("oplogs")} style={{ fontSize: 10, color: "#D19C05", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>عرض الكل ↗</button>
          </div>
          <Timeline items={[
             ...((cfg as any)?.lastConnectionStatus === "success" ? [{ icon: "✅", label: "نجاح اختبار Mock", detail: "لا يوجد اتصال فعلي بـ Fatoora", time: cfg?.lastConnectionTest ? new Date(cfg.lastConnectionTest).toLocaleDateString("ar-SA") : "—", color: "#16a34a" }] : []),
             ...(cfg?.csid ? [{ icon: "🔑", label: "CSID محاكاة موجود", detail: "ليس اعتمادًا رسميًا", time: "—", color: "#8b5cf6" }] : []),
            ...(cfg?.environment ? [{ icon: "🌐", label: `تم تعيين البيئة: ${cfg.environment === "production" ? "الإنتاج" : "الاختبار"}`, detail: "إعدادات البيئة محفوظة", time: "—", color: "#0ea5e9" }] : []),
            ...((s?.cleared ?? 0) > 0 ? [{ icon: "📄", label: `${s!.cleared} فاتورة Mock بتخليص تجريبي`, detail: "بيانات اختبار — لا يوجد اتصال فعلي بـ Fatoora", time: "اليوم", color: "#16a34a" }] : []),
            ...((s?.rejected ?? 0) > 0 ? [{ icon: "❌", label: `${s!.rejected} فاتورة Mock مرفوضة تجريبيًا`, detail: "تحتاج مراجعة داخلية فقط", time: "اليوم", color: "#dc2626" }] : []),
          ]} />
          {!(cfg?.environment) && !(cfg?.csid) && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "12px 0" }}>ابدأ الإعداد لرؤية السجل الزمني</div>}
        </div>
      </div>

      {/* ══ وصلات سريعة ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {([
          { label: "إعدادات البيئة", icon: "🌐", sec: "env"      as Section },
          { label: "إرسال الفواتير", icon: "📤", sec: "send"     as Section },
          { label: "اختبار الاتصال", icon: "🔌", sec: "test"     as Section },
          { label: "أدوات التشخيص",  icon: "🔬", sec: "diag"     as Section },
        ]).map(b => (
          <button key={b.label} onClick={() => onNavigate(b.sec)}
            style={{ height: 38, padding: "0 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", gap: 6, justifyContent: "center", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D19C05"; (e.currentTarget as HTMLButtonElement).style.color = "#D19C05"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.color = "#374151"; }}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1b. جاهزية الربط — قراءة فقط قبل رحلة CSR/OTP
// ══════════════════════════════════════════════════════════════════════════════
function ReadinessSection({ onNavigate, onOpenCompanyInfo }: {
  onNavigate: (section: Section) => void;
  onOpenCompanyInfo?: () => void;
}) {
  const utils = trpc.useUtils();
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [invoiceType, setInvoiceType] = useState<"simplified" | "standard" | "both">("both");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [savedLoaded, setSavedLoaded] = useState(false);

  const readinessQ = trpc.zatca.getReadiness.useQuery({
    warehouseId: warehouseId ?? undefined,
    invoiceType,
  });
  const data = readinessQ.data;
  const organizationComplete = Boolean(data?.organization?.dataComplete);
  const overallReady = Boolean(data?.preCsrReady);
  const saveM = trpc.zatca.saveReadinessSettings.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ إعداد الجاهزية في قاعدة البيانات");
      utils.zatca.getReadiness.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (savedLoaded || !data?.savedSettings) return;
    const saved = data.savedSettings;
    setWarehouseId(saved.warehouseId);
    setInvoiceType((saved.invoiceType as typeof invoiceType) || "both");
    setUnitId(saved.zatcaPosUnitId ?? null);
    setSavedLoaded(true);
  }, [data?.savedSettings, savedLoaded]);

  const setWarehouse = (value: number | null) => {
    setWarehouseId(value);
    setUnitId(null);
  };
  const statusStyle = (ok: boolean, neutral = false) => ({
    background: neutral ? "#f8fafc" : ok ? "#f0fdf4" : "#fff7ed",
    border: `1px solid ${neutral ? "#e2e8f0" : ok ? "#bbf7d0" : "#fed7aa"}`,
    color: neutral ? "#475569" : ok ? "#166534" : "#9a3412",
  });
  const Status = ({ ok, text }: { ok: boolean; text: string }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: ok ? "#16a34a" : "#d97706" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "#16a34a" : "#d97706" }} />
      {text}
    </span>
  );

  return (
    <div>
      <SecTitle icon="✅" title="جاهزية الربط مع منصة فاتورة" />
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: "11px 13px", fontSize: 12, lineHeight: 1.8, marginBottom: 14 }}>
        هذه الشاشة فحص قراءة فقط قبل إنشاء CSR. لا تنشئ دفاتر أو وحدة ربط أو بيانات ضريبية، ولا تُرسل OTP أو أي طلب خارجي.
      </div>
      <div style={{
        background: overallReady ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${overallReady ? "#86efac" : "#fecaca"}`,
        color: overallReady ? "#166534" : "#991b1b",
        borderRadius: 10, padding: "13px 15px", marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{overallReady ? "✅" : "⛔"}</span>
          <strong style={{ fontSize: 14 }}>
            {overallReady ? "جاهز لإنشاء CSR" : "غير جاهز"}
          </strong>
        </div>
        <div style={{ fontSize: 11, marginTop: 5, lineHeight: 1.7 }}>
          {overallReady
            ? "اكتملت جميع شروط ما قبل التفعيل."
            : organizationComplete
              ? "يوجد شرط أو أكثر من شروط ما قبل التفعيل لم يكتمل."
              : "بيانات المنشأة ناقصة؛ لا يمكن إنشاء CSR قبل استكمالها."}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <label style={lbl}>المنشأة</label>
          <select style={fld} value={data?.organization?.id ?? ""} disabled>
            {(data?.availableOrganizations ?? []).map(org => (
              <option key={org.id} value={org.id}>{org.name}{org.nameEn ? ` — ${org.nameEn}` : ""}</option>
            ))}
          </select>
          <div style={{ marginTop: 9, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>المنشأة الحالية لحساب المستخدم</span>
            <Status ok={organizationComplete} text={organizationComplete ? "بيانات مكتملة" : "بيانات ناقصة"} />
          </div>
          {!data?.organization?.dataComplete && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#9a3412", lineHeight: 1.7 }}>
              الناقص: {data?.organization?.missingFields?.join("، ") || "جارٍ الفحص"}
            </div>
          )}
          {onOpenCompanyInfo && (
            <button
              onClick={onOpenCompanyInfo}
              style={{ ...smallBtn, marginTop: 10, background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}
            >
              🏢 فتح معلومات الشركة
            </button>
          )}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <label style={lbl}>المخزن / الفرع</label>
          <select
            style={fld}
            value={warehouseId ?? ""}
            onChange={e => setWarehouse(Number(e.target.value) || null)}
          >
            <option value="">اختر المخزن/الفرع</option>
            {(data?.locations ?? []).map(location => (
              <option key={location.id} value={location.id}>{location.label}</option>
            ))}
          </select>
          <div style={{ marginTop: 9, fontSize: 11, color: "#64748b" }}>
            يُستنتج الفرع من المخزن، ولا تُدخل أي ID يدويًا.
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <label style={lbl}>وحدة الربط</label>
          <select
            style={fld}
            value={unitId ?? ""}
            onChange={event => setUnitId(Number(event.target.value) || null)}
            disabled={!warehouseId}
          >
            <option value="">اختيار تلقائي من الدفاتر</option>
            {data?.linkingUnits
              ?.filter(unit => unit.warehouseId === warehouseId)
              .map(unit => <option key={unit.id} value={unit.id}>{unit.unitName} — {unit.unitCode}</option>)}
          </select>
          <div style={{ marginTop: 9, fontSize: 11, color: "#64748b" }}>
            الإعداد محفوظ للمنظمة، ولا تُحفظ هنا أي أسرار أو مفاتيح.
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 9 }}>نوع الفواتير المستهدف</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["simplified", "فواتير مبسطة"],
            ["standard", "فواتير عادية"],
            ["both", "كلاهما"],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setInvoiceType(value as typeof invoiceType)}
              style={{ height: 32, padding: "0 15px", borderRadius: 7, border: `1px solid ${invoiceType === value ? "#D19C05" : "#cbd5e1"}`, background: invoiceType === value ? "#fef3c7" : "#fff", color: invoiceType === value ? "#92400e" : "#475569", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
              {invoiceType === value ? "● " : "○ "}{label}
            </button>
          ))}
        </div>
      </div>

      {readinessQ.isLoading ? <Skeleton height={150} radius={10} /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>حالة الدفاتر الأربعة</div>
              {(data?.journals ?? []).map(journal => (
                <div key={journal.docType} style={{ ...statusStyle(journal.found && journal.linked), display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", borderRadius: 6, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{journal.label}</span>
                  <span style={{ fontSize: 10, color: "#64748b" }}>
                    {!journal.found ? "الدفتر غير موجود" : !journal.linked ? "غير مرتبط" : "مرتبط"}
                  </span>
                  <Status
                    ok={journal.found && journal.linked && organizationComplete}
                    text={!journal.found ? "ناقص" : !journal.linked ? "غير مرتبط" : organizationComplete ? "مكتمل" : "يُراجع بعد اكتمال المنشأة"}
                  />
                </div>
              ))}
              {!warehouseId && <div style={{ fontSize: 11, color: "#9a3412", marginTop: 8 }}>اختر المخزن/الفرع لفحص دفاتره.</div>}
              {data?.allJournalsSameUnit && <div style={{ fontSize: 11, color: "#166534", marginTop: 8 }}>الدفاتر الأربعة مرتبطة بوحدة ربط واحدة.</div>}
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>الشاشات وقدرة XML</div>
              {(data?.screens ?? []).map(screen => (
                <div key={screen.docType} style={{ ...statusStyle(screen.screenExists && screen.xmlReady), padding: "8px 9px", borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{screen.label}</span>
                    <Status ok={screen.screenExists} text={screen.screenExists ? "الشاشة موجودة" : "غير موجودة"} />
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{screen.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>بوابة Fatoora Simulation</div>
            <div style={{ ...statusStyle(Boolean(data?.simulation.configured)), padding: "9px 10px", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>
                {data?.simulation.configured ? "تم اختيار بيئة Simulation الرسمية" : "بيئة Simulation غير مهيأة"}
              </span>
              <Status ok={Boolean(data?.simulation.configured)} text={data?.simulation.configured ? "مكتملة" : "ناقصة"} />
              {!data?.simulation.configured && <button onClick={() => onNavigate("env")} style={{ ...smallBtn, background: "#fef3c7", color: "#92400e" }}>فتح إعداد البيئة</button>}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>الفحص الاسترشادي قبل المطابقة</div>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 10 }}>
              هذا فحص جاهزية محلي لقدرة إنشاء XML، وهو شرط سابق لإنشاء CSR وليس اختبار مطابقة رسميًا. تبدأ اختبارات المطابقة الرسمية بعد الحصول على Compliance CSID.
            </div>
            {(data?.operationalTests ?? []).map(test => (
              <div key={test.docType} style={{ ...statusStyle(test.completed), display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 6, marginBottom: 5 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700 }}>{test.label}</span>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {test.completed ? `مستند ${test.invoiceNumber ?? ""} اجتاز الفحص` : "لا توجد نتيجة تشغيلية مكتملة"}
                </span>
                <Status ok={test.completed} text={test.completed ? "تم" : "لم يتم"} />
              </div>
            ))}
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: data?.operationalTestCompleted ? "#166534" : "#9a3412" }}>
              فحص الجاهزية المحلي: {data?.operationalTestCompleted ? "متاح" : "لم يبدأ بعد"}
            </div>
          </div>

          {!data?.preCsrReady && (
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: "11px 13px", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 5 }}>لا يمكن بدء إنشاء CSR بعد</div>
              <ul style={{ margin: 0, paddingRight: 18, fontSize: 11, lineHeight: 1.8 }}>
                {(data?.reasons ?? ["جارٍ فحص متطلبات الجاهزية"]).map(reason => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              disabled={!warehouseId || saveM.isPending}
              onClick={() => warehouseId && saveM.mutate({ warehouseId, invoiceType, zatcaPosUnitId: unitId })}
              style={{ ...smallBtn, height: 36, background: warehouseId ? "#406B93" : "#cbd5e1", color: "#fff", cursor: warehouseId ? "pointer" : "not-allowed" }}
            >
              {saveM.isPending ? "جارٍ الحفظ..." : "💾 حفظ إعداد الجاهزية"}
            </button>
            <button
               disabled={!data?.preCsrReady}
               onClick={() => onNavigate("otp-sim")}
               style={{ height: 36, padding: "0 18px", border: "none", borderRadius: 7, background: data?.preCsrReady ? "#D19C05" : "#cbd5e1", color: "#fff", fontWeight: 800, fontSize: 12, cursor: data?.preCsrReady ? "pointer" : "not-allowed" }}
            >
               {data?.preCsrReady ? "🌐 فتح بوابة Simulation وإدخال OTP" : "🔒 بدء المحاكاة معطّل حتى اكتمال الجاهزية"}
            </button>
            <button onClick={() => readinessQ.refetch()} style={{ ...smallBtn, height: 30, background: "#f1f5f9", color: "#475569" }}>🔄 تحديث الفحص</button>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. إعدادات البيئة
// ══════════════════════════════════════════════════════════════════════════════
function EnvSection() {
  const utils = trpc.useUtils();
  const cfgQ  = trpc.zatca.getConfig.useQuery();
  const saveM = trpc.zatca.saveConfig.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات البيئة"); utils.zatca.getConfig.invalidate(); },
    onError:   (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const cfg = { ...(cfgQ.data ?? {}), ...form };
  const isAdmin = cfgQ.data?.isAdmin ?? false;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ maxWidth: 680 }}>
      <SecTitle icon="🌐" title="إعدادات البيئة" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {(["simulation"] as const).map(env => (
          <div key={env} onClick={() => isAdmin && (
            env === "simulation"
              ? setForm(f => ({ ...f, environment: env, apiBaseUrl: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation" }))
              : set("environment", env)
          )}
            style={{ borderRadius: 10, padding: "16px 18px", border: `2px solid ${cfg.environment === env ? "#D19C05" : "#e2e8f0"}`, background: cfg.environment === env ? "#fef3c7" : "#fff", cursor: isAdmin ? "pointer" : "default", transition: "all 0.15s" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🌐</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: cfg.environment === env ? "#D19C05" : "#374151" }}>
              المحاكاة الرسمية للهيئة
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              مرحلة الاعتماد الرسمية قبل التفعيل في الإنتاج
            </div>
            {cfg.environment === env && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D19C05" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D19C05" }}>البيئة الحالية</span>
              </div>
            )}
          </div>
        ))}
        <div style={{ borderRadius: 10, padding: "16px 18px", border: "2px solid #fecaca", background: "#fff7f7", opacity: 0.8 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⛔</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#b91c1c" }}>Production محجوبة</div>
          <div style={{ fontSize: 11, color: "#7f1d1d", marginTop: 4, lineHeight: 1.6 }}>
            لا يُسمح بحفظ CSID أو Secret أو الاتصال الفعلي قبل تأمين النشر واعتماد SDK وFatoora Simulation.
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#92400e", marginBottom: 14 }}>
            ⚠️ تغيير البيئة من إنتاج إلى اختبار سيوقف إرسال الفواتير الحقيقية.
          </div>
          <div style={grp}>
            <label style={lbl}>API Base URL</label>
            <input style={{ ...fld, direction: "ltr", fontFamily: "monospace", fontSize: 11 }}
              value={(cfg as any).apiBaseUrl ?? ""} onChange={e => set("apiBaseUrl", e.target.value)}
              placeholder="https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal" />
          </div>
          <div style={grp}>
            <label style={lbl}>إصدار API</label>
            <select style={{ ...fld, width: 130 }} value={(cfg as any).apiVersion ?? "V2"} onChange={e => set("apiVersion", e.target.value)}>
              <option value="V2">V2 (الإصدار الحالي)</option>
              <option value="V1">V1 (قديم)</option>
            </select>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🔗 روابط API المرحلة الثانية</div>
            {[
              { label: "OAuth URL",     value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/oauth/token" },
              { label: "Compliance",    value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance" },
              { label: "Reporting",     value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single" },
              { label: "Clearance",     value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single" },
            ].map(u => (
              <div key={u.label} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11, marginBottom: 4 }}>
                <span style={{ width: 90, fontWeight: 600, color: "#6b7280", flexShrink: 0 }}>{u.label}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#374151" }}>{u.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => saveM.mutate(cfg as any)} disabled={saveM.isPending}
              style={{ height: 34, padding: "0 22px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {saveM.isPending ? "جارٍ الحفظ..." : "💾 حفظ إعدادات البيئة"}
            </button>
            <button onClick={() => setForm({})} style={{ height: 34, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>تراجع</button>
          </div>
        </>
      )}
      {!isAdmin && <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#6b7280", border: "1px solid #e2e8f0" }}>🔒 تغيير إعدادات البيئة متاح لمسؤول ZATCA فقط.</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2b. وحدات الربط ودفاترها — إدارة داخل مركز ZATCA فقط
// ══════════════════════════════════════════════════════════════════════════════
function LinkingUnitsSection({ onActivate }: { onActivate?: () => void }) {
  const utils = trpc.useUtils();
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const journalsQ = trpc.zatca.listLinkingJournalOptions.useQuery();
  const [form, setForm] = useState({ journalId: "", unitCode: "", unitName: "" });
  const [linkingUnitId, setLinkingUnitId] = useState<number | null>(null);

  const createM = trpc.zatca.createPosUnit.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء وحدة الربط وربط الدفتر الأول");
      setForm({ journalId: "", unitCode: "", unitName: "" });
      utils.zatca.listPosUnits.invalidate();
      utils.zatca.listLinkingJournalOptions.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const linkM = trpc.zatca.linkJournalToPosUnit.useMutation({
    onSuccess: () => {
      toast.success("تم ربط الدفتر بوحدة ZATCA");
      setLinkingUnitId(null);
      utils.zatca.listPosUnits.invalidate();
      utils.zatca.listLinkingJournalOptions.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const unlinkM = trpc.zatca.unlinkJournalFromPosUnit.useMutation({
    onSuccess: () => {
      toast.success("تم فك ربط الدفتر دون حذف بيانات ZATCA");
      utils.zatca.listPosUnits.invalidate();
      utils.zatca.listLinkingJournalOptions.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const journals = journalsQ.data ?? [];
  const selected = journals.find(j => j.id === Number(form.journalId));
  const unlinked = journals.filter(j => j.zatcaPosUnitId == null);
  const sameLocation = selected
    ? unlinked.filter(j => j.warehouseId === selected.warehouseId && j.id !== selected.id)
    : [];
  const selectedLocationJournals = selected
    ? journals.filter(j => j.warehouseId === selected.warehouseId)
    : [];
  const requiredJournalTypes = ["sales_invoice", "sales_return", "credit_note", "debit_note"];
  const missingJournalTypes = requiredJournalTypes.filter(type =>
    !selectedLocationJournals.some(j => j.docType === type)
  );
  const canCreate = Boolean(
    form.journalId
    && selected
    && form.unitCode.trim()
    && form.unitName.trim()
    && missingJournalTypes.length === 0
  );
  const busy = createM.isPending || linkM.isPending || unlinkM.isPending;

  return (
    <div>
      <SecTitle icon="🧩" title="وحدات الربط والدفاتر" />
      <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
        أنشئ وحدة ربط من أحد دفاتر المبيعات، وسيقوم OneSoft بتحديد المخزن وتجميع الدفاتر المرتبطة وإعداد الربط الفني تلقائيًا.
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>＋ إنشاء وحدة ربط جديدة</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.4fr) 1fr 1fr", gap: 8, alignItems: "end" }}>
          <div>
            <label style={lbl}>دفتر فاتورة مبيعات *</label>
            <select style={fld} value={form.journalId} onChange={e => {
              const next = journals.find(j => j.id === Number(e.target.value));
              setForm(f => ({
                ...f,
                journalId: e.target.value,
                unitCode: next ? `EGS-${String(next.id).padStart(3, "0")}` : "",
                unitName: next ? `وحدة ربط – ${next.warehouseName ?? "المخزن الرئيسي"} – نقطة إصدار 1` : "",
              }));
            }}>
              <option value="">اختر دفترًا غير مرتبط</option>
              {unlinked.map(j => <option key={j.id} value={j.id}>{j.code} — {j.name} — {journalTypeLabel(j.docType)}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>رمز وحدة الربط (قابل للتعديل) *</label>
            <input style={fld} value={form.unitCode} onChange={e => setForm(f => ({ ...f, unitCode: e.target.value }))} placeholder="POS-01" />
          </div>
          <div>
            <label style={lbl}>اسم الوحدة *</label>
            <input style={fld} value={form.unitName} onChange={e => setForm(f => ({ ...f, unitName: e.target.value }))} placeholder="وحدة ربط – المخزن الرئيسي – كاشير 1" />
          </div>
        </div>
        {selected && (
          <div style={{ marginTop: 12, border: "1px solid #c7d2fe", background: "#f8faff", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: "#3730a3", marginBottom: 8 }}>مراجعة بيانات وحدة الربط</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
              {[
                ["الدفتر المحدد", `${selected.code} — ${selected.name}`],
                ["نوع المستند", journalTypeLabel(selected.docType)],
                ["المخزن/الفرع المستنتج", locationLabel(selected)],
                ["حالة الدفتر", selected.zatcaPosUnitId ? "مرتبط" : "غير مرتبط"],
                ["دفاتر مؤهلة إضافية", String(sameLocation.length)],
                ["سياسة المخزن", "يُحدد من الدفتر تلقائيًا"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#fff", borderRadius: 6, padding: "7px 9px", border: "1px solid #e5e7eb" }}>
                  <div style={{ color: "#64748b", fontSize: 10 }}>{label}</div>
                  <strong style={{ fontSize: 11 }}>{value}</strong>
                </div>
              ))}
            </div>
            {sameLocation.length > 0 && (
              <div style={{ marginTop: 8, color: "#475569", fontSize: 11 }}>
                دفاتر أخرى في نفس الموقع: {sameLocation.map(j => `${j.code} — ${journalTypeLabel(j.docType)}`).join("، ")}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 12, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>تحقق الدفاتر الأربعة قبل إنشاء الوحدة</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
            {requiredJournalTypes.map(type => {
              const found = selectedLocationJournals.find(j => j.docType === type);
              return (
                <div key={type} style={{
                  padding: "7px 9px", borderRadius: 6,
                  background: found ? "#f0fdf4" : "#fff7ed",
                  border: `1px solid ${found ? "#bbf7d0" : "#fed7aa"}`,
                  color: found ? "#166534" : "#9a3412", fontSize: 11,
                }}>
                  {found ? "✓" : "!"} {journalTypeLabel(type)}
                  {found && <span style={{ display: "block", color: "#64748b", fontSize: 10, marginTop: 2 }}>{found.code} — {found.name}</span>}
                </div>
              );
            })}
          </div>
          {selected && missingJournalTypes.length > 0 && (
            <div style={{ marginTop: 8, color: "#9a3412", fontSize: 11 }}>
              لا يمكن إنشاء وحدة الربط قبل ظهور: {missingJournalTypes.map(journalTypeLabel).join("، ")}.
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 12 }}>
          <button disabled={!canCreate || busy} onClick={() => createM.mutate({ journalId: Number(form.journalId), unitCode: form.unitCode.trim(), unitName: form.unitName.trim() })}
            style={{ ...smallBtn, height: 32, padding: "0 18px", background: canCreate && !busy ? "#D19C05" : "#cbd5e1", color: "#fff", cursor: canCreate && !busy ? "pointer" : "not-allowed", fontSize: 12 }}>
            {createM.isPending ? "جارٍ الإنشاء..." : "إنشاء وحدة الربط"}
          </button>
        </div>
        {!journalsQ.isLoading && unlinked.length === 0 && <div style={{ marginTop: 8, color: "#9ca3af", fontSize: 11 }}>لا توجد دفاتر مؤهلة غير مرتبطة.</div>}
      </div>

      {unitsQ.isLoading ? <Skeleton height={80} /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {(unitsQ.data ?? []).map(unit => (
            <div key={unit.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🧩</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{unit.unitName} <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>({unit.unitCode})</span></div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>
                    المخزن/الفرع: {unit.branchName ? `${unit.branchName} — ` : ""}{unit.warehouseName ?? "—"}
                  </div>
                </div>
                <StatusBadge status={unit.environmentStatuses?.simulation?.registrationStatus ?? "pending"} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 10 }}>
                <div style={{ background: "#eff6ff", borderRadius: 6, padding: "9px 10px", fontSize: 10, border: "1px solid #bfdbfe" }}>
                  <div style={{ color: "#1d4ed8", fontWeight: 800, marginBottom: 5 }}>الاختبار التجريبي</div>
                  <strong style={{ color: unit.environmentStatuses?.simulation ? "#166534" : "#64748b" }}>
                    {unit.environmentStatuses?.simulation?.registrationStatus === "operational" ? "✓ مكتمل" : unit.environmentStatuses?.simulation ? "مهيأة" : "○ غير مفعّل"}
                  </strong>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    {unit.environmentStatuses?.simulation?.certificatePresent ? "الشهادة موجودة" : "لا توجد شهادة"}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    المطابقة: {unit.environmentCompliance?.simulation?.length
                      ? `${unit.environmentCompliance.simulation.filter((test: any) => test.status === "passed" || test.status === "passed_with_warnings" || test.status === "completed_previously").length}/${unit.environmentCompliance.simulation.length} مكتملة`
                      : "لا توجد نتائج"}
                  </div>
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "9px 10px", fontSize: 10, border: "1px solid #bbf7d0" }}>
                  <div style={{ color: "#15803d", fontWeight: 800, marginBottom: 5 }}>الربط الفعلي</div>
                  <strong style={{ color: unit.environmentStatuses?.production ? "#166534" : "#64748b" }}>
                    {unit.environmentStatuses?.production?.registrationStatus === "operational" ? "✓ مفعّل" : "○ غير مفعّل"}
                  </strong>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    {unit.environmentStatuses?.production?.certificatePresent ? "الشهادة موجودة" : "لم يبدأ"}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    المطابقة: {unit.environmentCompliance?.production?.length
                      ? `${unit.environmentCompliance.production.filter((test: any) => test.status === "passed" || test.status === "passed_with_warnings" || test.status === "completed_previously").length}/${unit.environmentCompliance.production.length} مكتملة`
                      : "لا توجد نتائج"}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>الدفاتر المرتبطة ({unit.journals.length})</div>
              {unit.journals.length === 0 && <div style={{ color: "#9ca3af", fontSize: 11, marginBottom: 8 }}>لا توجد دفاتر مرتبطة.</div>}
              {unit.journals.map(journal => (
                <div key={journal.journalId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderTop: "1px solid #f1f5f9", fontSize: 11 }}>
                  <span style={{ flex: 1 }}><strong>{journal.journalCode}</strong> — {journal.journalName} <span style={{ color: "#9ca3af" }}>({journalTypeLabel(journal.docType)})</span></span>
                  <button disabled={busy} onClick={() => unlinkM.mutate({ journalId: journal.journalId })} style={{ ...smallBtn, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", cursor: busy ? "not-allowed" : "pointer" }}>فك الربط</button>
                </div>
              ))}
              {linkingUnitId === unit.id ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <select style={{ ...fld, flex: 1 }} defaultValue="" onChange={e => {
                    const journalId = Number(e.target.value);
                    if (journalId) linkM.mutate({ posUnitId: unit.id, journalId });
                  }}>
                    <option value="">اختر دفترًا لإضافته</option>
                    {unlinked.filter(j => j.warehouseId === unit.warehouseId).map(j => <option key={j.id} value={j.id}>{j.code} — {j.name} — {journalTypeLabel(j.docType)}</option>)}
                  </select>
                  <button onClick={() => setLinkingUnitId(null)} style={{ ...smallBtn, background: "#f1f5f9", color: "#475569" }}>إلغاء</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <button onClick={() => setLinkingUnitId(unit.id)} disabled={busy} style={{ ...smallBtn, background: "#eff6ff", color: "#1d4ed8", cursor: busy ? "not-allowed" : "pointer" }}>إدارة الدفاتر</button>
                  <button onClick={() => onActivate?.()} style={{ ...smallBtn, background: "#fef3c7", color: "#92400e" }}>فتح التفعيل</button>
                  <button onClick={() => toast.info(`تفاصيل وحدة الربط: ${unit.unitName}`)} style={{ ...smallBtn, background: "#f1f5f9", color: "#475569" }}>التفاصيل</button>
                </div>
              )}
            </div>
          ))}
          {!unitsQ.isLoading && (unitsQ.data ?? []).length === 0 && <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 24, textAlign: "center", color: "#64748b", fontSize: 12 }}>لم يتم إنشاء وحدات ربط بعد. ابدأ باختيار دفتر فاتورة مبيعات تابع لنقطة الإصدار.</div>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2c. تفعيل Fatoora Simulation — OTP مؤقت ولا يُحفظ
// ══════════════════════════════════════════════════════════════════════════════
function OtpSimulationSection({
  initialPosUnitId = null,
  allowOperational = false,
}: {
  initialPosUnitId?: number | null;
  allowOperational?: boolean;
} = {}) {
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const utils = trpc.useUtils();
  const [posUnitId, setPosUnitId] = useState<number | null>(initialPosUnitId);
  const [csrRequestId, setCsrRequestId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [result, setResult] = useState<any>(null);
  const [csrStatus, setCsrStatus] = useState<any>(null);
  const [activationPhase, setActivationPhase] = useState<
    "idle" | "security" | "compliance" | "ready" | "error"
  >("idle");

  const statusQ = trpc.zatca.getSimulationOnboardingStatus.useQuery(
    { posUnitId: posUnitId ?? 0 },
    { enabled: !!posUnitId },
  );
  const complianceM = trpc.zatca.requestSimulationComplianceCsid.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setOtp("");
      setActivationPhase(data.ok ? "ready" : "error");
      utils.zatca.getConfig.invalidate();
      statusQ.refetch();
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    },
    onError: (error) => {
      setActivationPhase("error");
      toast.error(error.message);
    },
  });
  const createCsrM = trpc.zatca.createSimulationCsr.useMutation({
    onSuccess: (data, variables) => {
      setCsrStatus(data);
      setCsrRequestId(data.csrRequestId);
      setResult(null);
      setActivationPhase("compliance");
      statusQ.refetch();
      toast.success("تم إنشاء المفتاح وCSR — جارٍ إرسال طلب Compliance باستخدام OTP");
      complianceM.mutate({
        posUnitId: data.posUnitId,
        csrRequestId: data.csrRequestId,
        otp: variables.otp,
      });
    },
    onError: (error) => {
      setActivationPhase("error");
      toast.error(error.message);
    },
  });
  const operationalM = trpc.zatca.requestSimulationOperationalCsid.useMutation({
    onSuccess: (data) => {
      setResult(data);
      statusQ.refetch();
      if (data.ok) toast.success(data.message);
      else toast.error(data.message);
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedUnit = (unitsQ.data ?? []).find(unit => unit.id === posUnitId);
  const hasCsr = !!(csrStatus?.csrRequestId || statusQ.data?.csr?.id);
  const hasComplianceCsid = !!statusQ.data?.csid?.id;
  const operationalReady = !!statusQ.data?.operationalReady;
  const isActivating = createCsrM.isPending || complianceM.isPending;
  const activationProgress = [
    { id: "security", label: "جاري إنشاء بيانات أمان الوحدة", done: hasCsr || hasComplianceCsid },
    { id: "compliance", label: "جاري إرسال طلب التهيئة", done: hasComplianceCsid },
    { id: "csid", label: "جاري الحصول على Compliance CSID", done: hasComplianceCsid },
    { id: "ready", label: "تم تجهيز الوحدة لاختبارات المطابقة", done: activationPhase === "ready" },
  ];

  if (allowOperational) {
    return (
      <div style={{ maxWidth: 680 }}>
        <SecTitle icon="🔑" title="طلب CSID التشغيلي" />
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.8, marginBottom: 16 }}>
          لا يُطلب CSID التشغيلي إلا بعد نجاح اختبارات المطابقة الرسمية. يستخدم الخادم Compliance CSID المحفوظ داخليًا، ولا يحتاج هذا الطلب إلى OTP جديد.
        </div>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
          <label style={lbl}>وحدة الربط</label>
          <select
            value={posUnitId ?? ""}
            onChange={e => {
              const value = Number(e.target.value);
              setPosUnitId(value || null);
              setResult(null);
            }}
            style={{ ...fld, maxWidth: 420, marginBottom: 14 }}
          >
            <option value="">اختر وحدة ربط EGS</option>
            {(unitsQ.data ?? []).map(unit => (
              <option key={unit.id} value={unit.id}>
                {unit.unitCode} — {unit.unitName} — {unit.warehouseName ?? "مخزن غير محدد"}
              </option>
            ))}
          </select>
          {posUnitId && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 11, lineHeight: 1.8 }}>
              <div>حالة Compliance CSID: {hasComplianceCsid ? "موجود" : "غير موجود"}</div>
              <div>حالة الجهاز: {statusQ.data?.device?.registrationStatus ?? "لم يبدأ"}</div>
              <div>حالة التشغيل: {operationalReady ? "موجود" : "لم يُطلب بعد"}</div>
            </div>
          )}
          <button
            onClick={() => posUnitId && operationalM.mutate({ posUnitId, csrRequestId: statusQ.data?.csr?.id })}
            disabled={!posUnitId || !hasComplianceCsid || operationalReady || operationalM.isPending}
            style={{ ...smallBtn, height: 30, background: posUnitId && hasComplianceCsid && !operationalReady ? "#7c3aed" : "#cbd5e1", color: "#fff", cursor: posUnitId && hasComplianceCsid && !operationalReady ? "pointer" : "not-allowed" }}
          >
            {operationalM.isPending ? "جارٍ طلب CSID التشغيلي..." : operationalReady ? "✅ CSID التشغيلي موجود" : "طلب CSID التشغيلي"}
          </button>
          {result && (
            <div style={{ marginTop: 14, background: result.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.ok ? "#86efac" : "#fecaca"}`, borderRadius: 8, padding: 12, fontSize: 11, lineHeight: 1.8 }}>
              <strong>{result.ok ? "✅ تم استلام الرد الرسمي" : "❌ لم يكتمل طلب CSID التشغيلي"}</strong>
              <div>Request ID: <span style={{ fontFamily: "monospace" }}>{result.requestId ?? "—"}</span></div>
              <div>HTTP Status: <span style={{ fontFamily: "monospace" }}>{result.httpStatus ?? "لا يوجد رد"}</span></div>
              <div>{result.message}</div>
              <div style={{ color: "#64748b" }}>لم يتم عرض أو حفظ أي Secret أو Private Key في هذه الشاشة.</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <SecTitle icon="🔐" title="تفعيل وحدة الربط" />
      <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.8, marginBottom: 16 }}>
        <strong>قبل البدء:</strong> افتح منصة Fatoora Simulation، أنشئ OTP صالحًا لهذه الوحدة، ثم أدخله هنا. لا يُحفظ OTP ولا يُعرض أي مفتاح خاص أو Secret في المتصفح.
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 }}>
         <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>وحدة الربط</div>
        <select
          value={posUnitId ?? ""}
          onChange={e => {
            const value = Number(e.target.value);
            setPosUnitId(value || null);
            setCsrRequestId(null);
            setCsrStatus(null);
            setResult(null);
            setActivationPhase("idle");
          }}
          style={{ ...fld, maxWidth: 420, marginBottom: 14 }}
        >
          <option value="">اختر وحدة ربط EGS</option>
          {(unitsQ.data ?? []).map(unit => (
            <option key={unit.id} value={unit.id}>
              {unit.unitCode} — {unit.unitName} — {unit.warehouseName ?? "مخزن غير محدد"}
            </option>
          ))}
        </select>

        {selectedUnit && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 11, lineHeight: 1.8 }}>
            <strong>{selectedUnit.unitName}</strong>
            <div>الدفاتر المرتبطة: {selectedUnit.journals.length} — الاعتماد واحد لكل دفاتر هذه الوحدة.</div>
          </div>
        )}

         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
           <div style={{ fontWeight: 800, fontSize: 13 }}>رمز OTP</div>
           <a href="https://fatoora.zatca.gov.sa/" target="_blank" rel="noreferrer" style={{ fontSize: 10 }}>فتح منصة المحاكاة الرسمية ↗</a>
         </div>
        <p style={{ color: "#64748b", fontSize: 11, lineHeight: 1.7, marginTop: 0 }}>
           افتح بوابة Fatoora Simulation، أنشئ OTP لوحدة EGS، ثم أدخله هنا. لا يُحفظ OTP ولا يظهر في السجلات.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\s/g, "").slice(0, 64))}
            autoComplete="one-time-code"
            placeholder="OTP من Fatoora Simulation"
            style={{ ...fld, width: 250, direction: "ltr", fontFamily: "monospace", letterSpacing: 1 }}
          />
           <span style={{ fontSize: 10, color: otp ? "#166534" : "#9a3412" }}>
             {otp ? "OTP مُدخل" : "OTP مطلوب قبل إنشاء CSR"}
           </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "#64748b" }}>
          أدخل OTP الذي تولده المنصة خلال ساعة من إنشائه.
        </div>
        {isActivating && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 11, margin: "12px 0" }}>
            <div style={{ height: 5, background: "#dbeafe", borderRadius: 5, overflow: "hidden", marginBottom: 10 }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(12, (activationProgress.filter(item => item.done).length / activationProgress.length) * 100)}%`,
                  background: "#2563eb",
                  borderRadius: 5,
                  transition: "width .25s ease",
                }}
              />
            </div>
            {activationProgress.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: item.done ? "#166534" : "#1e40af", marginBottom: 5 }}>
                <span>{item.done ? "✓" : item.id === activationPhase ? "…" : "○"}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
        {hasComplianceCsid && !isActivating && activationPhase !== "error" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 8, padding: 10, margin: "12px 0", fontSize: 11, fontWeight: 700 }}>
            ✅ تم تجهيز الوحدة لاختبارات المطابقة
          </div>
        )}
         <button
           disabled={!posUnitId || !otp || isActivating || hasComplianceCsid}
           onClick={() => {
             if (!posUnitId || !otp) return;
             setActivationPhase("security");
             createCsrM.mutate({
               posUnitId,
               otp,
               serialNumber: selectedUnit?.unitCode ?? `EGS-${posUnitId}`,
               solutionName: "OneSoft",
               model: "ERP",
               branchName: selectedUnit?.branchName ?? selectedUnit?.warehouseName ?? "OneSoft",
               branchLocation: selectedUnit?.warehouseName ?? "Saudi Arabia",
               businessCategory: "Retail and invoicing",
               taxpayerProvidedId: selectedUnit?.unitCode ?? `OneSoft-${posUnitId}`,
             });
           }}
           style={{ ...smallBtn, height: 36, width: "100%", background: posUnitId && otp && !hasComplianceCsid ? "#D19C05" : "#cbd5e1", color: "#fff", cursor: posUnitId && otp && !hasComplianceCsid ? "pointer" : "not-allowed" }}
         >
           {createCsrM.isPending ? "جاري إنشاء بيانات أمان الوحدة..." : complianceM.isPending ? "جاري الحصول على Compliance CSID..." : hasComplianceCsid ? "✅ الوحدة مفعّلة للمطابقة" : "تفعيل الوحدة"}
         </button>
         <details style={{ marginTop: 14, color: "#475569", fontSize: 10 }}>
           <summary style={{ cursor: "pointer", fontWeight: 700 }}>التفاصيل الفنية</summary>
           <div style={{ marginTop: 8, lineHeight: 1.8 }}>
             <div>EC Key وCSR: {hasCsr ? "تم إنشاؤهما داخليًا" : "لم يُنشآ بعد"}</div>
             <div>Compliance CSID: {hasComplianceCsid ? "تم حفظه مشفرًا على الخادم" : "لم يُستلم بعد"}</div>
             {result && (
               <div style={{ marginTop: 8, background: result.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.ok ? "#86efac" : "#fecaca"}`, borderRadius: 6, padding: 8 }}>
                 <strong>{result.ok ? "تم استلام الرد الرسمي" : "لم يكتمل طلب Compliance CSID"}</strong>
                 <div>Request ID: <span style={{ fontFamily: "monospace" }}>{result.requestId ?? "—"}</span></div>
                 <div>HTTP Status: <span style={{ fontFamily: "monospace" }}>{result.httpStatus ?? "لا يوجد رد"}</span></div>
                 <div>{result.message}</div>
               </div>
             )}
           </div>
         </details>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. إدارة الأجهزة (EGS) — محسّنة
// ══════════════════════════════════════════════════════════════════════════════
function DevicesSection() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name: "", serialNumber: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mockDevices = [
    {
      id: 1, name: "جهاز الفوترة الرئيسي", uuid: "a3f2-8e91-4b7c-e9c1",
      deviceId: "—", serial: "EGS-001-2024", csid: "لم يُعيَّن",
      status: "pending", lastConn: null, lastSend: null, lastResponse: "—",
      branch: "الفرع الرئيسي", regDate: null,
      lastUser: "—", invoiceCount: 0, successRate: 0,
    },
  ];

  const statusDot = (s: string): "ok"|"warn"|"error"|"none" =>
    s === "active" ? "ok" : s === "error" ? "error" : s === "pending" ? "warn" : "none";
  const statusLabel: Record<string, string> = { active: "✅ مسجّل ونشط", pending: "⏳ في انتظار التسجيل", error: "❌ خطأ في التسجيل", inactive: "⚫ غير نشط" };

  return (
    <div>
      <SecTitle icon="💻" title="إدارة الأجهزة (EGS)" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>أجهزة الفوترة الإلكترونية — Mock فقط، لا تسجيل لدى الهيئة</div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ height: 32, padding: "0 16px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          ＋ إضافة جهاز
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#D19C05" }}>➕ إضافة جهاز فوترة جديد</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>اسم الجهاز *</label>
              <input style={fld} value={form.name} onChange={e => set("name", e.target.value)} placeholder="مثال: جهاز الفوترة 01" />
            </div>
            <div>
              <label style={lbl}>الرقم التسلسلي</label>
              <input style={{ ...fld, direction: "ltr", fontFamily: "monospace" }} value={form.serialNumber} onChange={e => set("serialNumber", e.target.value)} placeholder="EGS-XXX-XXXX" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { toast.info("إضافة الجهاز — قريباً"); setShowAdd(false); }}
              style={{ height: 30, padding: "0 16px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>حفظ</button>
            <button onClick={() => setShowAdd(false)} style={{ height: 30, padding: "0 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>إلغاء</button>
          </div>
        </div>
      )}

      {mockDevices.map(dev => (
        <div key={dev.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "16px 18px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💻</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>{dev.name}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{dev.branch}</div>
            </div>
            <StatusDot status={statusDot(dev.status)} />
            <span style={{ fontSize: 12, fontWeight: 700, color: dev.status === "active" ? "#16a34a" : dev.status === "error" ? "#dc2626" : "#d97706" }}>
              {statusLabel[dev.status] ?? dev.status}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "UUID",              value: dev.uuid,              mono: true },
              { label: "الرقم التسلسلي",    value: dev.serial,            mono: true },
              { label: "Device ID",         value: dev.deviceId,          mono: true },
              { label: "CSID",              value: dev.csid,              mono: false },
              { label: "تاريخ التسجيل",     value: dev.regDate ?? "—",   mono: false },
              { label: "آخر اتصال",         value: dev.lastConn ?? "—",  mono: false },
              { label: "آخر إرسال",         value: dev.lastSend ?? "—",  mono: false },
              { label: "آخر استجابة ZATCA", value: dev.lastResponse,      mono: false },
            ].map(f => (
              <div key={f.label} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", fontFamily: f.mono ? "monospace" : "inherit" }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* إحصائيات الجهاز */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 12px", border: "1px solid #bbf7d0", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{dev.invoiceCount}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>فواتير مرسلة</div>
            </div>
            <div style={{ background: dev.successRate > 80 ? "#f0fdf4" : dev.successRate > 0 ? "#fffbeb" : "#f8fafc", borderRadius: 8, padding: "10px 12px", border: `1px solid ${dev.successRate > 80 ? "#bbf7d0" : dev.successRate > 0 ? "#fde68a" : "#e2e8f0"}`, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: dev.successRate > 80 ? "#16a34a" : dev.successRate > 0 ? "#d97706" : "#9ca3af" }}>{dev.invoiceCount > 0 ? `${dev.successRate}%` : "—"}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>معدل النجاح</div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{dev.lastUser}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>آخر مستخدم</div>
            </div>
          </div>

          {/* أزرار العمليات */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button title="تسجيل الجهاز في منظومة ZATCA" onClick={() => toast.info("تسجيل الجهاز — قريباً")}
              style={{ height: 30, padding: "0 14px", background: "#D19C05", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
              📱 تسجيل الجهاز
            </button>
            <button title="اختبار الاتصال بين الجهاز وخوادم ZATCA" onClick={() => toast.info("جارٍ اختبار الاتصال...")}
              style={{ height: 30, padding: "0 14px", background: "#0ea5e9", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
              🔌 اختبار الجهاز
            </button>
            <button title="مزامنة Mock فقط — لا اتصال بالهيئة" onClick={() => toast.info("Mock فقط — لا يوجد اتصال خارجي")}
              style={{ height: 30, padding: "0 14px", background: "#8b5cf6", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
              🔄 مزامنة
            </button>
            <button title="إعادة تسجيل الجهاز من البداية" onClick={() => toast.info("إعادة التسجيل — قريباً")}
              style={{ height: 30, padding: "0 14px", background: "#f8fafc", border: "1px solid #6b7280", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#6b7280" }}>
              ↩ إعادة التسجيل
            </button>
            <button title="حذف الجهاز نهائياً" onClick={() => toast.error("حذف الجهاز — تأكيد مطلوب")}
              style={{ height: 30, padding: "0 14px", background: "transparent", border: "1px solid #dc2626", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626", marginRight: "auto" }}>
              🗑 حذف
            </button>
          </div>
        </div>
      ))}

      <div style={{ background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: 10, padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
        ＋ أضف جهاز فوترة جديداً عبر الزر أعلاه
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. إدارة الشهادات — محسّنة بالكامل مع تفاصيل كاملة
// ══════════════════════════════════════════════════════════════════════════════
function CertsSection() {
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const cfg  = cfgQ.data;
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const certUnitId = unitsQ.data?.[0]?.id ?? null;
  const onboardingQ = trpc.zatca.getSimulationOnboardingStatus.useQuery(
    { posUnitId: certUnitId ?? 0 },
    { enabled: Boolean(certUnitId) },
  );
  const complianceCsidPresent = Boolean(onboardingQ.data?.complianceCsidPresent);
  const operationalCsidPresent = Boolean(onboardingQ.data?.operationalCsidPresent);
  const anyCsidPresent = complianceCsidPresent || operationalCsidPresent;

  const certDays = cfg?.certExpiryDate ? Math.ceil((new Date(cfg.certExpiryDate).getTime() - Date.now()) / 86400000) : null;
  const certDot: "ok"|"warn"|"error"|"none" = certDays === null ? "none" : certDays <= 0 ? "error" : certDays <= 30 ? "warn" : "ok";

  const certItems = [
    {
      label: "CSR (طلب التوقيع)", icon: "📜", desc: "Certificate Signing Request — طلب الشهادة المُوقَّع",
      status: "pending", date: null, issuer: "—",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "ECDSA-SHA256", validFrom: "—", validTo: "—" },
    },
    {
      label: "Private Key", icon: "🔐", desc: "المفتاح الخاص EC secp256k1 — مشفّر في قاعدة البيانات",
      status: "pending", date: null, issuer: "—",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "EC secp256k1", validFrom: "—", validTo: "—" },
    },
    {
      label: "Public Certificate", icon: "📋", desc: "الشهادة العامة الصادرة من هيئة الزكاة",
      status: anyCsidPresent ? "active" : "missing",
      date: cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : null, issuer: "ZATCA CA",
      details: {
        fingerprint:        anyCsidPresent ? "SHA-256: xx:xx:...(مشفّر)" : "—",
        subject:            cfg?.legalName ? `CN=${cfg.legalName}, O=${cfg.legalName}, C=SA` : "—",
        serialNumber:       anyCsidPresent ? "0x1A2B3C (مثال)" : "—",
        signatureAlgorithm: "SHA256WithECDSA",
        validFrom:          "—",
        validTo:            cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—",
      },
    },
    {
      label: "Compliance CSID", icon: "🔑", desc: "معرّف شهادة المطابقة — صادر من Fatoora Simulation",
      status: complianceCsidPresent ? "active" : "missing", date: null, issuer: "ZATCA",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "—", validFrom: "—", validTo: "—" },
    },
    {
      label: "Operational CSID", icon: "🚀", desc: "معرّف الشهادة التشغيلية — لا يُطلب قبل نجاح المطابقة الرسمية",
      status: operationalCsidPresent ? "active" : "pending", date: null, issuer: "ZATCA",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "—", validFrom: "—", validTo: "—" },
    },
    {
      label: "Secret Key", icon: "🗝️", desc: "المفتاح السري للتوثيق — مشفّر AES-256-GCM",
      status: anyCsidPresent ? "active" : "missing", date: null, issuer: "ZATCA",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "AES-256-GCM", validFrom: "—", validTo: "—" },
    },
  ];

  const sColor = (s: string) => s === "active" ? "#16a34a" : s === "missing" ? "#dc2626" : "#d97706";
  const sLabel = (s: string) => s === "active" ? "✅ موجود" : s === "missing" ? "❌ مفقود" : "⏳ قيد الإعداد";
  const sDot   = (s: string): "ok"|"warn"|"error"|"none" => s === "active" ? "ok" : s === "missing" ? "error" : "warn";

  return (
    <div>
      <SecTitle icon="🛡️" title="إدارة الشهادات" />

      {/* حالة الشهادة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatusCard label="حالة الشهادة"        value={anyCsidPresent ? "صالحة ✓" : "غير موجودة"} dot={anyCsidPresent ? "ok" : "none"} sub={anyCsidPresent ? "شهادة X.509 من ZATCA" : "أنشئ CSR وسجّل الجهاز"} />
        <StatusCard label="تاريخ الانتهاء"       value={cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—"} dot={certDot} sub={certDays !== null ? (certDays > 0 ? `${certDays} يوم متبقٍ` : "منتهية — تجديد فوري!") : "لم تُحدَّد"} />
        <StatusCard label="الجهة المصدرة / النوع" value={anyCsidPresent ? "ZATCA CA" : "—"} dot={anyCsidPresent ? "ok" : "none"} sub={operationalCsidPresent ? "Operational CSID" : complianceCsidPresent ? "Compliance CSID" : "—"} />
      </div>

      {certDot === "warn" && (
        <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          ⚠️ <span style={{ color: "#92400e", fontSize: 12, fontWeight: 700 }}>تنتهي الشهادة خلال {certDays} يوم — يُرجى التخطيط للتجديد</span>
        </div>
      )}

      {/* جدول الشهادات مع التفاصيل القابلة للتوسيع */}
      <div style={{ marginBottom: 16 }}>
        {certItems.map(item => (
          <div key={item.label} style={{ marginBottom: 8, border: `1px solid ${sDot(item.status) === "ok" ? "#bbf7d0" : sDot(item.status) === "error" ? "#fecaca" : "#e2e8f0"}`, borderRadius: 8, overflow: "hidden" }}>
            {/* رأس الصف */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", background: "#fff", cursor: "pointer" }} onClick={() => setExpandedItem(expandedItem === item.label ? null : item.label)}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{item.desc}</div>
                {item.date && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>ينتهي: {item.date} • الجهة: {item.issuer}</div>}
              </div>
              <StatusDot status={sDot(item.status)} />
              <span style={{ fontSize: 12, fontWeight: 700, color: sColor(item.status), minWidth: 80, textAlign: "center" }}>{sLabel(item.status)}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button title="تنزيل الشهادة" onClick={e => { e.stopPropagation(); toast.info("تنزيل — قريباً"); }} disabled={item.status !== "active"}
                  style={{ height: 24, padding: "0 8px", background: "#f0fdf4", border: "1px solid #16a34a", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: item.status === "active" ? "pointer" : "not-allowed", color: "#16a34a", opacity: item.status === "active" ? 1 : 0.4 }}>📥</button>
                <button title="استبدال الشهادة" onClick={e => { e.stopPropagation(); toast.info("استبدال — قريباً"); }} disabled={item.status !== "active"}
                  style={{ height: 24, padding: "0 8px", background: "#fef3c7", border: "1px solid #D19C05", borderRadius: 4, fontSize: 10, cursor: item.status === "active" ? "pointer" : "not-allowed", color: "#D19C05", opacity: item.status === "active" ? 1 : 0.4 }}>🔄</button>
                <button title={expandedItem === item.label ? "إخفاء التفاصيل" : "عرض التفاصيل الكاملة"}
                  onClick={e => { e.stopPropagation(); setExpandedItem(expandedItem === item.label ? null : item.label); }}
                  style={{ height: 24, padding: "0 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 10, cursor: "pointer", color: "#6b7280" }}>
                  {expandedItem === item.label ? "▲" : "👁"}
                </button>
              </div>
            </div>

            {/* تفاصيل الشهادة — قابلة للتوسيع */}
            {expandedItem === item.label && (
              <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#374151", marginBottom: 8 }}>🔍 تفاصيل الشهادة</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {[
                    { label: "Fingerprint",          value: item.details.fingerprint        },
                    { label: "Subject",              value: item.details.subject            },
                    { label: "Issuer",               value: item.issuer                     },
                    { label: "Serial Number",        value: item.details.serialNumber       },
                    { label: "Signature Algorithm",  value: item.details.signatureAlgorithm },
                    { label: "صلاحية من",            value: item.details.validFrom          },
                    { label: "صلاحية حتى",           value: item.details.validTo            },
                    { label: "نوع المفتاح",          value: item.label.includes("Private") || item.label.includes("CSR") ? "EC secp256k1" : item.label.includes("Secret") ? "HMAC" : "X.509 v3" },
                  ].map(f => (
                    <div key={f.label} style={{ background: "#fff", borderRadius: 6, padding: "7px 10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: "#374151", wordBreak: "break-all" }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button title="حذف الشهادة نهائياً" onClick={() => toast.error("حذف الشهادة — تأكيد مطلوب")} disabled={item.status !== "active"}
                    style={{ height: 26, padding: "0 12px", background: "transparent", border: "1px solid #dc2626", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: item.status === "active" ? "pointer" : "not-allowed", color: "#dc2626", opacity: item.status === "active" ? 1 : 0.4 }}>
                    🗑 حذف الشهادة
                  </button>
                  <button title="نسخ محتوى الشهادة" onClick={() => { navigator.clipboard.writeText(item.details.fingerprint); toast.success("تم نسخ البيانات"); }}
                    style={{ height: 26, padding: "0 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, cursor: "pointer", color: "#6b7280" }}>
                    📋 نسخ
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* أزرار العمليات */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {[
          { label: "إنشاء شهادة جديدة", icon: "➕", color: "#D19C05",  bg: "#fef3c7", disabled: false },
          { label: "تجديد الشهادة",      icon: "🔄", color: "#0ea5e9",  bg: "#e0f2fe", disabled: !cfg?.csid },
          { label: "إلغاء الشهادة",      icon: "🚫", color: "#dc2626",  bg: "#fee2e2", disabled: !cfg?.csid },
          { label: "تصدير الشهادة",      icon: "📤", color: "#6b7280",  bg: "#f8fafc", disabled: !cfg?.csid },
          { label: "استيراد شهادة",      icon: "📥", color: "#6b7280",  bg: "#f8fafc", disabled: false },
          { label: "نسخ البيانات",        icon: "📋", color: "#6366f1",  bg: "#f0f0ff", disabled: !cfg?.csid },
        ].map(b => (
          <button key={b.label} title={b.label} disabled={b.disabled} onClick={() => !b.disabled && toast.info(`${b.label} — قريباً`)}
            style={{ height: 40, padding: "0 12px", background: b.disabled ? "#f8fafc" : b.bg, border: `1px solid ${b.disabled ? "#e2e8f0" : b.color}`, borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: b.disabled ? "not-allowed" : "pointer", color: b.disabled ? "#9ca3af" : b.color, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", fontSize: 11, color: "#6b7280" }}>
        💡 انقر على أي صف لرؤية تفاصيله الكاملة (Fingerprint, Subject, Issuer, Serial Number, Signature Algorithm).
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. مفاتيح التشفير — محسّنة
// ══════════════════════════════════════════════════════════════════════════════
function KeysSection() {
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const cfg  = cfgQ.data;
  const [showLog, setShowLog] = useState(false);

  const keyItems = [
    { label: "Private Key (EC secp256k1)", icon: "🔐", desc: "مفتاح التوقيع الخاص — مولَّد محلياً وغير مُصدَّر أبداً", status: cfg?.csid ? "active" : "none", created: "—", rotated: "—", expires: "—" },
    { label: "Public Key",                 icon: "🗝️", desc: "المفتاح العام المُشتَق من الـ Private Key",                status: cfg?.csid ? "active" : "none", created: "—", rotated: "—", expires: "—" },
    { label: "Secret Key (ZATCA)",         icon: "🔑", desc: "مفتاح التوثيق مع الهيئة — يأتي مع CSID",                status: cfg?.csid ? "active" : "none", created: "—", rotated: "—", expires: "—" },
    { label: "Signing Key (AES-256)",      icon: "🛡️", desc: "مفتاح تشفير البيانات الداخلية",                          status: "active",                        created: "—", rotated: "—", expires: "—" },
  ];

  const sDot   = (s: string): "ok"|"warn"|"error"|"none" => s === "active" ? "ok" : s === "warn" ? "warn" : s === "error" ? "error" : "none";
  const sLabel = (s: string) => s === "active" ? "✅ نشط" : s === "warn" ? "⚠️ تجديد قريب" : s === "error" ? "❌ خطأ" : "⚪ غير موجود";

  const auditLog = [
    { date: "—", action: "إنشاء المفاتيح", user: "—", result: "—" },
  ];

  return (
    <div>
      <SecTitle icon="🔐" title="إدارة مفاتيح التشفير" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatusCard label="حالة المفاتيح"     value={cfg?.csid ? "مكتملة" : "غير مُعدَّة"} dot={cfg?.csid ? "ok" : "none"} />
        <StatusCard label="الخوارزمية"         value="EC secp256k1"                          dot="ok" sub="ZATCA Compliant" />
        <StatusCard label="تشفير التخزين"      value="AES-256-GCM"                           dot="ok" sub="مشفّر في DB" />
        <StatusCard label="آخر تدوير"          value="—"                                     dot="none" />
      </div>

      {keyItems.map(k => (
        <div key={k.label} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 24 }}>{k.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{k.desc}</div>
            </div>
            <StatusDot status={sDot(k.status)} />
            <span style={{ fontSize: 12, fontWeight: 700, color: sDot(k.status) === "ok" ? "#16a34a" : "#6b7280", minWidth: 90 }}>{sLabel(k.status)}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => toast.info("تدوير المفتاح — قريباً")} style={{ height: 24, padding: "0 8px", background: "#fef3c7", border: "1px solid #D19C05", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#D19C05" }}>تدوير</button>
              <button onClick={() => toast.info("نسخ احتياطي — قريباً")}  style={{ height: 24, padding: "0 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 10, cursor: "pointer", color: "#6b7280" }}>💾</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
            {[{ label: "تاريخ الإنشاء", value: k.created }, { label: "آخر تدوير", value: k.rotated }, { label: "العمر المتبقي", value: k.expires }].map(f => (
              <div key={f.label} style={{ background: "#f8fafc", borderRadius: 4, padding: "6px 10px" }}>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>{f.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* أزرار */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => toast.info("إنشاء مفاتيح — قريباً")}    style={{ height: 32, padding: "0 16px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>➕ إنشاء مفاتيح جديدة</button>
        <button onClick={() => toast.info("استعادة — قريباً")}           style={{ height: 32, padding: "0 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>📥 استعادة من نسخة احتياطية</button>
        <button onClick={() => setShowLog(!showLog)}                      style={{ height: 32, padding: "0 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>📋 سجل العمليات</button>
      </div>

      {showLog && (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12 }}>📋 سجل عمليات المفاتيح</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f8fafc" }}>
              {["التاريخ", "العملية", "المستخدم", "النتيجة"].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, fontSize: 10 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {auditLog.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.date}</td>
                  <td style={{ padding: "6px 10px" }}>{r.action}</td>
                  <td style={{ padding: "6px 10px" }}>{r.user}</td>
                  <td style={{ padding: "6px 10px" }}>{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. إنشاء CSR
// ══════════════════════════════════════════════════════════════════════════════
function CsrSection() {
  return <OtpSimulationSection />;
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. تسجيل الجهاز
// ══════════════════════════════════════════════════════════════════════════════
function RegisterSection() {
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const cfg  = cfgQ.data;

  const steps = [
    { n: 1, label: "بيانات CSID موجودة",          done: !!cfg?.csid },
    { n: 2, label: "الشهادة العامة مُعيَّنة",      done: !!cfg?.csid },
    { n: 3, label: "Secret Key محفوظ",             done: !!cfg?.csid },
    { n: 4, label: "رابط API الهيئة مُعيَّن",      done: !!cfg?.apiBaseUrl },
    { n: 5, label: "تسجيل الجهاز لدى الهيئة",     done: false },
  ];

  const ready = steps.slice(0, 4).every(s => s.done);

  return (
    <div style={{ maxWidth: 640 }}>
      <SecTitle icon="📱" title="تسجيل الجهاز (EGS) لدى هيئة الزكاة" />

      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 18px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📋 متطلبات التسجيل</div>
        {steps.map(s => (
          <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: s.n < steps.length ? "1px solid #e2e8f0" : "none" }}>
            <span style={{ fontSize: 16 }}>{s.done ? "✅" : "⭕"}</span>
            <span style={{ fontSize: 12, fontWeight: s.done ? 600 : 400, color: s.done ? "#374151" : "#9ca3af" }}>{s.label}</span>
            {!s.done && s.n < 5 && <span style={{ fontSize: 10, color: "#dc2626", marginRight: "auto" }}>مطلوب</span>}
          </div>
        ))}
      </div>

      {!ready && (
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          ⚠️ أكمل متطلبات التسجيل أولاً قبل تسجيل الجهاز.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => toast.info("تسجيل الجهاز — قريباً")} disabled={!ready}
          style={{ height: 36, padding: "0 24px", background: ready ? "#D19C05" : "#f1f5f9", color: ready ? "#fff" : "#9ca3af", border: `1px solid ${ready ? "#D19C05" : "#e2e8f0"}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: ready ? "pointer" : "not-allowed" }}>
          📱 تسجيل الجهاز الآن
        </button>
        <button onClick={() => toast.info("التحقق من التسجيل — قريباً")} style={{ height: 36, padding: "0 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
          🔍 التحقق من التسجيل
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. إدارة CSID
// ══════════════════════════════════════════════════════════════════════════════
function CsidSection() {
  const utils = trpc.useUtils();
  const cfgQ  = trpc.zatca.getConfig.useQuery();
  const saveM = trpc.zatca.saveConfig.useMutation({
    onSuccess: () => { toast.success("تم حفظ بيانات CSID"); utils.zatca.getConfig.invalidate(); },
    onError:   (e) => toast.error(e.message),
  });

  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const cfg  = { ...(cfgQ.data ?? {}), ...form };
  const isAdmin = cfgQ.data?.isAdmin ?? false;
  const set  = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const certDays = cfg.certExpiryDate
    ? Math.ceil((new Date(cfg.certExpiryDate).getTime() - Date.now()) / 86400000)
    : null;

  const certDot: "ok"|"warn"|"error"|"none" = certDays === null ? "none" : certDays <= 0 ? "error" : certDays <= 30 ? "warn" : "ok";

  return (
    <div style={{ maxWidth: 680 }}>
      <SecTitle icon="🔑" title="إدارة CSID وشهادة الاتصال" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        <StatusCard label="حالة CSID"             value={cfg.csid ? (cfg.enabled ? "مُفعَّل ✓" : "غير مُفعَّل") : "غير مُعيَّن"} dot={cfg.csid ? (cfg.enabled ? "ok" : "warn") : "none"} />
        <StatusCard label="تاريخ انتهاء الشهادة"  value={cfg.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—"} dot={certDot} />
        <StatusCard label="الأيام المتبقية"        value={certDays !== null ? (certDays > 0 ? `${certDays} يوم` : "منتهية!") : "—"} dot={certDot} />
      </div>

      {certDays !== null && certDays <= 30 && (
        <div style={{ background: certDays <= 7 ? "#fee2e2" : "#fef3c7", border: `1px solid ${certDays <= 7 ? "#dc2626" : "#d97706"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          {certDays <= 7 ? "🚨" : "⚠️"}
          <span style={{ color: certDays <= 7 ? "#dc2626" : "#92400e", fontSize: 12, fontWeight: 700 }}>
            {certDays <= 0 ? "انتهت صلاحية الشهادة — تجديد فوري مطلوب!" : `تنتهي الشهادة خلال ${certDays} يوم`}
          </span>
        </div>
      )}

      {isAdmin ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 14 }}>
             <div>
               <label style={lbl}>CSID (معرّف الشهادة)</label>
               <textarea disabled style={{ ...fld, height: 70, fontFamily: "monospace", fontSize: 10, direction: "ltr", resize: "vertical", background: "#f8fafc" }}
                 value="" readOnly placeholder="محجوب حتى اعتماد مسار Secrets الرسمي" />
             </div>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <label style={{ ...lbl, margin: 0 }}>Secret Key</label>
                <button onClick={() => setShowKey(!showKey)} style={{ fontSize: 10, padding: "0 8px", height: 18, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 3, cursor: "pointer" }}>
                  {showKey ? "إخفاء" : "إظهار"}
                </button>
              </div>
               <input disabled type={showKey ? "text" : "password"} style={{ ...fld, fontFamily: "monospace", direction: "ltr", background: "#f8fafc" }}
                 value="" readOnly placeholder="محجوب حتى اعتماد مسار Secrets الرسمي" />
               <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>🔒 لا يُخزَّن Secret في النشر العام — استخدم OTP محاكاة فقط</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>رقم تسلسل الشهادة</label>
                <input style={{ ...fld, direction: "ltr", fontFamily: "monospace" }}
                   value="" readOnly disabled placeholder="محجوب حتى اعتماد الشهادة الرسمية" />
              </div>
              <div>
                <label style={lbl}>تاريخ انتهاء الشهادة</label>
                <DateSegmentInput value={cfg.certExpiryDate?.slice(0, 10) ?? ""} onChange={v => set("certExpiryDate", v)} standalone style={fld} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
             <button disabled
               style={{ height: 32, padding: "0 18px", background: "#cbd5e1", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "not-allowed" }}>
               حفظ بيانات الاعتماد — محجوب
             </button>
            <button onClick={() => setForm({})} style={{ height: 32, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>تراجع</button>
            <button disabled style={{ height: 32, padding: "0 14px", background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "not-allowed", color: "#dc2626", opacity: 0.5 }}>🔄 تجديد (قريباً)</button>
          </div>
        </>
      ) : (
        <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#6b7280", border: "1px solid #e2e8f0" }}>
          🔒 إدارة CSID متاحة لمسؤول ZATCA فقط.
          {cfg.csid && <div style={{ marginTop: 6, color: "#374151" }}>الحالة: <strong>CSID مُعيَّن</strong> ✓</div>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. اختبار الاتصال
// ══════════════════════════════════════════════════════════════════════════════
function TestSection() {
  const utils  = trpc.useUtils();
  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const testM  = trpc.zatca.testConnection.useMutation({
    onSuccess: (r) => { r.ok ? toast.success(r.message) : toast.error(r.message); utils.zatca.getConfig.invalidate(); utils.zatca.getStats.invalidate(); },
    onError:   (e) => toast.error(e.message),
  });
  const cfg   = cfgQ.data;
  const isAdmin = cfg?.isAdmin ?? false;

  const checks = [
    { label: "بيانات CSID",           ok: !!cfg?.csid,         dot: !!cfg?.csid ? "ok" as const : "error" as const, desc: cfg?.csid ? "CSID مُعيَّن ✓" : "CSID مفقود" },
    { label: "Secret Key",            ok: !!cfg?.csid,         dot: !!cfg?.csid ? "ok" as const : "error" as const, desc: cfg?.csid ? "موجود ✓" : "مفقود" },
    { label: "رابط API الهيئة",      ok: !!cfg?.apiBaseUrl,   dot: !!cfg?.apiBaseUrl ? "ok" as const : "error" as const, desc: cfg?.apiBaseUrl || "غير محدد" },
    { label: "تفعيل منظومة ZATCA",   ok: !!cfg?.enabled,      dot: !!cfg?.enabled ? "ok" as const : "warn" as const, desc: cfg?.enabled ? "مُفعَّلة ✓" : "غير مُفعَّلة" },
    { label: "الرقم الضريبي (VAT)",  ok: !!cfg?.vatNumber && /^3\d{13}3$/.test(cfg?.vatNumber ?? ""), dot: !!cfg?.vatNumber ? "ok" as const : "error" as const, desc: cfg?.vatNumber || "غير محدد" },
    { label: "اسم المنشأة",          ok: !!cfg?.legalName, dot: !!cfg?.legalName ? "ok" as const : "warn" as const, desc: cfg?.legalName || "غير محدد" },
  ];

  return (
    <div style={{ maxWidth: 620 }}>
      <SecTitle icon="🔌" title="اختبار الاتصال بهيئة الزكاة" />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 8 }}>🔍 فحص المتطلبات</div>
        {checks.map(c => (
          <div key={c.label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: c.ok ? "#f0fdf4" : "#f8fafc", borderRadius: 6, border: `1px solid ${c.ok ? "#bbf7d0" : "#e2e8f0"}`, marginBottom: 6 }}>
            <StatusDot status={c.dot} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{c.label}</span>
              <span style={{ fontSize: 11, color: "#6b7280", marginRight: 8 }}>— {c.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {cfg?.lastConnectionTest && (
        <div style={{ background: (cfg as any).lastConnectionStatus === "success" ? "#dcfce7" : "#fee2e2", borderRadius: 8, padding: "12px 14px", marginBottom: 14, border: `1px solid ${(cfg as any).lastConnectionStatus === "success" ? "#16a34a" : "#dc2626"}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: (cfg as any).lastConnectionStatus === "success" ? "#16a34a" : "#dc2626" }}>
            {(cfg as any).lastConnectionStatus === "success" ? "✅ آخر اختبار: ناجح" : "❌ آخر اختبار: فشل"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{new Date(cfg.lastConnectionTest).toLocaleString("ar-SA")}</div>
        </div>
      )}

      {isAdmin ? (
        <button onClick={() => testM.mutate()} disabled={testM.isPending}
          style={{ height: 40, padding: "0 28px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: testM.isPending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {testM.isPending ? "⏳ جارٍ الاختبار..." : "🔌 اختبار الاتصال الآن"}
        </button>
      ) : (
        <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#6b7280" }}>
          🔒 اختبار الاتصال متاح لمسؤول ZATCA فقط.
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// اختبارات المطابقة الرسمية — Compliance CSID فقط
// ══════════════════════════════════════════════════════════════════════════════
function ComplianceTestsSection({
  posUnitId: initialPosUnitId = null,
  invoiceType = "both",
  warehouseId,
}: {
  posUnitId?: number | null;
  invoiceType?: "simplified" | "standard" | "both";
  warehouseId?: number | null;
} = {}) {
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const utils = trpc.useUtils();
  const [posUnitId, setPosUnitId] = useState<number | null>(initialPosUnitId);
  const selectedUnitId = posUnitId ?? initialPosUnitId ?? unitsQ.data?.[0]?.id ?? null;
  const selectedUnit = (unitsQ.data ?? []).find(unit => unit.id === selectedUnitId);
  const readinessWarehouseId = warehouseId ?? selectedUnit?.warehouseId ?? null;
  const readinessQ = trpc.zatca.getReadiness.useQuery(
    { warehouseId: readinessWarehouseId ?? undefined, invoiceType },
    { enabled: Boolean(readinessWarehouseId) },
  );
  const prepareM = trpc.zatca.prepareComplianceFixtures.useMutation({
    onSuccess: async (result) => {
      await readinessQ.refetch();
      await utils.zatca.getReadiness.invalidate();
      toast.success(result.message);
    },
    onError: (error) => toast.error(error.message),
  });
  const runM = trpc.zatca.runComplianceTests.useMutation({
    onSuccess: async (result) => {
      await readinessQ.refetch();
      await utils.zatca.getReadiness.invalidate();
      result.ok ? toast.success(result.message) : toast.warning(result.message);
    },
    onError: (error) => toast.error(error.message),
  });
  const tests = (readinessQ.data?.complianceTests ?? []) as unknown as Array<{
    testKey: string;
    label: string;
    status: string;
    completed: boolean;
    fixtureReady: boolean;
    fixtureNumber: string | null;
    httpStatus: number | null;
    requestId: string | null;
    warnings: Array<{ code?: string; message?: string }>;
    errors: Array<{ code?: string; message?: string }>;
    attemptedAt: string | Date | null;
  }>;
  const statusText: Record<string, string> = {
    not_started: "لم يبدأ",
    submitting: "جارٍ الإرسال",
    passed: "ناجح",
    passed_with_warnings: "ناجح مع تحذيرات",
    completed_previously: "مكتمل سابقًا",
    not_eligible: "لا يوجد مستند مؤهل",
    failed: "فشل",
  };
  const statusColor = (status: string) =>
    status === "passed" || status === "passed_with_warnings" || status === "completed_previously"
      ? "#166534"
      : status === "failed"
        ? "#b91c1c"
        : status === "not_eligible"
          ? "#a16207"
          : "#64748b";
  const incompleteTests = tests.filter(test => !test.completed).length;
  const fixtureReadyCount = readinessQ.data?.complianceFixtureReadyCount
    ?? tests.filter(test => test.fixtureReady).length;
  const fixtureTotal = readinessQ.data?.complianceFixtureTotal ?? tests.length;

  return (
    <div style={{ maxWidth: 820 }}>
      <SecTitle icon="📋" title="اختبارات المطابقة الرسمية" />
      <div style={{ background: "#fffbeb", border: "1px solid #facc15", color: "#854d0e", borderRadius: 9, padding: 12, fontSize: 11, lineHeight: 1.8, marginBottom: 14 }}>
        هذه الاختبارات ترسل XML موقّعًا فعليًا إلى <code>/compliance/invoices</code> باستخدام Compliance CSID. فحص XML المحلي أو اختبار الاتصال لا يُحسب نجاحًا للمطابقة.
      </div>
      <div style={{ background: fixtureReadyCount === fixtureTotal && fixtureTotal > 0 ? "#f0fdf4" : "#f8fafc", border: `1px solid ${fixtureReadyCount === fixtureTotal && fixtureTotal > 0 ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: 9, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: "#334155" }}>
        مستندات المطابقة المعزولة الجاهزة: <strong style={{ color: fixtureReadyCount === fixtureTotal && fixtureTotal > 0 ? "#166534" : "#a16207" }}>{fixtureReadyCount} / {fixtureTotal}</strong>
        <span style={{ marginInlineStart: 10, color: "#64748b" }}>لا تدخل هذه المستندات في الحسابات أو المخزون أو أرقام الدفاتر التجارية.</span>
      </div>
      {(!initialPosUnitId || unitsQ.data && unitsQ.data.length > 1) && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: 12, marginBottom: 12 }}>
          <label style={lbl}>وحدة EGS لاختبارات المطابقة</label>
          <select value={selectedUnitId ?? ""} onChange={e => setPosUnitId(Number(e.target.value) || null)} style={{ ...fld, maxWidth: 460 }}>
            <option value="">اختر وحدة الربط</option>
            {(unitsQ.data ?? []).map(unit => <option key={unit.id} value={unit.id}>{unit.unitCode} — {unit.unitName} — {unit.warehouseName ?? "بدون مخزن"}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {tests.map(test => (
          <div key={test.testKey} style={{ background: "#fff", border: `1px solid ${test.completed ? "#bbf7d0" : test.status === "failed" ? "#fecaca" : test.status === "not_eligible" ? "#fde68a" : "#e2e8f0"}`, borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: test.completed ? "#dcfce7" : test.status === "failed" ? "#fee2e2" : test.status === "not_eligible" ? "#fef3c7" : "#f1f5f9", color: statusColor(test.status), fontWeight: 800 }}>{test.completed ? "✓" : test.status === "failed" ? "!" : test.status === "not_eligible" ? "…" : "—"}</span>
              <strong style={{ flex: 1, fontSize: 12 }}>{test.label}</strong>
              <span style={{ color: statusColor(test.status), fontSize: 11, fontWeight: 800 }}>{statusText[test.status] ?? test.status}</span>
              {test.httpStatus != null && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b" }}>HTTP {test.httpStatus}</span>}
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 10, color: test.fixtureReady ? "#166534" : "#a16207" }}>
              <span>{test.fixtureReady ? "✓ مستند مطابقة معزول جاهز" : "⚠ المستند التجريبي غير مجهز"}</span>
              {test.fixtureNumber && <span>رقم الاختبار: <strong>{test.fixtureNumber}</strong></span>}
            </div>
            {test.requestId && <div style={{ marginTop: 5, fontSize: 10, color: "#64748b" }}>Request ID: <span style={{ fontFamily: "monospace" }}>{test.requestId}</span></div>}
            {test.status === "not_eligible" && <div style={{ marginTop: 6, color: "#a16207", fontSize: 10 }}>لا يوجد مستند اختبار مؤهل. استخدم «تجهيز مستندات المطابقة» أولًا.</div>}
            {test.errors?.length > 0 && <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 10 }}>{test.errors.map((e, i) => <div key={i}>❌ {e.code}: {e.message}</div>)}</div>}
            {test.warnings?.length > 0 && <div style={{ marginTop: 6, color: "#a16207", fontSize: 10 }}>{test.warnings.map((e, i) => <div key={i}>⚠️ {e.code}: {e.message}</div>)}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button
          onClick={() => selectedUnitId && prepareM.mutate({ posUnitId: selectedUnitId, invoiceType })}
          disabled={!selectedUnitId || prepareM.isPending || runM.isPending}
          style={{ ...smallBtn, height: 38, padding: "0 16px", background: selectedUnitId && !prepareM.isPending && !runM.isPending ? "#0f766e" : "#cbd5e1", color: "#fff", cursor: selectedUnitId && !prepareM.isPending && !runM.isPending ? "pointer" : "not-allowed" }}
        >
          {prepareM.isPending ? "⏳ جارٍ تجهيز المستندات..." : "＋ تجهيز مستندات المطابقة"}
        </button>
        <button
          onClick={() => selectedUnitId && runM.mutate({ posUnitId: selectedUnitId, invoiceType, rerunCompleted: false })}
          disabled={!selectedUnitId || runM.isPending || prepareM.isPending || incompleteTests === 0}
          style={{ ...smallBtn, height: 38, padding: "0 16px", background: selectedUnitId && !runM.isPending && !prepareM.isPending && incompleteTests > 0 ? "#1d4ed8" : "#cbd5e1", color: "#fff", cursor: selectedUnitId && !runM.isPending && !prepareM.isPending && incompleteTests > 0 ? "pointer" : "not-allowed" }}
        >
          {runM.isPending ? "⏳ جارٍ إنشاء XML وتوقيعه وإرساله..." : `▶ تشغيل الاختبارات الناقصة فقط (${incompleteTests})`}
        </button>
        <button
          onClick={() => selectedUnitId && runM.mutate({ posUnitId: selectedUnitId, invoiceType, rerunCompleted: true })}
          disabled={!selectedUnitId || runM.isPending || prepareM.isPending}
          style={{ ...smallBtn, height: 38, padding: "0 16px", background: selectedUnitId && !runM.isPending && !prepareM.isPending ? "#64748b" : "#cbd5e1", color: "#fff", cursor: selectedUnitId && !runM.isPending && !prepareM.isPending ? "pointer" : "not-allowed" }}
        >
          إعادة اختبار مكتمل (اختياري)
        </button>
      </div>
      {!selectedUnitId && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 11 }}>اختر وحدة EGS قبل تشغيل الاختبارات.</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. إرسال الفواتير
// ══════════════════════════════════════════════════════════════════════════════
function SendSection() {
  const [page, setPage]         = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [invoiceType, setInvoiceType] = useState<"standard" | "simplified">("simplified");
  const [mockOutcome, setMockOutcome] = useState<"accepted" | "accepted_with_warnings" | "rejected" | "delayed" | "uncertain" | "connection_issue" | "connection_loss">("delayed");
  const listQ  = trpc.zatca.getInvoicesList.useQuery({ page, limit: 25, status: filterStatus || undefined });
  const submitM = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (r) => { r.ok ? toast.success(r.message ?? "تمت المعالجة") : toast.warning(r.message ?? "لم تتم المعالجة"); listQ.refetch(); },
    onError:   (e) => toast.error(e.message),
  });

  const rows = listQ.data?.invoices ?? [];

  return (
    <div>
      <SecTitle icon="📤" title="إرسال الفواتير الإلكترونية" />

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 11, color: "#92400e" }}>
         Test data — no actual connection to Fatoora. قاعدة المتابعة: «تم إرسال الطلب» لا تساوي نتيجة رسمية. اختر نتيجة Mock للاختبار فقط.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ minWidth: 150 }}>
          <label style={lbl}>نوع العملية</label>
          <select style={{ ...fld, height: 28 }} value={invoiceType} onChange={e => setInvoiceType(e.target.value as typeof invoiceType)}>
            <option value="simplified">Reporting — مبسطة</option>
            <option value="standard">Clearance — ضريبية عادية</option>
          </select>
        </div>
        <div style={{ minWidth: 190 }}>
          <label style={lbl}>نتيجة Mock</label>
          <select style={{ ...fld, height: 28 }} value={mockOutcome} onChange={e => setMockOutcome(e.target.value as typeof mockOutcome)}>
            <option value="delayed">تم الإرسال — لا رد نهائي</option>
             <option value="accepted">Mock: قبول تجريبي</option>
             <option value="accepted_with_warnings">Mock: قبول تجريبي مع تحذيرات</option>
             <option value="rejected">Mock: رفض تجريبي</option>
            <option value="uncertain">حالة غير مؤكدة</option>
            <option value="connection_issue">فشل اتصال قبل الإرسال</option>
            <option value="connection_loss">انقطاع الرد بعد الإرسال — غير مؤكدة</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["", "ready_to_submit", "submitting", "submitted_pending", "cleared", "reported", "accepted_with_warnings", "rejected", "connection_issue", "retry_pending", "uncertain"].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            style={{ height: 26, padding: "0 12px", borderRadius: 12, border: `1px solid ${filterStatus === s ? "#D19C05" : "#e2e8f0"}`, background: filterStatus === s ? "#D19C05" : "#fff", color: filterStatus === s ? "#fff" : "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {s === "" ? "الكل" : (STATUS_MAP[s]?.label ?? s)}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "الحالة", "المحاولات", "الإجراء"].map(h => (
                <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد فواتير</td></tr>
            ) : rows.map((inv, i) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#D19C05" }}>{inv.invoiceNumber}</td>
                <td style={{ padding: "6px 10px", color: "#6b7280" }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("ar-SA") : "-"}</td>
                <td style={{ padding: "6px 10px" }}>{inv.customerName ?? "-"}</td>
                <td style={{ padding: "6px 10px", direction: "ltr", textAlign: "left" }}>{parseFloat(inv.total ?? "0").toLocaleString("en", { minimumFractionDigits: 2 })} SAR</td>
                <td style={{ padding: "6px 10px" }}><StatusBadge status={inv.zatcaStatus} /></td>
                <td style={{ padding: "6px 10px", textAlign: "center", color: "#6b7280" }}>{inv.zatcaAttemptCount ?? 0}</td>
                <td style={{ padding: "6px 10px" }}>
                   {!["cleared", "reported", "accepted_with_warnings", "rejected"].includes(inv.zatcaStatus ?? "") && (
                     <button onClick={() => submitM.mutate({ invoiceId: inv.id, invoiceType, mockOutcome, forceResend: (inv.zatcaAttemptCount ?? 0) > 0 })} disabled={submitM.isPending}
                      style={{ height: 22, padding: "0 10px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      {(inv.zatcaAttemptCount ?? 0) > 0 ? "↩ إعادة" : "إرسال"}
                    </button>
                  )}
                   {["cleared", "reported", "accepted_with_warnings", "rejected"].includes(inv.zatcaStatus ?? "") && <span style={{ color: STATUS_MAP[inv.zatcaStatus ?? ""]?.color ?? "#16a34a", fontSize: 11 }}>✓ {STATUS_MAP[inv.zatcaStatus ?? ""]?.label}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(listQ.data?.pages ?? 0) > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
          {Array.from({ length: listQ.data?.pages ?? 0 }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${page === i + 1 ? "#D19C05" : "#e2e8f0"}`, background: page === i + 1 ? "#D19C05" : "#fff", color: page === i + 1 ? "#fff" : "#374151", fontWeight: 700, fontSize: 11 }}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// متابعة الحالة الرسمية وسجل المعاملة
// ══════════════════════════════════════════════════════════════════════════════
function TrackingSection() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listQ = trpc.zatca.getInvoicesList.useQuery({ page: 1, limit: 100 });
  const detailQ = trpc.zatca.getLifecycle.useQuery(
    { invoiceId: selectedId! },
    { enabled: selectedId != null },
  );
  const rows = listQ.data?.invoices ?? [];
  const detail = detailQ.data;
  const transaction = detail?.transaction;

  return (
    <div>
      <SecTitle icon="🧭" title="متابعة حالة Mock — لا توجد حالة رسمية" />
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14, minHeight: 420 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "auto", maxHeight: 620 }}>
          {rows.map(inv => (
            <button key={inv.id} onClick={() => setSelectedId(inv.id)}
              style={{ width: "100%", border: "none", borderBottom: "1px solid #f1f5f9", background: selectedId === inv.id ? "#fffbeb" : "#fff", padding: "9px 10px", textAlign: "right", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#D19C05", fontSize: 11 }}>{inv.invoiceNumber}</strong>
                <StatusBadge status={inv.zatcaStatus} />
              </div>
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 3 }}>{inv.customerName ?? "—"} · محاولات {inv.zatcaAttemptCount ?? 0}</div>
            </button>
          ))}
          {!rows.length && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>لا توجد فواتير</div>}
        </div>
        <div>
          {!detail && <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 50, textAlign: "center", color: "#94a3b8" }}>اختر فاتورة لعرض دورة الحالة</div>}
          {detail && (
            <>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ fontSize: 15 }}>فاتورة {detail.invoice.invoiceNumber}</strong>
                  <StatusBadge status={detail.invoice.zatcaStatus} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 10 }}>
                  {[
                    ["UUID", detail.invoice.zatcaUuid],
                    ["ICV", detail.invoice.zatcaInvoiceCounter],
                    ["نوع العملية", transaction?.submissionType === "clearance" ? "Clearance" : "Reporting"],
                    ["Correlation ID", transaction?.correlationId],
                    ["HTTP Status", transaction?.httpStatus],
                    ["المحاولات", transaction?.attemptCount ?? detail.invoice.zatcaAttemptCount],
                    ["وقت الإرسال", transaction?.lastAttemptAt ? new Date(transaction.lastAttemptAt).toLocaleString("ar-SA") : "—"],
                    ["وقت الرد", transaction?.responseDate ? new Date(transaction.responseDate).toLocaleString("ar-SA") : "لم يصل"],
                    ["حالة Mock", transaction?.authorityStatus],
                  ].map(([label, value]) => <div key={String(label)} style={{ background: "#f8fafc", padding: 7, borderRadius: 5 }}><div style={{ color: "#64748b" }}>{label}</div><div style={{ fontFamily: "monospace", marginTop: 3, wordBreak: "break-all" }}>{String(value ?? "—")}</div></div>)}
                </div>
                {transaction?.lastError && <div style={{ marginTop: 10, background: "#fef2f2", color: "#b91c1c", padding: 8, borderRadius: 5, fontSize: 11 }}>{transaction.lastError}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <PayloadCard title="الطلب بعد حذف الأسرار" payload={transaction?.requestPayload} />
                <PayloadCard title="الرد بعد حذف الأسرار" payload={transaction?.responsePayload} />
              </div>
               <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginTop: 10 }}>
                 <strong style={{ fontSize: 12 }}>سجل المحاولات (نفس المعاملة، Mock فقط)</strong>
                 <div style={{ marginTop: 8, fontSize: 11 }}>
                   {(detail.attempts ?? []).map(item => (
                     <div key={item.id} style={{ padding: 7, borderBottom: "1px solid #f1f5f9" }}>
                       <strong>محاولة #{item.attemptNumber}</strong>
                       {" · "}Attempt ID: <code>{item.attemptId}</code>
                       {" · "}Request ID: <code>{item.requestId ?? "—"}</code>
                       {" · "}HTTP {item.httpStatus ?? "—"}
                       {" · "}{item.result}
                       {" · "}{new Date(item.startedAt).toLocaleString("ar-SA")}
                     </div>
                   ))}
                   {!detail.attempts?.length && <div style={{ color: "#94a3b8" }}>لا توجد محاولات مسجلة</div>}
                 </div>
                 <strong style={{ display: "block", fontSize: 12, marginTop: 12 }}>سجل الاستجابات والأخطاء</strong>
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  {(detail.responses ?? []).map(item => <div key={item.id} style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>رد HTTP {item.httpStatus ?? "—"} · {new Date(item.responseTime).toLocaleString("ar-SA")}</div>)}
                  {(detail.errors ?? []).map(item => <div key={item.id} style={{ padding: 6, color: "#b91c1c", borderBottom: "1px solid #f1f5f9" }}>{item.errorCode}: {item.errorMessage}</div>)}
                  {!detail.responses?.length && !detail.errors?.length && <div style={{ color: "#94a3b8" }}>لا توجد استجابات أو أخطاء مسجلة</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PayloadCard({ title, payload }: { title: string; payload: unknown }) {
  return <div style={{ background: "#1e293b", borderRadius: 8, padding: 10, minHeight: 120 }}>
    <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{title}</div>
    <pre style={{ color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 9, margin: 0, maxHeight: 180, overflow: "auto" }}>{payload ? JSON.stringify(payload, null, 2) : "—"}</pre>
  </div>;
}

function UncertainSection() {
  const utils = trpc.useUtils();
  const listQ = trpc.zatca.getUncertainInvoices.useQuery({ limit: 100 });
  const rows = listQ.data ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const matchM = trpc.zatca.matchAuthorityResponse.useMutation({
    onSuccess: () => { toast.success("تمت مطابقة الحالة"); listQ.refetch(); },
    onError: e => toast.error(e.message),
  });
  const retryM = trpc.zatca.retryInvoice.useMutation({
    onSuccess: (_result, variables) => {
      toast.success("تمت جدولة إعادة المحاولة بنفس UUID وCorrelation ID");
      listQ.refetch();
      utils.zatca.getInvoicesList.invalidate();
      const row = rows.find(item => item.invoiceId === variables.invoiceId);
      if (row) {
        submitM.mutate({
          invoiceId: row.invoiceId,
          invoiceType: row.operation === "clearance" ? "standard" : "simplified",
          mockOutcome: "delayed",
          forceResend: true,
        });
      }
    },
    onError: e => toast.error(e.message),
  });
  const submitM = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (result) => {
      result.ok
        ? toast.success("أُعيد الإرسال بنفس المعاملة؛ النتيجة النهائية ما زالت قيد الانتظار")
        : toast.warning(result.message ?? "لم تتم إعادة المحاولة");
      listQ.refetch();
      utils.zatca.getInvoicesList.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <div>
      <SecTitle icon="❔" title="الفواتير غير المؤكدة" />
      <div style={{ background: "#f3e8ff", border: "1px solid #d8b4fe", borderRadius: 8, padding: 10, marginBottom: 12, color: "#6b21a8", fontSize: 11 }}>
        هذه الفواتير أُرسل طلبها أو انقطع الاتصال قبل تأكيد النتيجة. لا تُنشأ فاتورة بديلة ولا UUID جديد؛ استخدم المطابقة أو إعادة المحاولة الآمنة.
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr style={{ background: "#f8fafc" }}>{["الفاتورة", "الحالة", "العملية", "UUID", "Correlation", "آخر محاولة", "المحاولات", "إجراء"].map(h => <th key={h} style={{ padding: 8, textAlign: "right" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.invoiceId} style={{ borderTop: "1px solid #f1f5f9", background: selected === row.invoiceId ? "#faf5ff" : "#fff" }}>
              <td style={{ padding: 8, fontWeight: 700 }}>{row.invoiceNumber}</td>
              <td style={{ padding: 8 }}><StatusBadge status={row.zatcaStatus} /></td>
              <td style={{ padding: 8 }}>{row.operation === "clearance" ? "Clearance" : "Reporting"}</td>
              <td style={{ padding: 8, fontFamily: "monospace", fontSize: 9 }}>{row.zatcaUuid ?? "—"}</td>
              <td style={{ padding: 8, fontFamily: "monospace", fontSize: 9 }}>{row.correlationId ?? "—"}</td>
              <td style={{ padding: 8 }}>{row.lastAttemptAt ? new Date(row.lastAttemptAt).toLocaleString("ar-SA") : "—"}</td>
              <td style={{ padding: 8, textAlign: "center" }}>{row.attemptCount}</td>
              <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                <button onClick={() => { setSelected(row.invoiceId); matchM.mutate({ invoiceId: row.invoiceId, correlationId: row.correlationId ?? undefined, outcome: "pending", authorityStatus: "PENDING_RECHECK" }); }} disabled={matchM.isPending} style={{ ...smallBtn, background: "#7c3aed", color: "#fff" }}>مطابقة</button>
                <button onClick={() => retryM.mutate({ invoiceId: row.invoiceId })} disabled={retryM.isPending || submitM.isPending} style={{ ...smallBtn, background: "#D19C05", color: "#fff", marginRight: 4 }}>إعادة آمنة</button>
              </td>
            </tr>)}
            {!rows.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>لا توجد فواتير غير مؤكدة</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>تم تحديد الفاتورة {selected} للمطابقة الداخلية. لا توجد نتيجة هيئة فعلية في Mock؛ استخدم نتيجة Simulation فقط.</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 12 & 13. سجلات العمليات / الأخطاء
// ══════════════════════════════════════════════════════════════════════════════
const EVENT_MAP: Record<string, string> = {
  submit: "إرسال", resend: "إعادة إرسال", manual_status_update: "تحديث يدوي",
  config_update: "تحديث الإعدادات", connection_test: "اختبار الاتصال", xml_validation: "تحقق من XML",
};

function LogsSection({ errorsOnly = false }: { errorsOnly?: boolean }) {
  const [page, setPage]   = useState(1);
  const [expanded, setEx] = useState<number | null>(null);
  const [invNum, setInvNum] = useState("");
  const [evType, setEvType] = useState("");
  const [status, setStatus] = useState("");

  const logsQ = trpc.zatca.getLogs.useQuery({ page, limit: 40, invoiceNumber: invNum || undefined, eventType: evType || undefined, status: status || undefined, errorsOnly });
  const rows  = logsQ.data?.logs ?? [];

  const exportCsv = () => {
    const header = ["التاريخ", "الفاتورة", "نوع العملية", "الحالة", "المستخدم", "رسالة الخطأ"];
    const csv = [header.join(","), ...rows.map(r => [new Date(r.createdAt).toLocaleString("ar-SA"), r.invoiceNumber ?? "", EVENT_MAP[r.eventType] ?? r.eventType, r.status, r.userName ?? "", r.errorMessage ?? ""].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    a.download = `zatca-${errorsOnly ? "errors" : "logs"}-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div>
      <SecTitle icon={errorsOnly ? "🚨" : "📋"} title={errorsOnly ? "سجل الأخطاء" : "سجل الإرسال والاستقبال"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 12, background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div><label style={lbl}>رقم الفاتورة</label><input style={{ ...fld, height: 26 }} value={invNum} onChange={e => { setInvNum(e.target.value); setPage(1); }} placeholder="بحث..." /></div>
        <div><label style={lbl}>نوع العملية</label>
          <select style={{ ...fld, height: 26 }} value={evType} onChange={e => { setEvType(e.target.value); setPage(1); }}>
            <option value="">الكل</option>
            {Object.entries(EVENT_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div><label style={lbl}>الحالة</label>
          <select style={{ ...fld, height: 26 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">الكل</option>
            {Object.entries(STATUS_MAP).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <button onClick={() => { setInvNum(""); setEvType(""); setStatus(""); setPage(1); }} style={{ height: 26, padding: "0 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>مسح</button>
          <button onClick={exportCsv} style={{ height: 26, padding: "0 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>📥 CSV</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["التاريخ", "الفاتورة", "نوع العملية", "الحالة", "البيئة", "المستخدم", "الخطأ", ""].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد سجلات</td></tr>
            ) : rows.map((log, i) => (
              <React.Fragment key={log.id}>
                <tr style={{ borderBottom: "1px solid #f1f5f9", background: log.status === "error" || log.status === "rejected" ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }} onClick={() => setEx(expanded === log.id ? null : log.id)}>
                  <td style={{ padding: "5px 8px", color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: "#D19C05" }}>{log.invoiceNumber ?? "-"}</td>
                  <td style={{ padding: "5px 8px" }}>{EVENT_MAP[log.eventType] ?? log.eventType}</td>
                  <td style={{ padding: "5px 8px" }}><StatusBadge status={log.status} /></td>
                  <td style={{ padding: "5px 8px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: log.environment === "production" ? "#dcfce7" : "#fef3c7", color: log.environment === "production" ? "#16a34a" : "#d97706" }}>
                      {log.environment === "production" ? "إنتاج" : "اختبار"}
                    </span>
                  </td>
                  <td style={{ padding: "5px 8px" }}>{log.userName ?? "-"}</td>
                  <td style={{ padding: "5px 8px", color: "#dc2626", fontSize: 10, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.errorMessage ?? "-"}</td>
                  <td style={{ padding: "5px 8px", color: "#6366f1" }}>{log.responseBody ? (expanded === log.id ? "▲" : "▼") : ""}</td>
                </tr>
                {expanded === log.id && log.responseBody && (
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={8} style={{ padding: "8px 14px" }}>
                      <pre style={{ fontFamily: "monospace", fontSize: 10, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", background: "#1e293b", color: "#e2e8f0", borderRadius: 6, padding: "8px 12px", margin: 0 }}>
                        {(() => { try { return JSON.stringify(JSON.parse(log.responseBody), null, 2); } catch { return log.responseBody; } })()}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {(logsQ.data?.pages ?? 0) > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
          {Array.from({ length: logsQ.data?.pages ?? 0 }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${page === i + 1 ? "#D19C05" : "#e2e8f0"}`, background: page === i + 1 ? "#D19C05" : "#fff", color: page === i + 1 ? "#fff" : "#374151", fontWeight: 700, fontSize: 11 }}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 14. أدوات التشخيص
// ══════════════════════════════════════════════════════════════════════════════
function DiagSection() {
  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const statsQ = trpc.zatca.getStats.useQuery();
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const diagnosticUnitId = unitsQ.data?.[0]?.id ?? null;
  const onboardingQ = trpc.zatca.getSimulationOnboardingStatus.useQuery(
    { posUnitId: diagnosticUnitId ?? 0 },
    { enabled: Boolean(diagnosticUnitId) },
  );
  const testM  = trpc.zatca.testConnection.useMutation();
  const cfg = cfgQ.data;
  const s   = statsQ.data;

  const checks = [
    { id: "vat",    label: "صحة الرقم الضريبي",     dot: !!cfg?.vatNumber && /^3\d{13}3$/.test(cfg?.vatNumber ?? "") ? "ok" as const : "error" as const, detail: cfg?.vatNumber || "غير محدد" },
    { id: "name",   label: "اسم المنشأة",             dot: !!cfg?.legalName ? "ok" as const : "warn" as const, detail: cfg?.legalName || "غير محدد" },
    { id: "addr",   label: "اكتمال العنوان",          dot: !!(cfg?.street && cfg?.city) ? "ok" as const : "warn" as const, detail: cfg?.street ? `${cfg.street}، ${cfg.city}` : "غير مكتمل" },
    { id: "compliance-csid", label: "Compliance CSID", dot: onboardingQ.data?.complianceCsidPresent ? "ok" as const : "error" as const, detail: onboardingQ.data?.complianceCsidPresent ? "موجود للمطابقة ✓" : "مفقود" },
    { id: "operational-csid", label: "CSID التشغيلي", dot: onboardingQ.data?.operationalCsidPresent ? "ok" as const : "warn" as const, detail: onboardingQ.data?.operationalCsidPresent ? "موجود للتشغيل ✓" : "غير مطلوب حتى نجاح المطابقة" },
    { id: "cert",   label: "صلاحية الشهادة (Compliance/تشغيلية)", dot: !!(cfg?.certExpiryDate && (s?.certDaysLeft ?? 0) > 0) ? "ok" as const : s?.certDaysLeft !== null && (s?.certDaysLeft ?? 0) > 0 ? "ok" as const : "error" as const, detail: s?.certDaysLeft != null ? `${s!.certDaysLeft} يوم متبقٍ` : "غير محدد" },
    { id: "env",    label: "تهيئة البيئة",            dot: !!cfg?.apiBaseUrl ? "ok" as const : "error" as const, detail: cfg?.environment === "production" ? "إنتاج ✓" : "اختبار" },
    { id: "enabled",label: "تفعيل المنظومة",          dot: !!cfg?.enabled ? "ok" as const : "warn" as const, detail: cfg?.enabled ? "مُفعَّلة ✓" : "غير مُفعَّلة" },
    { id: "conn",   label: "آخر اختبار اتصال",       dot: (cfg as any)?.lastConnectionStatus === "success" ? "ok" as const : "none" as const, detail: cfg?.lastConnectionTest ? new Date(cfg.lastConnectionTest).toLocaleString("ar-SA") : "لم يُختبر" },
  ];

  const passed = checks.filter(c => c.dot === "ok").length;
  const score  = Math.round((passed / checks.length) * 100);

  return (
    <div>
      <SecTitle icon="🔬" title="أدوات التشخيص" />

      <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: "1px solid #e2e8f0", marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", border: `4px solid ${score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, flexDirection: "column" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626" }}>{score}%</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
            {score >= 80 ? "✅ الفحوص الداخلية مكتملة" : score >= 60 ? "⚠️ تحتاج مراجعة" : "❌ تحتاج إعداد"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{passed} من {checks.length} فحص ناجح</div>
        </div>
        <button onClick={() => cfgQ.refetch()} style={{ marginRight: "auto", height: 30, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 تحديث</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        {checks.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", background: c.dot === "ok" ? "#f0fdf4" : c.dot === "error" ? "#fef2f2" : "#fffbeb", borderRadius: 6, border: `1px solid ${c.dot === "ok" ? "#bbf7d0" : c.dot === "error" ? "#fecaca" : "#fde68a"}`, marginBottom: 6 }}>
            <StatusDot status={c.dot} />
            <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{c.detail}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "اختبار الاتصال", icon: "🔌", action: () => testM.mutate(), disabled: !(cfg?.isAdmin) },
          { label: "فحص XML",       icon: "🔎", action: () => toast.info("انتقل لقسم التحقق من XML"), disabled: false },
          { label: "مزامنة الساعة", icon: "⏰", action: () => toast.info(`توقيت: ${new Date().toLocaleString("ar-SA")}`), disabled: false },
        ].map(b => (
          <button key={b.label} onClick={b.action} disabled={b.disabled}
            style={{ height: 38, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: b.disabled ? "not-allowed" : "pointer", color: b.disabled ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. التحقق من XML
// ══════════════════════════════════════════════════════════════════════════════
function XmlCheckSection() {
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [searchInv, setSearchInv] = useState("");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showXml, setShowXml] = useState(false);

  const listQ     = trpc.zatca.getInvoicesList.useQuery({ page: 1, limit: 50 });
  const validateM = trpc.zatca.validateXml.useMutation();
  const result    = validateM.data;

  const invoices = listQ.data?.invoices ?? [];
  const filtered = invoices.filter(i => !searchInv || (i.invoiceNumber ?? "").toLowerCase().includes(searchInv.toLowerCase()) || (i.customerName ?? "").includes(searchInv));

  const TYPE_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
    error:   { color: "#dc2626", bg: "#fee2e2", icon: "❌" },
    warning: { color: "#d97706", bg: "#fef3c7", icon: "⚠️" },
    info:    { color: "#16a34a", bg: "#dcfce7", icon: "✅" },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, minHeight: 400 }}>
      <div>
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🔍 اختر فاتورة</div>
          <input value={searchInv} onChange={e => setSearchInv(e.target.value)} placeholder="بحث..." style={{ ...fld, marginBottom: 8 }} />
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
            {filtered.map(inv => (
              <div key={inv.id} onClick={() => setInvoiceId(inv.id)}
                style={{ padding: "7px 10px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: invoiceId === inv.id ? "#fef3c7" : "transparent", borderRight: `3px solid ${invoiceId === inv.id ? "#D19C05" : "transparent"}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: invoiceId === inv.id ? "#D19C05" : "#1e293b" }}>{inv.invoiceNumber}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{inv.customerName ?? "—"}</div>
              </div>
            ))}
          </div>
          <button onClick={() => { if (!invoiceId) return toast.error("اختر فاتورة أولاً"); validateM.mutate({ invoiceId }); setSelectedRow(null); }}
            disabled={!invoiceId || validateM.isPending}
            style={{ width: "100%", height: 34, marginTop: 10, background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: invoiceId ? "pointer" : "not-allowed", opacity: (!invoiceId || validateM.isPending) ? 0.6 : 1 }}>
            {validateM.isPending ? "⏳ جارٍ التحقق..." : "🔎 التحقق الآن"}
          </button>
        </div>
        {result && (
          <div style={{ background: result.passed ? "#dcfce7" : "#fee2e2", borderRadius: 8, border: `1px solid ${result.passed ? "#16a34a" : "#dc2626"}`, padding: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 13, textAlign: "center", color: result.passed ? "#16a34a" : "#dc2626", marginBottom: 8 }}>
              {result.passed ? "✅ مطابقة" : "❌ توجد أخطاء"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={{ textAlign: "center", background: "#fee2e2", borderRadius: 4, padding: "4px" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#dc2626" }}>{result.errorCount}</div>
                <div style={{ fontSize: 10, color: "#dc2626" }}>أخطاء</div>
              </div>
              <div style={{ textAlign: "center", background: "#fef3c7", borderRadius: 4, padding: "4px" }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#d97706" }}>{result.warningCount}</div>
                <div style={{ fontSize: 10, color: "#d97706" }}>تحذيرات</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        {!result && !validateM.isPending && (
          <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", padding: "50px 30px", textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔎</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>التحقق من صحة XML</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>اختر فاتورة وابدأ التحقق</div>
          </div>
        )}
        {result && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button onClick={() => setShowXml(!showXml)} style={{ height: 26, padding: "0 10px", background: "#1e293b", color: "#e2e8f0", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>{showXml ? "▲ إخفاء" : "▼ XML"}</button>
              <button onClick={() => { if (result?.xml) { navigator.clipboard.writeText(result.xml); toast.success("تم النسخ"); } }} style={{ height: 26, padding: "0 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>📋 نسخ</button>
            </div>
            {showXml && (
              <div style={{ background: "#1e293b", borderRadius: 6, padding: "10px 12px", marginBottom: 10, maxHeight: 200, overflow: "auto" }}>
                <pre style={{ fontFamily: "monospace", fontSize: 9, color: "#e2e8f0", margin: 0, whiteSpace: "pre-wrap" }}>{result.xml}</pre>
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  {["#", "النوع", "العنصر", "الوصف"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, fontSize: 10 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {result.results.map((r, i) => {
                    const ts = TYPE_STYLE[r.type] ?? TYPE_STYLE.info;
                    const isSel = selectedRow === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr onClick={() => setSelectedRow(isSel ? null : r.id)} style={{ borderBottom: "1px solid #f1f5f9", background: isSel ? ts.bg : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}>
                          <td style={{ padding: "4px 8px", color: "#6b7280" }}>{r.id}</td>
                          <td style={{ padding: "4px 8px" }}><span style={{ fontSize: 10, fontWeight: 700, color: ts.color }}>{ts.icon} {r.type === "error" ? "خطأ" : r.type === "warning" ? "تحذير" : "معلومة"}</span></td>
                          <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 9, color: "#6366f1", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.element}</td>
                          <td style={{ padding: "4px 8px", color: r.type === "error" ? "#dc2626" : r.type === "warning" ? "#92400e" : "#374151", fontSize: 11 }}>{r.description}</td>
                        </tr>
                        {isSel && (
                          <tr style={{ background: ts.bg }}>
                            <td colSpan={4} style={{ padding: "8px 12px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                <div><div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>القيمة الحالية</div><div style={{ fontFamily: "monospace", fontSize: 11, background: "#fff", padding: "4px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>{r.currentValue || "—"}</div></div>
                                <div><div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>القيمة المتوقعة</div><div style={{ fontFamily: "monospace", fontSize: 11, background: "#fff", padding: "4px 8px", borderRadius: 4, border: `1px solid ${ts.color}44` }}>{r.expectedValue}</div></div>
                                <div><div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>🔧 الحل</div><div style={{ fontSize: 11, background: "#fff", padding: "4px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>{r.fix}</div></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 15. التقارير والإحصائيات
// ══════════════════════════════════════════════════════════════════════════════
function ReportsSection() {
  const statsQ = trpc.zatca.getStats.useQuery();
  const logsQ  = trpc.zatca.getLogs.useQuery({ page: 1, limit: 5 });
  const s = statsQ.data;

  const reportCards = [
    { title: "جاهزة للإرسال",       value: s?.readyToSubmit ?? s?.notSubmitted ?? 0, total: s?.totalInvoices ?? 0, color: "#475569", icon: "📭" },
    { title: "Mock: تخليص تجريبي",   value: s?.cleared ?? 0,     total: s?.totalInvoices ?? 0, color: "#16a34a", icon: "✅" },
    { title: "Mock: إبلاغ تجريبي",   value: s?.reported ?? 0,    total: s?.totalInvoices ?? 0, color: "#0ea5e9", icon: "📨" },
    { title: "بانتظار النتيجة",      value: (s?.submittedPending ?? 0) + (s?.submitting ?? 0), total: s?.totalInvoices ?? 0, color: "#d97706", icon: "⏳" },
    { title: "Mock: قبول تجريبي مع تحذيرات", value: s?.acceptedWithWarnings ?? 0, total: s?.totalInvoices ?? 0, color: "#ca8a04", icon: "⚠️" },
    { title: "Mock: رفض تجريبي",      value: s?.rejected ?? 0,    total: s?.totalInvoices ?? 0, color: "#dc2626", icon: "❌" },
    { title: "مشاكل/غير مؤكدة",      value: (s?.connectionIssue ?? 0) + (s?.retryPending ?? 0) + (s?.uncertain ?? 0), total: s?.totalInvoices ?? 0, color: "#9333ea", icon: "❔" },
  ];

  return (
    <div>
      <SecTitle icon="📊" title="التقارير والإحصائيات" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {reportCards.map(c => {
          const pct = s?.totalInvoices ? Math.round((c.value / s.totalInvoices) * 100) : 0;
          return (
            <div key={c.title} style={{ background: "#fff", borderRadius: 8, padding: "12px 10px", border: `1px solid ${c.color}33`, textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{c.title}</div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: c.color, transition: "width 0.5s" }} />
              </div>
              <div style={{ fontSize: 9, color: c.color, marginTop: 2 }}>{pct}%</div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 8, padding: "14px 16px", border: "1px solid #e2e8f0", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>إجمالي الفواتير</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{s?.totalInvoices ?? 0}</div>
          </div>
          {s && s.totalInvoices > 0 && (
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 2, height: 16, borderRadius: 8, overflow: "hidden" }}>
                {[{ v: s.cleared, c: "#16a34a" }, { v: s.pending, c: "#d97706" }, { v: s.rejected, c: "#dc2626" }, { v: s.errors, c: "#7c3aed" }, { v: s.notSubmitted, c: "#e2e8f0" }]
                  .map((seg, i) => <div key={i} style={{ flex: seg.v, background: seg.c, minWidth: seg.v > 0 ? 4 : 0 }} />)}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#6b7280", flexWrap: "wrap" }}>
                {[["#16a34a","تخليص Mock تجريبي"],["#d97706","انتظار"],["#dc2626","رفض Mock تجريبي"],["#7c3aed","أخطاء"],["#e2e8f0","لم تُرسَل"]].map(([c,l]) => (
                  <span key={l} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12 }}>🕐 آخر 5 عمليات</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <tbody>
            {(logsQ.data?.logs ?? []).map((log, i) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "6px 12px", color: "#6b7280" }}>{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                <td style={{ padding: "6px 12px", fontWeight: 700, color: "#D19C05" }}>{log.invoiceNumber ?? "-"}</td>
                <td style={{ padding: "6px 12px" }}><StatusBadge status={log.status} /></td>
                <td style={{ padding: "6px 12px", color: "#6b7280" }}>{log.userName ?? "-"}</td>
              </tr>
            ))}
            {(logsQ.data?.logs ?? []).length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>لا توجد عمليات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={() => { statsQ.refetch(); logsQ.refetch(); }} style={{ height: 30, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 تحديث</button>
        <button disabled style={{ height: 30, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, cursor: "not-allowed", fontWeight: 600, opacity: 0.5 }}>📥 تصدير PDF (قريباً)</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// الواجهة النهائية: التفعيل والربط
// ══════════════════════════════════════════════════════════════════════════════
type ActivationWizardProps = {
  cfg: any;
  units: any[];
  environment: LinkingEnvironment;
  onOpenCompanyInfo?: () => void;
  onOpenTechnical?: () => void;
  onFinishedLinking: () => void;
  includeCompanyStep?: boolean;
};

function ActivationWizard({
  cfg,
  units,
  environment,
  onOpenCompanyInfo,
  onOpenTechnical,
  onFinishedLinking,
  includeCompanyStep = true,
}: ActivationWizardProps) {
  const utils = trpc.useUtils();
  const [activeStep, setActiveStep] = useState(includeCompanyStep ? 1 : 2);
  const [warehouseId, setWarehouseId] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [invoiceType, setInvoiceType] = useState<"simplified" | "standard" | "both">("both");
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(
    includeCompanyStep ? (units[0]?.id ?? null) : null,
  );
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [createdUnit, setCreatedUnit] = useState<any>(null);

  const readinessQ = trpc.zatca.getReadiness.useQuery({
    warehouseId: warehouseId ? Number(warehouseId) : undefined,
    invoiceType,
  });
  const simulationUnitId = selectedUnitId ?? null;
  const simulationStatusQ = trpc.zatca.getSimulationOnboardingStatus.useQuery(
    { posUnitId: simulationUnitId ?? 0 },
    { enabled: Boolean(simulationUnitId) && environment === "simulation" },
  );
  const saveReadinessM = trpc.zatca.saveReadinessSettings.useMutation();
  const createUnitM = trpc.zatca.createPosUnit.useMutation();

  const readiness = readinessQ.data;
  const availableUnits = createdUnit ? [...units.filter(unit => unit.id !== createdUnit.id), createdUnit] : units;
  const selectedWarehouseNumber = warehouseId ? Number(warehouseId) : null;
  const selectedUnit = availableUnits.find(unit =>
    unit.id === selectedUnitId
    && (selectedWarehouseNumber == null || unit.warehouseId === selectedWarehouseNumber),
  )
    ?? (includeCompanyStep && readiness?.linkingUnitId
      ? units.find(unit => unit.id === readiness.linkingUnitId)
      : undefined);
  const selectedWarehouseUnitId = selectedUnit?.warehouseId === selectedWarehouseNumber
    ? selectedUnit.id
    : null;
  const companyFields: Array<[string, string]> = [
    ["الاسم القانوني", String(cfg?.legalName ?? "")],
    ["الرقم الضريبي", String(cfg?.vatNumber ?? "")],
    ["السجل التجاري", String(cfg?.commercialReg ?? "")],
    ["الدولة", String(cfg?.country ?? "")],
    ["المدينة", String(cfg?.city ?? "")],
    ["الحي", String(cfg?.district ?? "")],
    ["الشارع", String(cfg?.street ?? "")],
    ["رقم المبنى", String(cfg?.buildingNumber ?? "")],
    ["الرقم الإضافي", String(cfg?.additionalNumber ?? "")],
    ["الرمز البريدي", String(cfg?.postalCode ?? "")],
  ];
  const missingCompanyFields = companyFields.filter(([, value]) => !value.trim()).map(([label]) => label);
  const companyComplete = missingCompanyFields.length === 0;
  const unitJournals = selectedUnit?.journals ?? (
    selectedUnit?.linkedJournalIds?.map((id: number) => ({ journalId: id })) ?? []
  );
  const requiredJournalTypes = ["sales_invoice", "sales_return", "credit_note", "debit_note"];
  const linkedTypes = new Set(unitJournals.map((journal: any) => journal.docType));
  const unitComplete = Boolean(
    selectedUnit
    && selectedUnit.warehouseId === selectedWarehouseNumber
    && requiredJournalTypes.every(type => unitJournals.some((journal: any) =>
      journal.docType === type
      && journal.journalId != null
      && journal.journalCode?.trim()
      && journal.journalName?.trim()
      && journal.warehouseId === selectedWarehouseNumber,
    )),
  );
  const invoiceTypeSaved = readiness?.savedSettings?.invoiceType === invoiceType
    && (!selectedUnitId || readiness.savedSettings?.zatcaPosUnitId === selectedUnitId);
  const simulationComplete = Boolean(simulationStatusQ.data?.signingMaterialsReady);
  const testsComplete = simulationComplete && Boolean(readiness?.complianceTestCompleted);
  const operationalComplete = simulationComplete && Boolean(simulationStatusQ.data?.operationalReady);
  const environmentStatus = selectedUnit?.environmentStatuses?.[environment] ?? null;
  const productionComplete = Boolean(
    environment === "production"
      && environmentStatus?.registrationStatus === "operational"
      && environmentStatus?.operationalCsidPresent,
  );
  const environmentComplete = environment === "simulation" ? simulationComplete : productionComplete;
  const allSteps = [
    { id: 1, icon: "🏢", title: "بيانات المنشأة", detail: "بيانات القراءة فقط من معلومات المؤسسة", done: companyComplete },
    { id: 2, icon: "🧩", title: "وحدة الربط والدفاتر", detail: "الوحدة والدفاتر الأربعة لنفس المخزن/الفرع", done: unitComplete },
    { id: 3, icon: "🧾", title: "نوع الفواتير", detail: "مبسطة أو قياسية أو كلاهما", done: invoiceTypeSaved },
    { id: 4, icon: "🌐", title: environment === "simulation" ? "تهيئة المحاكاة" : "تهيئة الربط الفعلي", detail: environment === "simulation" ? "OTP ثم EC/CSR ثم شهادة Compliance" : "OTP إنتاجي واعتمادات Production مستقلة", done: environmentComplete },
    { id: 5, icon: "📋", title: "اختبارات المطابقة", detail: environment === "simulation" ? "بعد الحصول على Compliance CSID" : "اختبارات المطابقة الخاصة بالإنتاج", done: environment === "production" ? productionComplete : testsComplete },
    { id: 6, icon: "🔑", title: "CSID التشغيلي", detail: "بعد نجاح اختبارات المطابقة", done: environment === "production" ? productionComplete : operationalComplete },
    { id: 7, icon: "✅", title: "اكتمال الربط", detail: ENVIRONMENT_COPY[environment].shortTitle, done: environment === "production" ? productionComplete : operationalComplete },
  ];
  const steps = includeCompanyStep ? allSteps : allSteps.filter(step => step.id !== 1);
  const firstIncomplete = environment === "production"
    ? 7
    : steps.find(step => !step.done)?.id ?? 7;
  const linkingComplete = environment === "production" ? productionComplete : operationalComplete;
  const completed = steps.filter(step => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  useEffect(() => {
    if (includeCompanyStep && readiness?.savedSettings && !warehouseId) {
      setWarehouseId(String(readiness.savedSettings.warehouseId));
      setInvoiceType((readiness.savedSettings.invoiceType as typeof invoiceType) || "both");
      setSelectedUnitId(readiness.savedSettings.zatcaPosUnitId ?? units[0]?.id ?? null);
    }
  }, [readiness?.savedSettings, units, warehouseId]);

  type ReadinessJournal = {
    docType: string;
    label: string;
    found: boolean;
    linked: boolean;
    linkedUnitId: number | null;
    id: number | null;
    code: string | null;
    name: string | null;
    warehouseId: number | null;
    valid: boolean;
  };
  const readinessMatchesWarehouse = Boolean(
    warehouseId
    && readiness?.selectedWarehouseId === Number(warehouseId)
    && !readinessQ.isFetching,
  );
  const selectedWarehouseJournals: ReadinessJournal[] = (
    (readinessMatchesWarehouse ? (readiness?.journals ?? []) : []) as Array<Record<string, any>>
  ).map(entry => {
    const nestedJournal = (entry.journal ?? {}) as Record<string, any>;
    const id = entry.journalId ?? nestedJournal.id ?? null;
    const code = entry.journalCode ?? nestedJournal.code ?? null;
    const name = entry.journalName ?? nestedJournal.name ?? null;
    const journalWarehouseId = entry.journalWarehouseId ?? nestedJournal.warehouseId ?? null;
    const belongsToSelectedWarehouse = Boolean(
      warehouseId && journalWarehouseId === Number(warehouseId),
    );
    const linkedUnitId = entry.linkedUnitId ?? nestedJournal.zatcaPosUnitId ?? null;
    const belongsToSelectedUnit = Boolean(
      linkedUnitId == null || linkedUnitId === selectedWarehouseUnitId,
    );
    return {
      docType: entry.docType,
      label: entry.label ?? journalTypeLabel(entry.docType),
      found: Boolean(entry.found),
      linked: Boolean(entry.linked),
      linkedUnitId,
      id,
      code,
      name,
      warehouseId: journalWarehouseId,
      valid: Boolean(
        entry.found
        && id != null
        && code?.trim()
        && name?.trim()
        && belongsToSelectedWarehouse
        && belongsToSelectedUnit,
      ),
    };
  });
  const salesJournal = selectedWarehouseJournals.find(
    journal => journal.docType === "sales_invoice" && journal.valid,
  );
  const missingJournalTypes = requiredJournalTypes.filter(type =>
    !selectedWarehouseJournals.some(journal => journal.docType === type && journal.valid),
  );
  const conflictingJournalTypes = requiredJournalTypes.filter(type =>
    selectedWarehouseJournals.some(
      journal => journal.docType === type
        && journal.linkedUnitId != null
        && journal.linkedUnitId !== selectedWarehouseUnitId,
    ),
  );
  const canCreateUnit = Boolean(
    warehouseId
    && salesJournal
    && unitCode.trim()
    && unitName.trim()
    && missingJournalTypes.length === 0
    && conflictingJournalTypes.length === 0
    && selectedWarehouseJournals.every(journal => journal.valid),
  );

  const goTo = (step: number) => {
    if (environment !== "production" && step > firstIncomplete) {
      toast.warning("أكمل متطلبات المرحلة الحالية أولًا");
      return;
    }
    setActiveStep(step);
  };

  const saveStep = async () => {
    try {
      if (activeStep === 1) {
        if (!companyComplete) {
          toast.error(`البيانات الناقصة: ${missingCompanyFields.join("، ")}`);
          return;
        }
        setActiveStep(2);
        return;
      }
      if (activeStep === 2) {
        if (unitComplete) {
          setActiveStep(3);
          return;
        }
        if (!canCreateUnit || !salesJournal) {
          toast.error(
            missingJournalTypes.length
              ? `الدفاتر الناقصة: ${missingJournalTypes.map(journalTypeLabel).join("، ")}`
              : "اختر المخزن/الفرع وأكمل اسم ورمز وحدة الربط",
          );
          return;
        }
        setCreatingUnit(true);
        const created = await createUnitM.mutateAsync({
          journalId: salesJournal.id as number,
          unitCode: unitCode.trim(),
          unitName: unitName.trim(),
        });
        const [refreshedUnits] = await Promise.all([
          utils.zatca.listPosUnits.fetch(),
          utils.zatca.listPosUnits.invalidate(),
          utils.zatca.listLinkingJournalOptions.invalidate(),
          readinessQ.refetch(),
        ]);
        const savedUnit = refreshedUnits.find(unit => unit.id === created.id) ?? created;
        setCreatedUnit(savedUnit);
        setSelectedUnitId(savedUnit.id);
        toast.success("تم إنشاء الوحدة وربط الدفاتر الأربعة معًا");
        setActiveStep(3);
        return;
      }
      if (activeStep === 3) {
        if (!warehouseId || !selectedUnitId) {
          toast.error("اختر وحدة ربط قبل حفظ نوع الفواتير");
          return;
        }
        await saveReadinessM.mutateAsync({
          warehouseId: Number(warehouseId),
          invoiceType,
          zatcaPosUnitId: selectedUnitId,
        });
        await readinessQ.refetch();
        toast.success("تم حفظ نوع الفواتير");
        setActiveStep(4);
        return;
      }
      if (activeStep === 4) {
        if (environment === "production") {
          toast.info("تم فتح مسار Production مستقل. لا يتم إرسال OTP أو حفظ اعتماد إنتاجي من هذه النسخة قبل اعتماد بوابة Production الآمنة.");
          setActiveStep(5);
          return;
        }
        if (!simulationComplete) {
          toast.error("أدخل OTP وأنشئ EC/CSR واحصل على Compliance CSID أولًا");
          return;
        }
        setActiveStep(5);
        return;
      }
      if (activeStep === 5) {
        if (environment === "production") {
          toast.info("اختبارات المطابقة الخاصة بالإنتاج ستتاح بعد تهيئة اعتماد Production المستقل.");
          setActiveStep(6);
          return;
        }
        if (!testsComplete) {
          toast.error("لا يمكن المتابعة قبل نجاح اختبارات المطابقة المطلوبة");
          return;
        }
        setActiveStep(6);
        return;
      }
      if (activeStep === 6) {
        if (environment === "production") {
          toast.info("CSID التشغيلي للإنتاج سيُطلب من مسار Production بعد تهيئة الاعتماد.");
          setActiveStep(7);
          return;
        }
        if (!operationalComplete) {
          toast.error("اطلب CSID التشغيلي بعد نجاح اختبارات المطابقة أولًا");
          return;
        }
        setActiveStep(7);
        return;
      }
      if (activeStep === 7) {
        if (!linkingComplete) {
          if (environment === "production") {
            toast.info("مسار Production مفتوح للمراجعة، لكن التفعيل الفعلي محمي حتى اعتماد بوابة Production.");
          } else {
            toast.info("اكتملت المحاكاة. اختر الربط الفعلي من شاشة اختيار البيئة للانتقال إلى Production.");
          }
          return;
        }
        onFinishedLinking();
      }
    } catch (error: any) {
      toast.error(error?.message ?? "تعذر حفظ المرحلة");
    } finally {
      setCreatingUnit(false);
    }
  };

  const renderStep = () => {
    if (activeStep === 1) {
      return (
        <div>
          <SecTitle icon="🏢" title="بيانات المنشأة" />
          <div style={{ background: companyComplete ? "#f0fdf4" : "#fff7ed", border: `1px solid ${companyComplete ? "#bbf7d0" : "#fed7aa"}`, color: companyComplete ? "#166534" : "#9a3412", borderRadius: 10, padding: 13, marginBottom: 14, fontSize: 12, lineHeight: 1.8 }}>
            <strong>{companyComplete ? "بيانات المنشأة مكتملة وجاهزة للربط" : "بيانات المنشأة تحتاج إلى استكمال"}</strong>
            {!companyComplete && <div>الحقول الناقصة: {missingCompanyFields.join("، ")}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {companyFields.map(([label, value]) => (
              <div key={label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ color: "#64748b", fontSize: 10, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: value.trim() ? "#1e293b" : "#9a3412" }}>{value.trim() || "غير مكتمل"}</div>
              </div>
            ))}
          </div>
          {!companyComplete && onOpenCompanyInfo && (
            <button onClick={onOpenCompanyInfo} style={{ ...smallBtn, marginTop: 12, background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}>🏢 فتح معلومات المؤسسة</button>
          )}
        </div>
      );
    }
    if (activeStep === 2) {
      return (
        <div>
          <SecTitle icon="🧩" title="وحدة الربط والدفاتر" />
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 9, padding: 11, marginBottom: 14, fontSize: 11, lineHeight: 1.7 }}>
            المخزن هو نفسه الفرع في OneSoft. اختر موقعًا واحدًا، ثم راجع الدفاتر الأربعة التابعة له قبل الحفظ.
          </div>
          {unitComplete ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14, color: "#166534", fontSize: 12 }}>
              <strong>وحدة الربط مكتملة</strong>
              <div style={{ marginTop: 5 }}>{selectedUnit?.unitCode} — {selectedUnit?.unitName}</div>
              <div>الدفاتر المرتبطة: {unitJournals.map((journal: any) => journal.journalCode).join("، ")}</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8, alignItems: "end", marginBottom: 12 }}>
                <div>
                  <label style={lbl}>المخزن/الفرع *</label>
                  <select style={fld} value={warehouseId} onChange={event => {
                    const value = event.target.value;
                    const next = (readiness?.locations ?? []).find(location => location.id === Number(value));
                    const existingUnit = availableUnits.find(unit => unit.warehouseId === Number(value));
                    setWarehouseId(value);
                    setSelectedUnitId(existingUnit?.id ?? null);
                    setUnitCode(existingUnit?.unitCode ?? (next ? `POS-${String(next.id).padStart(2, "0")}` : ""));
                    setUnitName(existingUnit?.unitName ?? (next ? `وحدة ربط — ${next.label}` : ""));
                  }}>
                    <option value="">اختر المخزن/الفرع</option>
                    {(readiness?.locations ?? []).map(location => <option key={location.id} value={location.id}>{location.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>رمز الوحدة *</label>
                  <input style={fld} value={unitCode} onChange={event => setUnitCode(event.target.value)} placeholder="POS-01" />
                </div>
                <div>
                  <label style={lbl}>اسم الوحدة *</label>
                  <input style={fld} value={unitName} onChange={event => setUnitName(event.target.value)} placeholder="كاشير 1" />
                </div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 8 }}>مراجعة الدفاتر الأربعة</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 }}>
                  {requiredJournalTypes.map(type => {
                    const journal = selectedWarehouseJournals.find(item => item.docType === type);
                    const journalIsValid = Boolean(journal?.valid);
                    const journalSummary = journal
                      ? `${journal.code ?? "رقم غير متاح"} — ${journal.name ?? "اسم غير متاح"} — ${journalTypeLabel(type)} — ID: ${journal.id ?? "غير متاح"}`
                      : null;
                    return (
                      <div key={type} style={{ background: journalIsValid ? "#f0fdf4" : "#fff7ed", border: `1px solid ${journalIsValid ? "#bbf7d0" : "#fed7aa"}`, color: journalIsValid ? "#166534" : "#9a3412", borderRadius: 7, padding: "8px 10px", fontSize: 11 }}>
                        {journalIsValid ? "✓" : "!"} {journalTypeLabel(type)}
                        <div style={{ color: "#64748b", fontSize: 10, marginTop: 3 }}>
                          {journalIsValid
                            ? journalSummary
                            : journal?.linkedUnitId != null && journal.linkedUnitId !== selectedWarehouseUnitId
                              ? "مرتبط بوحدة أخرى — استكمل الوحدة الحالية من إدارة الدفاتر"
                              : journal
                                ? "بيانات الدفتر غير مكتملة أو لا تطابق المخزن المختار"
                                : "غير موجود في هذا المخزن"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {missingJournalTypes.length > 0 && warehouseId && (
                  <div style={{ marginTop: 9, color: "#9a3412", fontSize: 11 }}>
                    الدفاتر الناقصة أو غير الصالحة: {missingJournalTypes.map(type => `دفتر ${journalTypeLabel(type)} غير موجود`).join("، ")}
                  </div>
                )}
                {conflictingJournalTypes.length > 0 && (
                  <div style={{ marginTop: 7, color: "#9a3412", fontSize: 11 }}>
                    يوجد تعارض في: {conflictingJournalTypes.map(journalTypeLabel).join("، ")}. لا يمكن إنشاء وحدة مكررة.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      );
    }
    if (activeStep === 3) {
      return (
        <div>
          <SecTitle icon="🧾" title="نوع الفواتير" />
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: 11, marginBottom: 14, fontSize: 11, lineHeight: 1.8 }}>
            <strong>{selectedUnit?.unitName ?? "وحدة الربط"}</strong>
            <div>المخزن/الفرع: {selectedUnit ? locationLabel(selectedUnit) : "—"}</div>
            <div>الدفاتر المرتبطة: {unitJournals.length} من 4</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              ["simplified", "فواتير مبسطة", "مبيعات الأفراد ونقاط البيع."],
              ["standard", "فواتير عادية/قياسية", "مبيعات المنشآت."],
              ["both", "كلاهما", "عند البيع للأفراد والمنشآت."],
            ].map(([value, title, detail]) => (
              <label key={value} style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${invoiceType === value ? "#D19C05" : "#e2e8f0"}`, background: invoiceType === value ? "#fffbeb" : "#fff", borderRadius: 9, padding: 11, cursor: "pointer" }}>
                <input type="radio" checked={invoiceType === value} onChange={() => setInvoiceType(value as typeof invoiceType)} />
                <span><strong style={{ display: "block", fontSize: 12 }}>{title}</strong><span style={{ color: "#64748b", fontSize: 11 }}>{detail}</span></span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (activeStep === 4) {
      if (environment === "production") {
        return (
          <div>
            <SecTitle icon="🚀" title="تهيئة الربط الفعلي — Production" />
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", borderRadius: 9, padding: 13, marginBottom: 13, fontSize: 11, lineHeight: 1.8 }}>
              <strong>هذا مسار مستقل عن Fatoora Simulation.</strong>
              <div>سيتم استخدام بيانات المنشأة الحقيقية وOTP صادر من منصة فاتورة الفعلية عند إتاحة بوابة Production.</div>
              <div style={{ marginTop: 5 }}>لا يتم نسخ شهادة أو CSID أو Secret أو مفتاح من المحاكاة إلى الإنتاج.</div>
            </div>
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 9, padding: 12, fontSize: 11, lineHeight: 1.8 }}>
              بدء الربط الفعلي يتطلب تأكيدًا صريحًا من المسؤول. هذه النسخة تفتح المعالج وتعرض الحالة فقط، ولا ترسل OTP أو تحفظ اعتمادًا إنتاجيًا.
            </div>
          </div>
        );
      }
      return <OtpSimulationSection initialPosUnitId={selectedUnitId} />;
    }
    if (activeStep === 5) {
      if (environment === "production") {
        return (
          <div>
            <SecTitle icon="📋" title="اختبارات المطابقة — Production" />
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 9, padding: 13, fontSize: 11, lineHeight: 1.8 }}>
              اختبارات Production منفصلة عن نتائج المحاكاة. ستظهر هنا بعد تهيئة اعتماد Production، ولن تستخدم نتائج المحاكاة كبديل.
            </div>
          </div>
        );
      }
      return (
        <ComplianceTestsSection
          posUnitId={selectedUnitId}
          invoiceType={invoiceType}
          warehouseId={selectedWarehouseNumber}
        />
      );
    }
    if (activeStep === 6) {
      if (environment === "production") {
        return (
          <div>
            <SecTitle icon="🔑" title="CSID التشغيلي — Production" />
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 9, padding: 13, fontSize: 11, lineHeight: 1.8 }}>
              لا يتم طلب CSID التشغيلي للإنتاج من اعتماد المحاكاة. سيُنشأ من مسار Production المستقل بعد نجاح اختبارات Production.
            </div>
          </div>
        );
      }
      return (
        <div>
          <SecTitle icon="🔑" title="طلب CSID التشغيلي" />
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 9, padding: 11, marginBottom: 13, color: "#1e40af", fontSize: 11, lineHeight: 1.7 }}>
            لا يُطلب CSID التشغيلي إلا بعد نجاح اختبارات المطابقة الرسمية. يستخدم الخادم Compliance CSID المحفوظ داخليًا.
          </div>
          <OtpSimulationSection initialPosUnitId={selectedUnitId} allowOperational />
        </div>
      );
    }
    return (
      <div>
        <SecTitle icon={environment === "production" ? "✅" : "🚀"} title={environment === "production" ? "اكتمال الربط الفعلي" : "اكتمال الاختبار التجريبي"} />
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, fontSize: 11, lineHeight: 1.9 }}>
          <div><strong>الوحدة:</strong> {selectedUnit?.unitName ?? "—"}</div>
          <div><strong>المخزن/الفرع:</strong> {selectedUnit ? locationLabel(selectedUnit) : "—"}</div>
          <div><strong>الدفاتر:</strong> {unitJournals.length} من 4</div>
          <div><strong>البيئة:</strong> {ENVIRONMENT_COPY[environment].shortTitle}</div>
          <div><strong>مواد التوقيع:</strong> {environment === "simulation" ? (simulationComplete ? "الشهادة والمفتاح متطابقان" : "الشهادة أو تطابق المفتاح غير مكتمل") : (environmentStatus?.certificatePresent ? "شهادة Production موجودة" : "لم تُهيأ شهادة Production")}</div>
          <div><strong>الحالة:</strong> {environmentStatus?.registrationStatus === "operational" ? "مفعّلة" : "غير مفعّلة"}</div>
        </div>
        <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 9, padding: 12, marginTop: 12, color: "#9a3412", fontSize: 11, lineHeight: 1.8 }}>
          {environment === "production"
            ? "لن تُرسل فواتير حقيقية قبل تهيئة اعتماد Production المستقل واجتياز بوابات الأمان والمطابقة."
            : "اكتملت المحاكاة بشكل مستقل. لا يعني ذلك تفعيل الإنتاج؛ اختر الربط الفعلي لبدء مسار Production مستقل."}
        </div>
        <button
          disabled={!linkingComplete}
          onClick={saveStep}
          style={{ ...smallBtn, height: 32, marginTop: 12, background: linkingComplete ? "#16a34a" : "#cbd5e1", color: "#fff", cursor: linkingComplete ? "pointer" : "not-allowed" }}
        >
          {environment === "production" ? "تأكيد اكتمال الربط الفعلي" : "إنهاء الاختبار التجريبي"}
        </button>
        {onOpenTechnical && <button onClick={onOpenTechnical} style={{ ...smallBtn, marginTop: 12, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>مراجعة إعدادات الربط</button>}
      </div>
    );
  };

  return (
    <div>
       <div style={{ background: `linear-gradient(135deg,${ENVIRONMENT_COPY[environment].color},${environment === "production" ? "#166534" : "#1d4ed8"})`, color: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ fontSize: 28 }}>🔗</div>
           <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800 }}>معالج التفعيل والربط</div><div style={{ color: "#e0f2fe", fontSize: 11, marginTop: 3 }}>{ENVIRONMENT_COPY[environment].shortTitle} — محتوى المرحلة الحالية فقط.</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 23, fontWeight: 800, color: "#f7d47b" }}>{progress}%</div><div style={{ color: "#dbeafe", fontSize: 10 }}>{completed} من {steps.length} مراحل</div></div>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,.18)", borderRadius: 5, marginTop: 15 }}><div style={{ height: "100%", width: `${progress}%`, background: "#f2c75c", borderRadius: 5 }} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(120px, 1fr))`, gap: 7, marginBottom: 14, overflowX: "auto" }}>
        {steps.map(step => (
          <button key={step.id} onClick={() => goTo(step.id)} style={{ minHeight: 92, textAlign: "right", background: activeStep === step.id ? "#fffbeb" : "#fff", border: `1px solid ${activeStep === step.id ? "#D19C05" : "#e2e8f0"}`, borderTop: `3px solid ${step.done ? "#16a34a" : activeStep === step.id ? "#D19C05" : "#cbd5e1"}`, borderRadius: 9, padding: "8px 8px", cursor: step.id <= firstIncomplete ? "pointer" : "not-allowed", opacity: step.id <= firstIncomplete ? 1 : .55 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>{step.icon}</span><span style={{ fontSize: 10, color: step.done ? "#16a34a" : "#64748b" }}>{step.done ? "✓" : step.id}</span></div>
            <strong style={{ display: "block", fontSize: 10, color: "#1e293b", marginTop: 7 }}>{step.title}</strong>
            <span style={{ display: "block", fontSize: 9, lineHeight: 1.4, color: "#64748b", marginTop: 3 }}>{step.detail}</span>
          </button>
        ))}
      </div>
      {renderStep()}
      <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 13, borderTop: "1px solid #e2e8f0" }}>
        <button disabled={activeStep === (includeCompanyStep ? 1 : 2)} onClick={() => setActiveStep(step => Math.max(includeCompanyStep ? 1 : 2, step - 1))} style={{ ...smallBtn, height: 32, background: "#f1f5f9", color: "#475569", opacity: activeStep === (includeCompanyStep ? 1 : 2) ? .5 : 1 }}>السابق</button>
         <button disabled={creatingUnit || saveReadinessM.isPending || (environment !== "production" && activeStep > firstIncomplete)} onClick={saveStep} style={{ ...smallBtn, height: 32, padding: "0 18px", background: ENVIRONMENT_COPY[environment].color, color: "#fff", opacity: creatingUnit || saveReadinessM.isPending || (environment !== "production" && activeStep > firstIncomplete) ? .55 : 1 }}>
          {creatingUnit ? "جارٍ حفظ الوحدة..." : activeStep === 2 ? "حفظ الوحدة ومتابعة" : "حفظ ومتابعة"}
        </button>
         <button disabled={activeStep === 7 || activeStep >= firstIncomplete} onClick={() => setActiveStep(step => Math.min(7, step + 1))} style={{ ...smallBtn, height: 32, marginRight: "auto", background: "#f1f5f9", color: "#475569", opacity: activeStep === 7 || activeStep >= firstIncomplete ? .5 : 1 }}>التالي →</button>
      </div>
    </div>
  );
}

function LinkingUnitsManagement({
  cfg,
  units,
  environment,
  onContinue,
  onChangeEnvironment,
}: {
  cfg: any;
  units: any[];
  environment: LinkingEnvironment;
  onContinue: () => void;
  onChangeEnvironment: () => void;
}) {
  const [addingUnit, setAddingUnit] = useState(false);
  if (addingUnit) {
    return (
      <ActivationWizard
        cfg={cfg}
        units={units}
        environment={environment}
        includeCompanyStep={false}
        onFinishedLinking={() => setAddingUnit(false)}
      />
    );
  }
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg,#1e4f7a,#2f6b96)", color: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28 }}>🧩</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 800 }}>إدارة وحدات الربط</div><div style={{ color: "#dbeafe", fontSize: 11, marginTop: 3 }}>أدر الوحدات الحالية وأكمل دفاتر أي وحدة ناقصة دون إنشاء وحدة مكررة.</div></div>
          <button onClick={() => setAddingUnit(true)} style={{ ...smallBtn, height: 32, background: "#f2c75c", color: "#1e293b", fontWeight: 800 }}>＋ إضافة وحدة ربط جديدة</button>
          <button onClick={onContinue} style={{ ...smallBtn, height: 32, background: "#f2c75c", color: "#1e293b", fontWeight: 800 }}>متابعة معالج التفعيل</button>
           <button onClick={onChangeEnvironment} style={{ ...smallBtn, height: 32, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.35)" }}>تغيير البيئة</button>
        </div>
      </div>
      <LinkingUnitsSection onActivate={onContinue} />
    </div>
  );
}

function EnvironmentSelection({
  units,
  onSelect,
}: {
  units: any[];
  onSelect: (environment: LinkingEnvironment) => void;
}) {
  const simulationReady = units.some(unit => (
    unit.environmentStatuses?.simulation?.registrationStatus === "operational"
    || unit.environmentStatuses?.simulation?.certificatePresent
  ));
  const productionReady = units.some(unit => (
    unit.environmentStatuses?.production?.registrationStatus === "operational"
    || unit.environmentStatuses?.production?.certificatePresent
  ));

  return (
    <div>
      <SecTitle icon="🔗" title="اختيار نوع التفعيل" />
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", marginBottom: 14, color: "#475569", fontSize: 12, lineHeight: 1.8 }}>
        اختر بيئة الربط قبل الدخول إلى المعالج. يمكن بدء الربط الفعلي مباشرة دون اجتياز الاختبار التجريبي، وتبقى بيانات كل بيئة مستقلة.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", gap: 14, alignItems: "stretch" }}>
        <div style={{ background: "#fff", border: "2px solid #86efac", borderRadius: 14, padding: 18, boxShadow: "0 8px 22px rgba(21,128,61,.10)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 22, marginBottom: 5 }}>🚀</div>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#166534" }}>{ENVIRONMENT_COPY.production.fullTitle}</div>
            </div>
            <span style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: 999, padding: "4px 9px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>إنتاج فعلي</span>
          </div>
          <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.8, marginBottom: 11 }}>{ENVIRONMENT_COPY.production.description}</div>
          <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: "9px 10px", fontSize: 11, lineHeight: 1.75, marginBottom: 13 }}>
            سيتم استخدام بيانات المنشأة الحقيقية وOTP صادر من منصة فاتورة الفعلية، وبعد اكتمال التهيئة تصبح الوحدة جاهزة لإرسال الفواتير الحقيقية.
          </div>
          <div style={{ fontSize: 10, color: productionReady ? "#166534" : "#64748b", marginBottom: 12 }}>
            {productionReady ? "✓ توجد بيانات ربط فعلي محفوظة لهذه الوحدة" : "○ لا توجد بيانات ربط فعلي بعد"}
          </div>
          <button onClick={() => onSelect("production")} style={{ width: "100%", height: 38, background: "#15803d", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            بدء الربط الفعلي
          </button>
        </div>

        <div style={{ background: "#fff", border: "1px solid #93c5fd", borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 22, marginBottom: 5 }}>🧪</div>
              <div style={{ fontWeight: 900, fontSize: 16, color: "#1d4ed8" }}>{ENVIRONMENT_COPY.simulation.fullTitle}</div>
            </div>
            <span style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 999, padding: "4px 9px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>اختياري — للاختبار والدعم الفني</span>
          </div>
          <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.8, marginBottom: 10 }}>{ENVIRONMENT_COPY.simulation.description}</div>
          <ul style={{ margin: "0 0 12px", paddingRight: 18, color: "#475569", fontSize: 11, lineHeight: 1.85 }}>
            <li>لا يتم إرسال فواتير حقيقية.</li>
            <li>لا يتم تفعيل الوحدة في الإنتاج الفعلي.</li>
            <li>تحتاج إلى OTP صادر من منصة Fatoora Simulation.</li>
            <li>الشهادات وCSID الناتجة تخص بيئة المحاكاة فقط.</li>
            <li>يمكن تجاوز هذا الاختيار والدخول مباشرة إلى الربط الفعلي.</li>
          </ul>
          <div style={{ fontSize: 10, color: simulationReady ? "#166534" : "#64748b", marginBottom: 12 }}>
            {simulationReady ? "✓ الاختبار التجريبي مكتمل أو مهيأ لهذه الوحدة" : "○ لم يبدأ الاختبار التجريبي بعد"}
          </div>
          <button onClick={() => onSelect("simulation")} style={{ width: "100%", height: 38, background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
            بدء الاختبار التجريبي
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivationSection({
  onOpenCompanyInfo,
  onOpenTechnical,
}: {
  onOpenCompanyInfo?: () => void;
  onOpenTechnical?: () => void;
}) {
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const [wizardMode, setWizardMode] = useState<boolean | null>(null);
  const [environment, setEnvironment] = useState<LinkingEnvironment | null>(null);
  const cfg = cfgQ.data;
  const units = unitsQ.data ?? [];
  useEffect(() => {
    if (wizardMode === null && !unitsQ.isLoading) setWizardMode(units.length === 0);
  }, [wizardMode, unitsQ.isLoading, units.length]);
  if (wizardMode === null || cfgQ.isLoading || unitsQ.isLoading) return <Skeleton height={280} />;
  if (environment === null) {
    return (
      <EnvironmentSelection
        units={units}
        onSelect={nextEnvironment => {
          setEnvironment(nextEnvironment);
          setWizardMode(units.length === 0);
        }}
      />
    );
  }
  if (!wizardMode) {
    return (
      <LinkingUnitsManagement
        cfg={cfg}
        units={units}
        environment={environment}
        onContinue={() => setWizardMode(true)}
        onChangeEnvironment={() => {
          setWizardMode(false);
          setEnvironment(null);
        }}
      />
    );
  }
  return (
    <ActivationWizard
      cfg={cfg}
      units={units}
      environment={environment}
      onOpenCompanyInfo={onOpenCompanyInfo}
      onOpenTechnical={onOpenTechnical}
      onFinishedLinking={() => {
        setWizardMode(false);
        setEnvironment(null);
      }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// الواجهة النهائية: التقارير والمتابعة
// ══════════════════════════════════════════════════════════════════════════════
function FollowupSection({ onOpenTechnical }: { onOpenTechnical?: () => void }) {
  const statsQ = trpc.zatca.getStats.useQuery();
  const unitsQ = trpc.zatca.listPosUnits.useQuery();
  const journalsQ = trpc.zatca.listLinkingJournalOptions.useQuery();
  const [status, setStatus] = useState("");
  const [invoiceType, setInvoiceType] = useState<"" | "standard" | "simplified">("");
  const [warehouseId, setWarehouseId] = useState("");
  const [journalId, setJournalId] = useState("");
  const [posUnitId, setPosUnitId] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listQ = trpc.zatca.getInvoicesList.useQuery({
    page: 1,
    limit: 100,
    status: status || undefined,
    zatcaInvoiceType: invoiceType || undefined,
    warehouseId: warehouseId ? Number(warehouseId) : undefined,
    journalId: journalId ? Number(journalId) : undefined,
    posUnitId: posUnitId ? Number(posUnitId) : undefined,
  });
  const detailQ = trpc.zatca.getLifecycle.useQuery({ invoiceId: selectedId! }, { enabled: selectedId != null });
  const retryM = trpc.zatca.retryInvoice.useMutation({
    onSuccess: () => { toast.success("تمت جدولة إعادة الإرسال بنفس المعاملة"); listQ.refetch(); detailQ.refetch(); },
    onError: error => toast.error(error.message),
  });
  const stats = statsQ.data;
  const rows = listQ.data?.invoices ?? [];
  const journals = journalsQ.data ?? [];
  const locations = Array.from(new Map(journals.filter(item => item.warehouseId != null).map(item => [item.warehouseId, item])).values());
  const selected = detailQ.data;
  const transaction = selected?.transaction;
  const selectedRow = rows.find(row => row.id === selectedId);
  const summary: Array<[string, number, string, string]> = [
    ["جاهزة للإرسال", stats?.readyToSubmit ?? 0, "#64748b", "📭"],
    ["مقبولة", (stats?.cleared ?? 0) + (stats?.reported ?? 0), "#16a34a", "✅"],
    ["مقبولة مع تحذيرات", stats?.acceptedWithWarnings ?? 0, "#ca8a04", "⚠️"],
    ["مرفوضة", stats?.rejected ?? 0, "#dc2626", "⛔"],
    ["معلقة", (stats?.pending ?? 0) + (stats?.submittedPending ?? 0) + (stats?.submitting ?? 0), "#d97706", "⏳"],
    ["غير مؤكدة", (stats?.uncertain ?? 0) + (stats?.connectionIssue ?? 0) + (stats?.retryPending ?? 0), "#9333ea", "❔"],
    ["لم تُرسل", stats?.notSubmitted ?? 0, "#475569", "📄"],
  ];
  const retryableStates = ["submitted_pending", "connection_issue", "retry_pending", "uncertain", "pending", "submitting"];
  const canResend = Boolean(selectedRow && transaction && retryableStates.includes(selectedRow.zatcaStatus ?? ""));
  const downloadDiagnostic = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zatca-diagnostic-${selected.invoice.invoiceNumber}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg,#334155,#475569)", color: "#fff", borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", fontSize: 26 }}>📊</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>التقارير والمتابعة</div>
            <div style={{ color: "#e2e8f0", fontSize: 12, marginTop: 4 }}>تابع دورة كل فاتورة، راجع التنبيهات، وأعد الإرسال عند السماح.</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(105px, 1fr))", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {summary.map(([label, value, color, icon]) => (
          <button key={String(label)} onClick={() => setStatus(label === "جاهزة للإرسال" ? "ready_to_submit" : label === "مقبولة" ? "cleared" : label === "مرفوضة" ? "rejected" : label === "غير مؤكدة" ? "uncertain" : "")} style={{ background: "#fff", border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 9, padding: "10px 7px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 18 }}>{icon}</div>
            <div style={{ color, fontSize: 20, fontWeight: 800, marginTop: 3 }}>{value}</div>
            <div style={{ color: "#475569", fontSize: 10, marginTop: 3 }}>{label}</div>
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <strong style={{ fontSize: 12, color: "#1e293b" }}>الفواتير الإلكترونية</strong>
          <button onClick={() => listQ.refetch()} style={{ ...smallBtn, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" }}>🔄 تحديث</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 7 }}>
          <select style={fld} value={status} onChange={e => setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(STATUS_MAP).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
          <select style={fld} value={invoiceType} onChange={e => setInvoiceType(e.target.value as typeof invoiceType)}><option value="">كل أنواع الفواتير</option><option value="simplified">مبسطة — Reporting</option><option value="standard">قياسية — Clearance</option></select>
          <select style={fld} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">كل الفروع والمخازن</option>{locations.map(item => <option key={String(item.warehouseId)} value={String(item.warehouseId)}>{locationLabel(item)}</option>)}</select>
          <select style={fld} value={posUnitId} onChange={e => setPosUnitId(e.target.value)}><option value="">كل نقاط البيع</option>{(unitsQ.data ?? []).map(unit => <option key={unit.id} value={unit.id}>{unit.unitName}</option>)}</select>
          <select style={fld} value={journalId} onChange={e => setJournalId(e.target.value)}><option value="">كل الدفاتر</option>{journals.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0, 1fr) 350px" : "1fr", gap: 12, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>{["الفاتورة", "التاريخ", "الفرع / الوحدة", "النوع", "الإجمالي", "الحالة", "الإجراء"].map(head => <th key={head} style={{ padding: "8px 9px", textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>{head}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const final = ["cleared", "reported", "accepted_with_warnings", "rejected"].includes(row.zatcaStatus ?? "");
                return <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: "pointer", background: selectedId === row.id ? "#fffbeb" : index % 2 ? "#fafafa" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 9px", fontWeight: 800, color: "#1e4f7a" }}>{row.invoiceNumber}</td>
                  <td style={{ padding: "8px 9px", color: "#64748b", whiteSpace: "nowrap" }}>{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString("ar-SA") : "—"}</td>
                  <td style={{ padding: "8px 9px" }}><div>{row.branchName ?? row.warehouseName ?? "—"}</div><div style={{ color: "#94a3b8", fontSize: 9 }}>{row.posUnitId ? `وحدة ${row.posUnitId}` : "غير مرتبطة"}</div></td>
                  <td style={{ padding: "8px 9px" }}>{row.zatcaInvoiceType === "standard" ? "قياسية" : "مبسطة"}</td>
                  <td style={{ padding: "8px 9px", direction: "ltr", textAlign: "left" }}>{Number(row.total ?? 0).toFixed(2)} SAR</td>
                  <td style={{ padding: "8px 9px" }}><StatusBadge status={row.zatcaStatus} /></td>
                  <td style={{ padding: "8px 9px", whiteSpace: "nowrap" }}>{retryableStates.includes(row.zatcaStatus ?? "") && <button onClick={event => { event.stopPropagation(); retryM.mutate({ invoiceId: row.id }); }} disabled={retryM.isPending} style={{ ...smallBtn, background: "#1e4f7a", color: "#fff" }}>إعادة إرسال</button>}</td>
                </tr>;
              })}
              {!rows.length && <tr><td colSpan={7} style={{ padding: 34, textAlign: "center", color: "#94a3b8" }}>لا توجد فواتير بهذه الفلاتر</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, padding: 13, position: "sticky", top: 0, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
              <div><strong style={{ display: "block", fontSize: 14 }}>فاتورة {selected.invoice.invoiceNumber}</strong><span style={{ fontSize: 10, color: "#64748b" }}>{selectedRow?.customerName ?? "—"}</span></div>
              <button onClick={() => setSelectedId(null)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 16 }}>×</button>
            </div>
            <StatusBadge status={selected.invoice.zatcaStatus} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
              {[["UUID", selected.invoice.zatcaUuid], ["Correlation ID", transaction?.correlationId], ["نوع العملية", transaction?.submissionType === "clearance" ? "Clearance" : "Reporting"], ["رد الهيئة", transaction?.authorityStatus], ["المحاولات", transaction?.attemptCount ?? selected.invoice.zatcaAttemptCount], ["آخر رد", transaction?.responseDate ? new Date(transaction.responseDate).toLocaleString("ar-SA") : "لم يصل"]].map(([label, value]) => <div key={String(label)} style={{ background: "#f8fafc", borderRadius: 6, padding: 7 }}><div style={{ color: "#64748b", fontSize: 9 }}>{label}</div><div style={{ color: "#1e293b", fontSize: 10, fontFamily: "monospace", wordBreak: "break-all", marginTop: 3 }}>{String(value ?? "—")}</div></div>)}
            </div>
            {(transaction?.lastError || selected.invoice.zatcaRejectionReason) && <div style={{ background: "#fef2f2", color: "#991b1b", borderRadius: 6, padding: 8, marginTop: 8, fontSize: 10 }}>{transaction?.lastError ?? selected.invoice.zatcaRejectionReason}</div>}
            <details style={{ marginTop: 9 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 11 }}>XML وQR</summary><div style={{ marginTop: 7 }}><div style={{ color: "#64748b", fontSize: 9 }}>QR</div><code style={{ display: "block", background: "#f8fafc", padding: 6, fontSize: 9, wordBreak: "break-all" }}>{selected.invoice.zatcaQrCode ?? "غير متوفر"}</code><div style={{ color: "#64748b", fontSize: 9, marginTop: 7 }}>XML</div><pre style={{ maxHeight: 150, overflow: "auto", background: "#1e293b", color: "#e2e8f0", padding: 7, fontSize: 8, whiteSpace: "pre-wrap" }}>{selected.invoice.zatcaXml ?? "غير متوفر"}</pre></div></details>
            <details style={{ marginTop: 9 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 11 }}>سجل المحاولات والأخطاء</summary><div style={{ marginTop: 6, fontSize: 10 }}>{(selected.attempts ?? []).map(item => <div key={item.id} style={{ padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>محاولة #{item.attemptNumber} · {item.result} · {new Date(item.startedAt).toLocaleString("ar-SA")}</div>)}{(selected.errors ?? []).map(item => <div key={item.id} style={{ padding: "5px 0", color: "#b91c1c" }}>{item.errorCode}: {item.errorMessage}</div>)}{!selected.attempts?.length && !selected.errors?.length && <span style={{ color: "#94a3b8" }}>لا يوجد سجل إضافي</span>}</div></details>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {canResend && <button onClick={() => retryM.mutate({ invoiceId: selected.invoice.id })} disabled={retryM.isPending} style={{ ...smallBtn, height: 30, background: "#D19C05", color: "#fff" }}>↩ إعادة الإرسال</button>}
              <button onClick={downloadDiagnostic} style={{ ...smallBtn, height: 30, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>📥 تصدير التشخيص</button>
              {onOpenTechnical && <button onClick={onOpenTechnical} style={{ ...smallBtn, height: 30, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>⚙️ أدوات متقدمة</button>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
export default function ZatcaCenterPage({
  onOpenCompanyInfo,
  initialSection,
}: {
  onOpenCompanyInfo?: () => void;
  initialSection?: Section;
} = {}) {
  const [active, setActive]      = useState<Section>(initialSection && initialSection !== "dashboard" ? initialSection : "activation");
  const [showWizard, setShowWizard] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const statsQ = trpc.zatca.getStats.useQuery();
  const canOpenTechnical = Boolean(cfgQ.data?.isAdmin);

  const navigateTo = (sec: Section) => setActive(sec);

  function renderSection() {
    switch (active) {
      case "activation": return <ActivationSection onOpenCompanyInfo={onOpenCompanyInfo} onOpenTechnical={canOpenTechnical ? () => { setTechnicalOpen(true); setActive("compliance"); } : undefined} />;
      case "followup":   return <FollowupSection onOpenTechnical={canOpenTechnical ? () => { setTechnicalOpen(true); setActive("compliance"); } : undefined} />;
      case "dashboard": return <DashboardSection onStartSetup={() => setShowWizard(true)} onNavigate={navigateTo} />;
      case "readiness": return <ReadinessSection onNavigate={navigateTo} onOpenCompanyInfo={onOpenCompanyInfo} />;
      case "units":     return <LinkingUnitsSection onActivate={() => setActive("otp-sim")} />;
      case "otp-sim":   return <OtpSimulationSection />;
      case "env":       return <EnvSection />;
      case "devices":   return <DevicesSection />;
      case "certs":     return <CertsSection />;
      case "keys":      return <KeysSection />;
      case "xmlcheck":  return <XmlCheckSection />;
      case "csr":       return <CsrSection />;
      case "register":  return <RegisterSection />;
      case "csid":      return <CsidSection />;
      case "test":      return <TestSection />;
      case "compliance": return <ComplianceTestsSection />;
      case "send":      return <SendSection />;
      case "tracking":  return <TrackingSection />;
      case "uncertain": return <UncertainSection />;
      case "oplogs":    return <LogsSection errorsOnly={false} />;
      case "errlogs":   return <LogsSection errorsOnly={true} />;
      case "diag":      return <DiagSection />;
      case "reports":   return <ReportsSection />;
      case "support":   return (
        <div>
          <SecTitle icon="🛟" title="الدعم الفني" />
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, color: "#475569", fontSize: 12, lineHeight: 1.9 }}>
            <strong style={{ color: "#1e293b" }}>هل تحتاج إلى مساعدة؟</strong>
            <p style={{ margin: "6px 0 0" }}>راجع الحالات غير المؤكدة والمشاكل والتنبيهات أولًا. لا يتم تشغيل OTP أو الاتصال الفعلي من هذا المركز.</p>
          </div>
        </div>
      );
      default:          return null;
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif", direction: "rtl" }}>

      {/* الـ Wizard */}
      {showWizard && (
        <SetupWizard
          onClose={() => setShowWizard(false)}
          onNavigate={(sec) => { setActive(sec); setShowWizard(false); }}
          cfg={cfgQ.data}
          stats={statsQ.data}
        />
      )}

      {/* الشريط الجانبي */}
      <div style={{ width: 188, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* رأس الشريط */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg,#1e293b,#334155)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#D19C05" }}>🏛️ مركز الفوترة الإلكترونية – ZATCA</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>هيئة الزكاة والضريبة والجمارك</div>
        </div>

        {/* زر معالج الإعداد */}
        {canOpenTechnical && <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={() => setShowWizard(true)}
            style={{ width: "100%", height: 34, background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            ▶ معالج الإعداد
          </button>
        </div>}

        {/* قائمة الأقسام الأساسية والتفاصيل الفنية */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {PRIMARY_SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActive(sec.id)}
              style={{ width: "100%", textAlign: "right", padding: "8px 12px", border: "none", background: active === sec.id ? "#fef3c7" : "transparent", borderRight: `3px solid ${active === sec.id ? "#D19C05" : "transparent"}`, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 11, fontWeight: active === sec.id ? 700 : 500, color: active === sec.id ? "#D19C05" : "#374151", transition: "all 0.1s" }}>
              <span style={{ fontSize: 16 }}>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          ))}
          {canOpenTechnical && <button onClick={() => setTechnicalOpen(value => !value)}
            style={{ width: "100%", textAlign: "right", padding: "9px 12px", marginTop: 4, border: "none", borderTop: "1px solid #e2e8f0", background: technicalOpen ? "#f8fafc" : "transparent", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 11, fontWeight: 700, color: "#475569" }}>
            <span style={{ fontSize: 15 }}>⚙️</span>
             <span style={{ flex: 1 }}>خيارات متقدمة</span>
            <span>{technicalOpen ? "⌃" : "⌄"}</span>
          </button>}
          {canOpenTechnical && technicalOpen && TECHNICAL_SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActive(sec.id)}
              style={{ width: "100%", textAlign: "right", padding: "7px 24px", border: "none", background: active === sec.id ? "#fef3c7" : "transparent", borderRight: `3px solid ${active === sec.id ? "#D19C05" : "transparent"}`, cursor: "pointer", display: "flex", gap: 7, alignItems: "center", fontSize: 10, fontWeight: active === sec.id ? 700 : 500, color: active === sec.id ? "#D19C05" : "#64748b" }}>
              <span>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 11, fontWeight: 700 }}>
          المحاكاة الرسمية للهيئة مرحلة اعتماد قبل الإنتاج. لا يتم تفعيل الإنتاج إلا بعد اكتمال المطابقة واعتماد المسؤول.
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
