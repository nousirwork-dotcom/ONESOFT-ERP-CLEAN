/**
 * ZatcaCenterPage.tsx — مركز التكامل مع هيئة الزكاة والضريبة والجمارك
 * النسخة 2.0: Workflow متكامل + مؤشرات الحالة + لوحة تحكم محسّنة
 */
import React, { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type Section =
  | "dashboard" | "env" | "devices" | "certs" | "keys"
  | "xmlcheck"  | "csr" | "register" | "csid" | "test"
  | "send"      | "oplogs" | "errlogs" | "diag" | "reports";

type SetupStepStatus = "done" | "active" | "pending" | "error";

// ─── قائمة الأقسام ────────────────────────────────────────────────────────────
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "لوحة التحكم",            icon: "🏠" },
  { id: "env",       label: "إعدادات البيئة",          icon: "🌐" },
  { id: "devices",   label: "إدارة الأجهزة (EGS)",     icon: "💻" },
  { id: "certs",     label: "إدارة الشهادات",          icon: "🛡️" },
  { id: "keys",      label: "مفاتيح التشفير",          icon: "🔐" },
  { id: "xmlcheck",  label: "التحقق من XML",           icon: "🔎" },
  { id: "csr",       label: "إنشاء CSR",              icon: "📜" },
  { id: "register",  label: "تسجيل الجهاز",            icon: "📱" },
  { id: "csid",      label: "إدارة CSID",             icon: "🔑" },
  { id: "test",      label: "اختبار الاتصال",          icon: "🔌" },
  { id: "send",      label: "إرسال الفواتير",          icon: "📤" },
  { id: "oplogs",    label: "سجل الإرسال",             icon: "📋" },
  { id: "errlogs",   label: "سجل الأخطاء",            icon: "🚨" },
  { id: "diag",      label: "أدوات التشخيص",          icon: "🔬" },
  { id: "reports",   label: "التقارير",               icon: "📊" },
];

// ─── خطوات الإعداد ────────────────────────────────────────────────────────────
const SETUP_STEPS: { id: number; label: string; sublabel: string; section: Section; icon: string }[] = [
  { id: 1,  label: "اختيار البيئة",         sublabel: "Sandbox أو Production", section: "env",      icon: "🌐" },
  { id: 2,  label: "إنشاء CSR",             sublabel: "Certificate Signing Request", section: "csr", icon: "📜" },
  { id: 3,  label: "إرسال CSR للهيئة",      sublabel: "عبر بوابة ZATCA",       section: "csr",      icon: "📤" },
  { id: 4,  label: "استلام الشهادة",        sublabel: "Public Certificate",    section: "certs",    icon: "🛡️" },
  { id: 5,  label: "حفظ الشهادة العامة",    sublabel: "Public Certificate PEM", section: "certs",   icon: "📋" },
  { id: 6,  label: "إنشاء / حفظ Secret Key",sublabel: "مفتاح التوثيق",        section: "csid",     icon: "🗝️" },
  { id: 7,  label: "تسجيل الجهاز (EGS)",   sublabel: "ربط الجهاز بالهيئة",   section: "register", icon: "📱" },
  { id: 8,  label: "اختبار الاتصال",        sublabel: "التحقق من الربط",       section: "test",     icon: "🔌" },
  { id: 9,  label: "إرسال أول فاتورة تجريبية", sublabel: "للتحقق النهائي",    section: "send",     icon: "🧾" },
  { id: 10, label: "اكتمال الإعداد",        sublabel: "النظام جاهز للإنتاج",  section: "dashboard",icon: "🎉" },
];

// ─── أنماط مشتركة ─────────────────────────────────────────────────────────────
const fld: React.CSSProperties = { height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", fontSize: 12, width: "100%", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 };
const grp: React.CSSProperties = { marginBottom: 14 };

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_submitted: { label: "لم تُرسَل",   color: "#6b7280", bg: "#f3f4f6" },
  pending:       { label: "في الانتظار", color: "#d97706", bg: "#fef3c7" },
  cleared:       { label: "مُخلَّصة",    color: "#16a34a", bg: "#dcfce7" },
  reported:      { label: "مُبلَّغة",    color: "#0ea5e9", bg: "#e0f2fe" },
  rejected:      { label: "مرفوضة",     color: "#dc2626", bg: "#fee2e2" },
  error:         { label: "خطأ",         color: "#dc2626", bg: "#fee2e2" },
  success:       { label: "ناجحة",       color: "#16a34a", bg: "#dcfce7" },
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
    if (id === 1)  return cfg?.environment ? "done" : "active";
    if (id === 2)  return "pending";
    if (id === 3)  return "pending";
    if (id === 4)  return cfg?.csid ? "done" : "pending";
    if (id === 5)  return cfg?.csid ? "done" : "pending";
    if (id === 6)  return cfg?.csid ? "done" : "pending";
    if (id === 7)  return "pending";
    if (id === 8)  return (cfg as any)?.lastConnectionStatus === "success" ? "done" : "pending";
    if (id === 9)  return (stats?.cleared ?? 0) > 0 ? "done" : "pending";
    if (id === 10) return cfg?.enabled && (cfg as any)?.lastConnectionStatus === "success" ? "done" : "pending";
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
            <div style={{ fontWeight: 800, fontSize: 16 }}>معالج إعداد الربط مع هيئة الزكاة</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>اتبع الخطوات لإكمال الربط الكامل مع منظومة الفوترة الإلكترونية</div>
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
                🔗 انتقل لهذا القسم
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
    1:  { desc: "حدد البيئة التي ستتعامل معها. استخدم Sandbox للاختبار أولاً قبل الانتقال إلى الإنتاج.", items: ["Sandbox: للاختبار والتطوير بدون تأثير حقيقي", "Production: الإرسال الفعلي للهيئة"], note: cfg?.environment ? `البيئة الحالية: ${cfg.environment === "production" ? "✅ الإنتاج" : "🧪 الاختبار"}` : "لم تُحدَّد البيئة بعد" },
    2:  { desc: "أنشئ طلب توقيع الشهادة (CSR) باستخدام خوارزمية EC secp256k1. يحتوي CSR على بيانات منشأتك.", items: ["الاسم التجاري وبيانات المنشأة", "الرقم الضريبي VAT", "عنوان المنشأة المسجّل", "نوع النشاط التجاري"] },
    3:  { desc: "أرسل ملف CSR إلى بوابة هيئة الزكاة والضريبة والجمارك للحصول على الشهادة الرقمية.", items: ["تسجيل الدخول لبوابة fatoora.zatca.gov.sa", "رفع ملف CSR", "انتظار الموافقة (يستغرق دقائق)", "تنزيل الشهادة المُعتمَدة"] },
    4:  { desc: "بعد الموافقة، ستصلك شهادة X.509 من الهيئة. احتفظ بها في مكان آمن.", items: ["صيغة PEM أو Base64", "تحتوي على المفتاح العام", "صالحة لفترة محددة (عادة سنة)", "تتضمن بيانات المنشأة المُتحقَّق منها"] },
    5:  { desc: "أدخل الشهادة العامة في النظام لاستخدامها في توقيع الفواتير.", items: ["انسخ محتوى الشهادة كاملاً", "أدخله في قسم إدارة CSID", "تأكد من صحة الصيغة", "احفظ التغييرات"] },
    6:  { desc: "Secret Key هو مفتاح التوثيق مع الهيئة. يأتي مع الشهادة من بوابة ZATCA.", items: ["يُعطى من الهيئة مع CSID", "لا يُعرض مرة ثانية — احفظه فوراً", "يُخزَّن مشفّراً في قاعدة البيانات", "لا تشاركه مع أحد"] },
    7:  { desc: "سجّل جهاز الفوترة (EGS) في منظومة الهيئة باستخدام CSID والشهادة.", items: ["UUID فريد لكل جهاز", "اسم الجهاز والفرع المرتبط", "إرسال طلب التسجيل", "الحصول على Device ID من الهيئة"] },
    8:  { desc: "تحقق من صحة الاتصال بين نظامك وخوادم الهيئة.", items: ["فحص CSID والشهادة", "اختبار الاتصال بالـ API", "التحقق من الاستجابة", "تسجيل نتيجة الاختبار"], note: (cfg as any)?.lastConnectionStatus === "success" ? "✅ آخر اختبار ناجح" : "لم يتم اختبار الاتصال بعد" },
    9:  { desc: "أرسل فاتورة تجريبية للتأكد من سير العملية كاملاً.", items: ["اختر فاتورة غير مرسلة", "تحقق من صحة XML", "أرسل للهيئة وانتظر الاستجابة", "تحقق من وصول استجابة Cleared"], note: (stats?.cleared ?? 0) > 0 ? `✅ ${stats.cleared} فاتورة مُخلَّصة` : "لم تُرسَل أي فاتورة بعد" },
    10: { desc: "مبروك! النظام جاهز للعمل في بيئة الإنتاج.", items: ["راقب لوحة التحكم يومياً", "تابع سجل الأخطاء", "تجديد الشهادة قبل انتهائها", "التواصل مع الدعم عند الحاجة"] },
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
    { label: "مُخلَّصة",         value: s?.cleared ?? 0,        icon: "✅", color: "#16a34a" },
    { label: "في الانتظار",    value: s?.pending ?? 0,        icon: "⏳", color: "#d97706" },
    { label: "مرفوضة",          value: s?.rejected ?? 0,       icon: "❌", color: "#dc2626" },
    { label: "أخطاء",           value: s?.errors ?? 0,         icon: "⚠️", color: "#7c3aed" },
    { label: "لم تُرسَل",       value: s?.notSubmitted ?? 0,   icon: "📭", color: "#6b7280" },
  ];

  return (
    <div>
      <SecTitle icon="🏠" title="لوحة التحكم — مركز التكامل مع هيئة الزكاة" />

      {/* زر بدء الإعداد */}
      {readyPct < 100 && (
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: 12, padding: "20px 24px", marginBottom: 20, display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ fontSize: 48 }}>🏛️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 4 }}>الربط مع هيئة الزكاة والضريبة والجمارك</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>اتبع الخطوات العشر لإكمال الإعداد الكامل والبدء في إرسال الفواتير الإلكترونية</div>
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
            <div style={{ fontWeight: 800, fontSize: 14, color: "#16a34a" }}>النظام مُعدّ بالكامل وجاهز للعمل</div>
            <div style={{ fontSize: 12, color: "#166534" }}>تم إتمام جميع خطوات الإعداد بنجاح</div>
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
              ❌ <span style={{ color: "#7f1d1d", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.rejected} فاتورة مرفوضة تحتاج مراجعة</span>
              <button onClick={() => onNavigate("errlogs")} style={{ height: 26, padding: "0 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>سجل الأخطاء</button>
            </div>
          )}
          {(s?.pending ?? 0) > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
              ⏳ <span style={{ color: "#78350f", fontWeight: 700, fontSize: 12, flex: 1 }}>يوجد {s!.pending} فاتورة في الانتظار — أرسلها للهيئة</span>
              <button onClick={() => onNavigate("send")} style={{ height: 26, padding: "0 12px", background: "#d97706", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>إرسال الآن</button>
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
          <StatusCard label="حالة الاتصال"        value={(cfg as any)?.lastConnectionStatus === "success" ? "متصل ✓" : (cfg as any)?.lastConnectionStatus === "failed" ? "منقطع ✗" : "لم يُختبر"} dot={connDot} sub={cfg?.lastConnectionTest ? `آخر اختبار: ${new Date(cfg.lastConnectionTest).toLocaleDateString("ar-SA")}` : "لم يُجرَ اختبار بعد"} onClick={() => onNavigate("test")} />
          <StatusCard label="شهادة CSID"          value={cfg?.csid ? "موجودة ✓" : "غير موجودة"} dot={csidDot} sub={certDays !== null ? (certDays > 0 ? `${certDays} يوم متبقٍ` : "منتهية!") : "—"} onClick={() => onNavigate("certs")} />
          <StatusCard label="Secret Key"          value={cfg?.csid ? "موجود ✓" : "غير موجود"} dot={keyDot} sub="مشفّر AES-256-GCM في DB" onClick={() => onNavigate("keys")} />
          <StatusCard label="الأجهزة (EGS)"       value="0 جهاز مسجّل" dot={devDot} sub="انقر لإدارة الأجهزة" onClick={() => onNavigate("devices")} />
          <StatusCard label="تفعيل ZATCA"         value={cfg?.enabled ? "مُفعَّلة ✓" : "غير مُفعَّلة"} dot={enabledDot} sub={cfg?.vatNumber ?? "الرقم الضريبي غير محدد"} onClick={() => onNavigate("env")} />
          <StatusCard label="فواتير اليوم"         value={String(s?.todayCount ?? s?.cleared ?? 0)} dot={(s?.todayCount ?? 0) > 0 ? "ok" : "none"} sub={`إجمالي مُخلَّصة: ${s?.cleared ?? 0}`} onClick={() => onNavigate("oplogs")} />
          <StatusCard label="نسبة نجاح الإرسال"  value={s?.totalInvoices ? `${Math.round((s.cleared / s.totalInvoices) * 100)}%` : "—"} dot={s?.totalInvoices && s.cleared / s.totalInvoices > 0.8 ? "ok" : s?.totalInvoices ? "warn" : "none"} sub={`${s?.rejected ?? 0} مرفوضة`} onClick={() => onNavigate("reports")} />
        </div>
      )}

      {/* ══ مؤشرات الأداء KPIs ══ */}
      <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>📊 مؤشرات الأداء</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        <KpiCard label="الأجهزة النشطة"     icon="💻" value={0}                                                        color="#0ea5e9" sub="من 1 جهاز إجمالي"         onClick={() => onNavigate("devices")} />
        <KpiCard label="شهادات سارية"        icon="🛡️" value={cfg?.csid ? 1 : 0}                                       color="#16a34a" sub={certDays !== null ? `${certDays} يوم متبقٍ` : "—"} onClick={() => onNavigate("certs")} />
        <KpiCard label="CSID نشطة"           icon="🔑" value={cfg?.csid ? 1 : 0}                                       color="#8b5cf6" sub="معرّفات الاتصال"            onClick={() => onNavigate("csid")} />
        <KpiCard label="إجمالي الفواتير"     icon="📄" value={s?.totalInvoices ?? 0}                                   color="#6366f1" sub={`${s?.cleared ?? 0} مُخلَّصة`} onClick={() => onNavigate("oplogs")} />
        <KpiCard label="شهادات منتهية"       icon="⏰" value={certDays !== null && certDays <= 0 ? 1 : 0}             color="#dc2626" sub="تحتاج تجديد فوري"           onClick={() => onNavigate("certs")} />
        <KpiCard label="ستنتهي قريباً"       icon="🕐" value={certDays !== null && certDays > 0 && certDays <= 30 ? 1 : 0} color="#d97706" sub="خلال 30 يوم"         onClick={() => onNavigate("certs")} />
        <KpiCard label="مرفوضة"              icon="❌" value={s?.rejected ?? 0}                                        color="#ef4444" sub="تحتاج مراجعة"              onClick={() => onNavigate("errlogs")} />
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
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>نسبة الامتثال</div>
              <div style={{ height: 10, borderRadius: 5, background: "#f1f5f9", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.round((s.cleared / s.totalInvoices) * 100)}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: 5, transition: "width 0.5s" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>{Math.round((s.cleared / s.totalInvoices) * 100)}%</span>
                <span style={{ color: "#6b7280" }}>{s.cleared} من {s.totalInvoices}</span>
                {s.rejected > 0 && <span style={{ color: "#dc2626" }}>• {s.rejected} مرفوضة</span>}
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
            ...((cfg as any)?.lastConnectionStatus === "success" ? [{ icon: "✅", label: "نجاح الربط بالهيئة", detail: "اختبار الاتصال ناجح", time: cfg?.lastConnectionTest ? new Date(cfg.lastConnectionTest).toLocaleDateString("ar-SA") : "—", color: "#16a34a" }] : []),
            ...(cfg?.csid ? [{ icon: "🔑", label: "تم إنشاء CSID", detail: "شهادة الاتصال نشطة", time: "—", color: "#8b5cf6" }] : []),
            ...(cfg?.environment ? [{ icon: "🌐", label: `تم تعيين البيئة: ${cfg.environment === "production" ? "الإنتاج" : "الاختبار"}`, detail: "إعدادات البيئة محفوظة", time: "—", color: "#0ea5e9" }] : []),
            ...((s?.cleared ?? 0) > 0 ? [{ icon: "📄", label: `${s!.cleared} فاتورة مُخلَّصة`, detail: "تم إرسالها بنجاح", time: "اليوم", color: "#16a34a" }] : []),
            ...((s?.rejected ?? 0) > 0 ? [{ icon: "❌", label: `${s!.rejected} فاتورة مرفوضة`, detail: "تحتاج مراجعة", time: "اليوم", color: "#dc2626" }] : []),
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
        {(["sandbox", "production"] as const).map(env => (
          <div key={env} onClick={() => isAdmin && set("environment", env)}
            style={{ borderRadius: 10, padding: "16px 18px", border: `2px solid ${cfg.environment === env ? (env === "production" ? "#16a34a" : "#D19C05") : "#e2e8f0"}`, background: cfg.environment === env ? (env === "production" ? "#dcfce7" : "#fef3c7") : "#fff", cursor: isAdmin ? "pointer" : "default", transition: "all 0.15s" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{env === "production" ? "🟢" : "🧪"}</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: cfg.environment === env ? (env === "production" ? "#16a34a" : "#D19C05") : "#374151" }}>
              {env === "production" ? "بيئة الإنتاج (Production)" : "بيئة الاختبار (Sandbox)"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              {env === "production" ? "الإرسال الفعلي للفواتير إلى هيئة الزكاة" : "للاختبار والتطوير — لا تؤثر على الفواتير الحقيقية"}
            </div>
            {cfg.environment === env && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: env === "production" ? "#16a34a" : "#D19C05" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: env === "production" ? "#16a34a" : "#D19C05" }}>البيئة الحالية</span>
              </div>
            )}
          </div>
        ))}
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
        <div style={{ fontSize: 12, color: "#6b7280" }}>أجهزة الفوترة الإلكترونية المسجّلة لدى الهيئة</div>
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
            <button title="مزامنة بيانات الجهاز مع الهيئة" onClick={() => toast.info("جارٍ المزامنة...")}
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
  const cfg  = cfgQ.data;
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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
      status: cfg?.csid ? "active" : "missing",
      date: cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : null, issuer: "ZATCA CA",
      details: {
        fingerprint:        cfg?.csid ? "SHA-256: xx:xx:...(مشفّر)" : "—",
        subject:            cfg?.businessName ? `CN=${cfg.businessName}, O=${cfg.businessName}, C=SA` : "—",
        serialNumber:       cfg?.csid ? "0x1A2B3C (مثال)" : "—",
        signatureAlgorithm: "SHA256WithECDSA",
        validFrom:          "—",
        validTo:            cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—",
      },
    },
    {
      label: "CSID", icon: "🔑", desc: "معرّف شهادة الاتصال — مُعطى من الهيئة",
      status: cfg?.csid ? "active" : "missing", date: null, issuer: "ZATCA",
      details: { fingerprint: "—", subject: "—", serialNumber: "—", signatureAlgorithm: "—", validFrom: "—", validTo: "—" },
    },
    {
      label: "Secret Key", icon: "🗝️", desc: "المفتاح السري للتوثيق — مشفّر AES-256-GCM",
      status: cfg?.csid ? "active" : "missing", date: null, issuer: "ZATCA",
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
        <StatusCard label="حالة الشهادة"        value={cfg?.csid ? "صالحة ✓" : "غير موجودة"} dot={cfg?.csid ? "ok" : "none"} sub={cfg?.csid ? "شهادة X.509 من ZATCA" : "أنشئ CSR وسجّل الجهاز"} />
        <StatusCard label="تاريخ الانتهاء"       value={cfg?.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—"} dot={certDot} sub={certDays !== null ? (certDays > 0 ? `${certDays} يوم متبقٍ` : "منتهية — تجديد فوري!") : "لم تُحدَّد"} />
        <StatusCard label="الجهة المصدرة / النوع" value={cfg?.csid ? "ZATCA CA" : "—"} dot={cfg?.csid ? "ok" : "none"} sub={cfg?.environment === "production" ? "شهادة إنتاج" : cfg?.environment === "sandbox" ? "شهادة اختبار" : "—"} />
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
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const cfg  = cfgQ.data;
  const [form, setForm] = useState({ cn: "", ou: "", o: "", c: "SA", uid: "", serialNumber: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ maxWidth: 640 }}>
      <SecTitle icon="📜" title="إنشاء CSR (Certificate Signing Request)" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatusCard label="الحالة"     value="لم يُنشَأ بعد" dot="none" />
        <StatusCard label="الخوارزمية" value="EC secp256k1"  dot="ok"  />
        <StatusCard label="الإصدار"    value="ZATCA v2.1"    dot="ok"  />
      </div>

      <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#92400e" }}>
        ℹ️ يُشتَق CSR من بيانات منشأتك. تأكد من مطابقة البيانات لما هو مسجّل لدى الهيئة.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={grp}>
          <label style={lbl}>CN (الاسم العام) *</label>
          <input style={fld} value={form.cn || cfg?.businessName || ""} onChange={e => set("cn", e.target.value)} placeholder="اسم المنشأة بالإنجليزية" />
        </div>
        <div style={grp}>
          <label style={lbl}>O (المنشأة) *</label>
          <input style={fld} value={form.o || cfg?.businessName || ""} onChange={e => set("o", e.target.value)} placeholder="Organization Name" />
        </div>
        <div style={grp}>
          <label style={lbl}>OU (القسم)</label>
          <input style={fld} value={form.ou} onChange={e => set("ou", e.target.value)} placeholder="E-Invoicing Department" />
        </div>
        <div style={grp}>
          <label style={lbl}>C (الدولة)</label>
          <input style={{ ...fld, direction: "ltr" }} value={form.c} onChange={e => set("c", e.target.value)} placeholder="SA" />
        </div>
        <div style={grp}>
          <label style={lbl}>UID (الرقم الضريبي) *</label>
          <input style={{ ...fld, fontFamily: "monospace", direction: "ltr" }} value={form.uid || cfg?.vatNumber || ""} onChange={e => set("uid", e.target.value)} placeholder="3XXXXXXXXXXXXXX3" />
        </div>
        <div style={grp}>
          <label style={lbl}>Serial Number</label>
          <input style={{ ...fld, fontFamily: "monospace", direction: "ltr" }} value={form.serialNumber} onChange={e => set("serialNumber", e.target.value)} placeholder="1-TST|2-TST|3-XXX" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => toast.info("إنشاء CSR — سيتم تطويره قريباً مع تكامل الباك إند")}
          style={{ height: 36, padding: "0 24px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          🔧 إنشاء CSR الآن
        </button>
        <button onClick={() => toast.info("استيراد CSR موجود")}
          style={{ height: 36, padding: "0 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
          📥 استيراد CSR موجود
        </button>
      </div>
    </div>
  );
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
              <textarea style={{ ...fld, height: 70, fontFamily: "monospace", fontSize: 10, direction: "ltr", resize: "vertical" }}
                value={cfg.csid ?? ""} onChange={e => set("csid", e.target.value)} placeholder="Base64 encoded CSID from ZATCA portal..." />
            </div>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <label style={{ ...lbl, margin: 0 }}>Secret Key</label>
                <button onClick={() => setShowKey(!showKey)} style={{ fontSize: 10, padding: "0 8px", height: 18, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 3, cursor: "pointer" }}>
                  {showKey ? "إخفاء" : "إظهار"}
                </button>
              </div>
              <input type={showKey ? "text" : "password"} style={{ ...fld, fontFamily: "monospace", direction: "ltr" }}
                value={cfg.secretKey ?? ""} onChange={e => set("secretKey", e.target.value)} placeholder="••••••••••••••••" />
              <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>🔒 لا يُعرض بعد الحفظ — احتفظ بنسخة آمنة</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>رقم تسلسل الشهادة</label>
                <input style={{ ...fld, direction: "ltr", fontFamily: "monospace" }}
                  value={cfg.certSerialNumber ?? ""} onChange={e => set("certSerialNumber", e.target.value)} placeholder="SN-XXXXXXX" />
              </div>
              <div>
                <label style={lbl}>تاريخ انتهاء الشهادة</label>
                <input type="date" style={fld} value={cfg.certExpiryDate?.slice(0, 10) ?? ""} onChange={e => set("certExpiryDate", e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => saveM.mutate(cfg as any)} disabled={saveM.isPending}
              style={{ height: 32, padding: "0 18px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              {saveM.isPending ? "جارٍ الحفظ..." : "💾 حفظ"}
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
    { label: "اسم المنشأة",          ok: !!cfg?.businessName, dot: !!cfg?.businessName ? "ok" as const : "warn" as const, desc: cfg?.businessName || "غير محدد" },
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
// 11. إرسال الفواتير
// ══════════════════════════════════════════════════════════════════════════════
function SendSection() {
  const [page, setPage]         = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const listQ  = trpc.zatca.getInvoicesList.useQuery({ page, limit: 25, status: filterStatus || undefined });
  const submitM = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (r) => { toast.success(r.message ?? "تم الإرسال"); listQ.refetch(); },
    onError:   (e) => toast.error(e.message),
  });

  const rows = listQ.data?.invoices ?? [];

  return (
    <div>
      <SecTitle icon="📤" title="إرسال الفواتير الإلكترونية" />

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["", "not_submitted", "pending", "cleared", "rejected", "error"].map(s => (
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
                  {inv.zatcaStatus !== "cleared" && (
                    <button onClick={() => submitM.mutate({ invoiceId: inv.id, forceResend: (inv.zatcaAttemptCount ?? 0) > 0 })} disabled={submitM.isPending}
                      style={{ height: 22, padding: "0 10px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      {(inv.zatcaAttemptCount ?? 0) > 0 ? "↩ إعادة" : "إرسال"}
                    </button>
                  )}
                  {inv.zatcaStatus === "cleared" && <span style={{ color: "#16a34a", fontSize: 11 }}>✓ مُخلَّصة</span>}
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
  const testM  = trpc.zatca.testConnection.useMutation();
  const cfg = cfgQ.data;
  const s   = statsQ.data;

  const checks = [
    { id: "vat",    label: "صحة الرقم الضريبي",     dot: !!cfg?.vatNumber && /^3\d{13}3$/.test(cfg?.vatNumber ?? "") ? "ok" as const : "error" as const, detail: cfg?.vatNumber || "غير محدد" },
    { id: "name",   label: "اسم المنشأة",             dot: !!cfg?.businessName ? "ok" as const : "warn" as const, detail: cfg?.businessName || "غير محدد" },
    { id: "addr",   label: "اكتمال العنوان",          dot: !!(cfg?.streetName && cfg?.city) ? "ok" as const : "warn" as const, detail: cfg?.streetName ? `${cfg.streetName}، ${cfg.city}` : "غير مكتمل" },
    { id: "csid",   label: "CSID",                   dot: !!cfg?.csid ? "ok" as const : "error" as const, detail: cfg?.csid ? "موجود ✓" : "مفقود" },
    { id: "cert",   label: "صلاحية الشهادة",          dot: !!(cfg?.certExpiryDate && (s?.certDaysLeft ?? 0) > 0) ? "ok" as const : s?.certDaysLeft !== null && (s?.certDaysLeft ?? 0) > 0 ? "ok" as const : "error" as const, detail: s?.certDaysLeft != null ? `${s!.certDaysLeft} يوم متبقٍ` : "غير محدد" },
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
            {score >= 80 ? "✅ النظام جاهز" : score >= 60 ? "⚠️ تحتاج مراجعة" : "❌ تحتاج إعداد"}
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
    { title: "الفواتير المُخلَّصة",  value: s?.cleared ?? 0,     total: s?.totalInvoices ?? 0, color: "#16a34a", icon: "✅" },
    { title: "الفواتير في الانتظار", value: s?.pending ?? 0,     total: s?.totalInvoices ?? 0, color: "#d97706", icon: "⏳" },
    { title: "الفواتير المرفوضة",   value: s?.rejected ?? 0,    total: s?.totalInvoices ?? 0, color: "#dc2626", icon: "❌" },
    { title: "الفواتير ذات الأخطاء", value: s?.errors ?? 0,      total: s?.totalInvoices ?? 0, color: "#7c3aed", icon: "⚠️" },
    { title: "غير مُرسَلة",          value: s?.notSubmitted ?? 0, total: s?.totalInvoices ?? 0, color: "#6b7280", icon: "📭" },
  ];

  return (
    <div>
      <SecTitle icon="📊" title="التقارير والإحصائيات" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
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
                {[["#16a34a","مُخلَّصة"],["#d97706","انتظار"],["#dc2626","مرفوضة"],["#7c3aed","أخطاء"],["#e2e8f0","لم تُرسَل"]].map(([c,l]) => (
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
// المكوّن الرئيسي
// ══════════════════════════════════════════════════════════════════════════════
export default function ZatcaCenterPage() {
  const [active, setActive]      = useState<Section>("dashboard");
  const [showWizard, setShowWizard] = useState(false);

  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const statsQ = trpc.zatca.getStats.useQuery();

  const navigateTo = (sec: Section) => setActive(sec);

  function renderSection() {
    switch (active) {
      case "dashboard": return <DashboardSection onStartSetup={() => setShowWizard(true)} onNavigate={navigateTo} />;
      case "env":       return <EnvSection />;
      case "devices":   return <DevicesSection />;
      case "certs":     return <CertsSection />;
      case "keys":      return <KeysSection />;
      case "xmlcheck":  return <XmlCheckSection />;
      case "csr":       return <CsrSection />;
      case "register":  return <RegisterSection />;
      case "csid":      return <CsidSection />;
      case "test":      return <TestSection />;
      case "send":      return <SendSection />;
      case "oplogs":    return <LogsSection errorsOnly={false} />;
      case "errlogs":   return <LogsSection errorsOnly={true} />;
      case "diag":      return <DiagSection />;
      case "reports":   return <ReportsSection />;
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
      <div style={{ width: 210, background: "#fff", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        {/* رأس الشريط */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg,#1e293b,#334155)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#D19C05" }}>🏛️ مركز ZATCA</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>هيئة الزكاة والضريبة والجمارك</div>
        </div>

        {/* زر معالج الإعداد */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
          <button onClick={() => setShowWizard(true)}
            style={{ width: "100%", height: 34, background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            ▶ معالج الإعداد
          </button>
        </div>

        {/* قائمة الأقسام */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {SECTIONS.map(sec => (
            <button key={sec.id} onClick={() => setActive(sec.id)}
              style={{ width: "100%", textAlign: "right", padding: "9px 16px", border: "none", background: active === sec.id ? "#fef3c7" : "transparent", borderRight: `3px solid ${active === sec.id ? "#D19C05" : "transparent"}`, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: active === sec.id ? 700 : 500, color: active === sec.id ? "#D19C05" : "#374151", transition: "all 0.1s" }}>
              <span style={{ fontSize: 16 }}>{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {renderSection()}
      </div>
    </div>
  );
}
