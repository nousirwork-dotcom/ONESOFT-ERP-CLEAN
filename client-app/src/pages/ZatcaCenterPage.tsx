/**
 * ZatcaCenterPage.tsx — مركز التكامل مع هيئة الزكاة والضريبة والجمارك
 * 15 قسماً: لوحة التحكم · البيئة · الأجهزة · الشهادات · المفاتيح · XML
 *           CSR · التسجيل · CSID · الاتصال · الإرسال · السجل · الأخطاء · التشخيص · التقارير
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type Section =
  | "dashboard" | "env" | "devices" | "certs" | "keys"
  | "xmlcheck"  | "csr" | "register" | "csid" | "test"
  | "send"      | "oplogs" | "errlogs" | "diag" | "reports";

// ─── قائمة الأقسام ────────────────────────────────────────────────────────────
const SECTIONS: { id: Section; label: string; icon: string; badge?: string }[] = [
  { id: "dashboard", label: "لوحة التحكم",                  icon: "🏠" },
  { id: "env",       label: "إعدادات البيئة",               icon: "🌐" },
  { id: "devices",   label: "إدارة الأجهزة (EGS)",           icon: "💻", badge: "قريباً" },
  { id: "certs",     label: "إدارة الشهادات",               icon: "🛡️" },
  { id: "keys",      label: "مفاتيح التشفير",               icon: "🔐", badge: "قريباً" },
  { id: "xmlcheck",  label: "التحقق من XML",                icon: "🔎" },
  { id: "csr",       label: "إنشاء CSR",                   icon: "📜", badge: "قريباً" },
  { id: "register",  label: "تسجيل الجهاز",                 icon: "📱", badge: "قريباً" },
  { id: "csid",      label: "إدارة CSID",                  icon: "🔑" },
  { id: "test",      label: "اختبار الاتصال",               icon: "🔌" },
  { id: "send",      label: "إرسال الفواتير",               icon: "📤" },
  { id: "oplogs",    label: "سجل الإرسال والاستقبال",        icon: "📋" },
  { id: "errlogs",   label: "سجل الأخطاء",                 icon: "🚨" },
  { id: "diag",      label: "أدوات التشخيص",               icon: "🔬" },
  { id: "reports",   label: "التقارير والإحصائيات",          icon: "📊" },
];

// ─── مساعدات ──────────────────────────────────────────────────────────────────
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

function ComingSoonSection({ icon, title, description, features }: {
  icon: string; title: string; description: string; features: string[];
}) {
  return (
    <div>
      <SecTitle icon={icon} title={title} />
      <div style={{ textAlign: "center", padding: "40px 60px", background: "#f8fafc", borderRadius: 12, border: "2px dashed #e2e8f0" }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#374151", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, maxWidth: 480, margin: "0 auto 20px" }}>{description}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 500, margin: "0 auto", textAlign: "right" }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 6, padding: "8px 12px", border: "1px solid #e2e8f0", fontSize: 12, color: "#374151", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#D19C05" }}>◆</span> {f}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "inline-flex", gap: 8, padding: "8px 16px", background: "#fef3c7", borderRadius: 8, border: "1px solid #fde68a" }}>
          <span>⏳</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>قيد التطوير — سيتم إضافة هذه الوظيفة في التحديث القادم</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. لوحة التحكم
// ══════════════════════════════════════════════════════════════════════════════
function DashboardSection() {
  const statsQ = trpc.zatca.getStats.useQuery();
  const cfgQ   = trpc.zatca.getConfig.useQuery();
  const s = statsQ.data;
  const cfg = cfgQ.data;

  const connColor = s?.connectionStatus === "success" ? "#16a34a" : s?.connectionStatus === "failed" ? "#dc2626" : "#6b7280";
  const certColor = s?.certWarning === "critical" ? "#dc2626" : s?.certWarning === "warning" ? "#d97706" : s?.certWarning === "ok" ? "#16a34a" : "#6b7280";

  const infoCards = [
    { label: "حالة الاتصال بالهيئة", value: s?.connectionStatus === "success" ? "✅ متصل" : s?.connectionStatus === "failed" ? "❌ منقطع" : "⚪ غير مُختبر", color: connColor },
    { label: "البيئة الحالية",        value: s?.environment === "production" ? "🟢 إنتاج" : "🧪 اختبار", color: s?.environment === "production" ? "#16a34a" : "#d97706" },
    { label: "حالة الشهادة",         value: s?.certExpiryDate ? (s.certDaysLeft !== null && s.certDaysLeft > 0 ? `🛡️ صالحة (${s.certDaysLeft} يوم)` : "🚨 منتهية") : "⚪ غير محدد", color: certColor },
    { label: "آخر اختبار اتصال",     value: s?.lastConnectionTest ? new Date(s.lastConnectionTest).toLocaleString("ar-SA") : "لم يُختبر", color: "#6b7280" },
    { label: "اسم المنشأة",          value: cfg?.businessName || "—", color: "#374151" },
    { label: "الرقم الضريبي (VAT)",  value: cfg?.vatNumber || "—", color: "#374151" },
  ];

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
      <SecTitle icon="🏠" title="لوحة التحكم الرئيسية" />

      {s?.certWarning === "critical" && (
        <div style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          🚨 <strong style={{ color: "#dc2626" }}>تنبيه عاجل:</strong>
          <span style={{ color: "#dc2626", fontSize: 13 }}>{(s.certDaysLeft ?? 0) <= 0 ? "انتهت صلاحية الشهادة — تجديد فوري مطلوب!" : `تنتهي الشهادة خلال ${s.certDaysLeft} أيام فقط!`}</span>
        </div>
      )}

      {/* معلومات النظام */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {infoCards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* إحصائيات الفواتير */}
      <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 10 }}>📈 إحصائيات الفواتير الإلكترونية</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "14px 8px", border: `1px solid ${c.color}33`, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* شريط الامتثال */}
      {s && s.totalInvoices > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "16px 18px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📊 نسبة الامتثال</div>
          <div style={{ height: 10, borderRadius: 5, background: "#f1f5f9", overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${Math.round((s.cleared / s.totalInvoices) * 100)}%`, background: "#16a34a", borderRadius: 5, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            <strong style={{ color: "#16a34a" }}>{Math.round((s.cleared / s.totalInvoices) * 100)}%</strong>
            &nbsp;— {s.cleared} من {s.totalInvoices} فاتورة مُخلَّصة
          </div>
        </div>
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
  const cfg  = { ...(cfgQ.data ?? {}), ...form };
  const isAdmin = cfgQ.data?.isAdmin ?? false;
  const set  = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const sandboxUrls = [
    { key: "apiBaseUrl",    label: "API Base URL",   placeholder: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal" },
  ];

  return (
    <div style={{ maxWidth: 680 }}>
      <SecTitle icon="🌐" title="إعدادات البيئة" />

      {/* تحديد البيئة */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {(["sandbox", "production"] as const).map(env => (
          <div key={env} onClick={() => isAdmin && set("environment", env)}
            style={{ borderRadius: 10, padding: "16px 18px", border: `2px solid ${cfg.environment === env ? (env === "production" ? "#16a34a" : "#D19C05") : "#e2e8f0"}`, background: cfg.environment === env ? (env === "production" ? "#dcfce7" : "#fef3c7") : "#fff", cursor: isAdmin ? "pointer" : "default", transition: "all 0.15s" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{env === "production" ? "🟢" : "🧪"}</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: cfg.environment === env ? (env === "production" ? "#16a34a" : "#D19C05") : "#374151" }}>
              {env === "production" ? "بيئة الإنتاج (Production)" : "بيئة الاختبار (Sandbox)"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              {env === "production" ? "الإرسال الفعلي للفواتير إلى هيئة الزكاة" : "للاختبار والتطوير — لا تؤثر على الفواتير الحقيقية"}
            </div>
            {cfg.environment === env && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: env === "production" ? "#16a34a" : "#D19C05" }}>✓ البيئة الحالية</div>}
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#92400e", marginBottom: 14 }}>
            ⚠️ تغيير البيئة من إنتاج إلى اختبار سيوقف إرسال الفواتير الحقيقية. تأكد من توافق البيانات قبل التبديل.
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 10 }}>🔗 روابط API الهيئة</div>
            {sandboxUrls.map(u => (
              <div key={u.key} style={grp}>
                <label style={lbl}>{u.label}</label>
                <input style={{ ...fld, direction: "ltr", fontFamily: "monospace", fontSize: 11 }}
                  value={(cfg as any)[u.key] ?? ""} onChange={e => set(u.key, e.target.value)} placeholder={u.placeholder} />
              </div>
            ))}
            <div style={grp}>
              <label style={lbl}>إصدار API</label>
              <select style={{ ...fld, width: 120 }} value={cfg.apiVersion ?? "V2"} onChange={e => set("apiVersion", e.target.value)}>
                <option value="V2">V2 (الإصدار الحالي)</option>
                <option value="V1">V1 (قديم)</option>
              </select>
            </div>
          </div>

          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🔗 روابط المرحلة الثانية (قريباً)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
              {[
                { label: "OAuth URL",     value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/oauth/token" },
                { label: "Compliance URL", value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance" },
                { label: "Reporting URL", value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/reporting/single" },
                { label: "Clearance URL", value: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/invoices/clearance/single" },
              ].map(u => (
                <div key={u.label} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11 }}>
                  <span style={{ width: 110, fontWeight: 600, color: "#6b7280", flexShrink: 0 }}>{u.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#374151", overflow: "hidden", textOverflow: "ellipsis" }}>{u.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => saveM.mutate(cfg as any)} disabled={saveM.isPending}
              style={{ height: 34, padding: "0 22px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saveM.isPending ? 0.6 : 1 }}>
              {saveM.isPending ? "جارٍ الحفظ..." : "💾 حفظ إعدادات البيئة"}
            </button>
            <button onClick={() => setForm({})} style={{ height: 34, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>تراجع</button>
          </div>
        </>
      )}
      {!isAdmin && (
        <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#6b7280", border: "1px solid #e2e8f0" }}>
          🔒 تغيير إعدادات البيئة متاح لمسؤول ZATCA فقط.
        </div>
      )}
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

  return (
    <div style={{ maxWidth: 680 }}>
      <SecTitle icon="🔑" title="إدارة CSID وشهادة الاتصال" />

      {/* حالة CSID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "حالة CSID",         value: cfg.csid ? (cfg.enabled ? "✅ مُفعَّل" : "⭕ غير مُفعَّل") : "❌ غير مُعيَّن" },
          { label: "تاريخ انتهاء الشهادة", value: cfg.certExpiryDate ? new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA") : "—" },
          { label: "الأيام المتبقية",    value: certDays !== null ? (certDays > 0 ? `${certDays} يوم` : "منتهية") : "—" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {certDays !== null && certDays <= 30 && (
        <div style={{ background: certDays <= 7 ? "#fee2e2" : "#fef3c7", border: `1px solid ${certDays <= 7 ? "#dc2626" : "#d97706"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          {certDays <= 7 ? "🚨" : "⚠️"}
          <span style={{ color: certDays <= 7 ? "#dc2626" : "#92400e", fontSize: 12, fontWeight: 700 }}>
            {certDays <= 0 ? "انتهت صلاحية الشهادة — تجديد فوري مطلوب!" : `تنتهي الشهادة خلال ${certDays} يوم — يُرجى التخطيط للتجديد`}
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
                <label style={{ ...lbl, margin: 0 }}>Secret Key (المفتاح السري)</label>
                <button onClick={() => setShowKey(!showKey)} style={{ fontSize: 10, padding: "0 8px", height: 18, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 3, cursor: "pointer" }}>
                  {showKey ? "إخفاء" : "إظهار"}
                </button>
              </div>
              <input type={showKey ? "text" : "password"} style={{ ...fld, fontFamily: "monospace", direction: "ltr" }}
                value={cfg.secretKey ?? ""} onChange={e => set("secretKey", e.target.value)} placeholder="••••••••••••••••" />
              <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>لا يُعرض بعد الحفظ — احتفظ بنسخة آمنة</div>
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
            <button style={{ height: 32, padding: "0 14px", background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#dc2626", opacity: 0.5 }} disabled>
              🔄 تجديد الشهادة (قريباً)
            </button>
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
// 4. إدارة الشهادات
// ══════════════════════════════════════════════════════════════════════════════
function CertsSection() {
  const cfgQ = trpc.zatca.getConfig.useQuery();
  const cfg  = cfgQ.data;

  const certItems = [
    { label: "CSR", icon: "📜", description: "Certificate Signing Request — طلب الشهادة المُوقَّع", status: "pending" },
    { label: "Private Key", icon: "🔐", description: "المفتاح الخاص — يُحفظ بشكل مشفّر في قاعدة البيانات", status: "pending" },
    { label: "Public Certificate", icon: "📋", description: "الشهادة العامة الصادرة من هيئة الزكاة", status: cfg?.csid ? "active" : "missing" },
    { label: "CSID", icon: "🔑", description: "معرّف شهادة الاتصال", status: cfg?.csid ? "active" : "missing" },
    { label: "Secret Key", icon: "🗝️", description: "المفتاح السري للتوثيق مع الهيئة", status: cfg?.csid ? "active" : "missing" },
  ];

  const statusColor = (s: string) => s === "active" ? "#16a34a" : s === "missing" ? "#dc2626" : "#d97706";
  const statusLabel = (s: string) => s === "active" ? "✅ موجود" : s === "missing" ? "❌ مفقود" : "⏳ قيد الإعداد";

  return (
    <div>
      <SecTitle icon="🛡️" title="إدارة الشهادات" />

      <div style={{ marginBottom: 16 }}>
        {certItems.map(item => (
          <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{item.description}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(item.status) }}>
                {statusLabel(item.status)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "إنشاء شهادة", icon: "➕", color: "#D19C05", disabled: false },
          { label: "تجديد الشهادة", icon: "🔄", color: "#0ea5e9", disabled: true },
          { label: "إلغاء الشهادة", icon: "🚫", color: "#dc2626", disabled: true },
          { label: "تصدير الشهادة", icon: "📤", color: "#6b7280", disabled: true },
          { label: "استيراد الشهادة", icon: "📥", color: "#6b7280", disabled: false },
          { label: "نسخ البيانات", icon: "📋", color: "#6b7280", disabled: !cfg?.csid },
        ].map(b => (
          <button key={b.label} disabled={b.disabled}
            onClick={() => !b.disabled && toast.info(`${b.label} — قريباً`)}
            style={{ height: 40, padding: "0 12px", background: b.disabled ? "#f8fafc" : `${b.color}11`, border: `1px solid ${b.disabled ? "#e2e8f0" : b.color}`, borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: b.disabled ? "not-allowed" : "pointer", color: b.disabled ? "#9ca3af" : b.color, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, background: "#f8fafc", borderRadius: 8, padding: "12px 14px", border: "1px solid #e2e8f0", fontSize: 11, color: "#6b7280" }}>
        💡 لإنشاء الشهادة الكاملة وتسجيل الجهاز لدى الهيئة، استخدم قسم "تسجيل الجهاز" الذي يوفر معالجاً خطوة بخطوة.
      </div>
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
    { label: "بيانات CSID",            ok: !!cfg?.csid,         desc: cfg?.csid ? "CSID مُعيَّن" : "CSID مفقود — أدخله في قسم إدارة CSID" },
    { label: "Secret Key",             ok: !!cfg?.csid,         desc: cfg?.csid ? "Secret Key موجود" : "Secret Key مفقود" },
    { label: "رابط API الهيئة",       ok: !!cfg?.apiBaseUrl && cfg?.apiBaseUrl !== "(محجوب)", desc: cfg?.apiBaseUrl || "غير محدد" },
    { label: "تفعيل منظومة ZATCA",    ok: !!cfg?.enabled,      desc: cfg?.enabled ? "مُفعَّلة" : "غير مُفعَّلة — فعّلها من إعدادات ZATCA" },
    { label: "الرقم الضريبي (VAT)",   ok: !!cfg?.vatNumber && /^3\d{13}3$/.test(cfg?.vatNumber ?? ""), desc: cfg?.vatNumber || "غير محدد" },
    { label: "اسم المنشأة",           ok: !!cfg?.businessName, desc: cfg?.businessName || "غير محدد" },
  ];

  return (
    <div style={{ maxWidth: 620 }}>
      <SecTitle icon="🔌" title="اختبار الاتصال بهيئة الزكاة" />

      {/* قائمة المتطلبات */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 8 }}>🔍 فحص المتطلبات</div>
        {checks.map(c => (
          <div key={c.label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: "#fff", borderRadius: 6, border: "1px solid #e2e8f0", marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>{c.ok ? "✅" : "❌"}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{c.label}</span>
              <span style={{ fontSize: 11, color: "#6b7280", marginRight: 8 }}>— {c.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* نتيجة آخر اختبار */}
      {cfg?.lastConnectionTest && (
        <div style={{ background: (cfg as any).lastConnectionStatus === "success" ? "#dcfce7" : "#fee2e2", borderRadius: 8, padding: "12px 14px", marginBottom: 14, border: `1px solid ${(cfg as any).lastConnectionStatus === "success" ? "#16a34a" : "#dc2626"}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: (cfg as any).lastConnectionStatus === "success" ? "#16a34a" : "#dc2626" }}>
            {(cfg as any).lastConnectionStatus === "success" ? "✅ آخر اختبار: ناجح" : "❌ آخر اختبار: فشل"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            {new Date(cfg.lastConnectionTest).toLocaleString("ar-SA")}
          </div>
        </div>
      )}

      {isAdmin ? (
        <button onClick={() => testM.mutate()} disabled={testM.isPending}
          style={{ height: 38, padding: "0 24px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: testM.isPending ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {testM.isPending ? (<><span style={{ animation: "spin 1s linear infinite" }}>⟳</span> جارٍ الاختبار...</>) : "🔌 اختبار الاتصال الآن"}
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
  const [page, setPage] = useState(1);
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
// 12 & 13. سجل العمليات / سجل الأخطاء
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
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    link.download = `zatca-${errorsOnly ? "errors" : "logs"}-${Date.now()}.csv`;
    link.click();
  };

  return (
    <div>
      <SecTitle icon={errorsOnly ? "🚨" : "📋"} title={errorsOnly ? "سجل الأخطاء" : "سجل الإرسال والاستقبال"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 12, background: "#f8fafc", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div>
          <label style={lbl}>رقم الفاتورة</label>
          <input style={{ ...fld, height: 26 }} value={invNum} onChange={e => { setInvNum(e.target.value); setPage(1); }} placeholder="بحث..." />
        </div>
        <div>
          <label style={lbl}>نوع العملية</label>
          <select style={{ ...fld, height: 26 }} value={evType} onChange={e => { setEvType(e.target.value); setPage(1); }}>
            <option value="">الكل</option>
            {Object.entries(EVENT_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>الحالة</label>
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
  const cfgQ  = trpc.zatca.getConfig.useQuery();
  const statsQ = trpc.zatca.getStats.useQuery();
  const testM = trpc.zatca.testConnection.useMutation();
  const cfg = cfgQ.data;
  const s   = statsQ.data;

  const checks = [
    { id: "vat",    label: "صحة الرقم الضريبي",     ok: !!cfg?.vatNumber && /^3\d{13}3$/.test(cfg?.vatNumber ?? ""), detail: cfg?.vatNumber || "غير محدد" },
    { id: "name",   label: "اسم المنشأة",             ok: !!cfg?.businessName, detail: cfg?.businessName || "غير محدد" },
    { id: "addr",   label: "اكتمال العنوان",          ok: !!(cfg?.streetName && cfg?.city && cfg?.buildingNumber), detail: cfg?.streetName ? `${cfg.streetName}، ${cfg.city}` : "غير مكتمل" },
    { id: "csid",   label: "CSID",                   ok: !!cfg?.csid, detail: cfg?.csid ? "موجود" : "مفقود" },
    { id: "cert",   label: "صلاحية الشهادة",          ok: !!(cfg?.certExpiryDate && (s?.certDaysLeft ?? 0) > 0), detail: s?.certDaysLeft !== null ? (s!.certDaysLeft! > 0 ? `${s!.certDaysLeft} يوم متبقٍ` : "منتهية") : "غير محدد" },
    { id: "env",    label: "تهيئة البيئة",            ok: !!(cfg?.apiBaseUrl), detail: cfg?.environment === "production" ? "إنتاج ✓" : "اختبار" },
    { id: "enabled",label: "تفعيل المنظومة",          ok: !!cfg?.enabled, detail: cfg?.enabled ? "مُفعَّلة" : "غير مُفعَّلة" },
    { id: "conn",   label: "آخر اختبار اتصال",       ok: (cfg as any)?.lastConnectionStatus === "success", detail: cfg?.lastConnectionTest ? new Date(cfg.lastConnectionTest).toLocaleString("ar-SA") : "لم يُختبر" },
  ];

  const passed = checks.filter(c => c.ok).length;
  const total  = checks.length;
  const score  = Math.round((passed / total) * 100);

  return (
    <div>
      <SecTitle icon="🔬" title="أدوات التشخيص" />

      {/* نتيجة إجمالية */}
      <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: "1px solid #e2e8f0", marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", border: `4px solid ${score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626" }}>{score}%</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
            {score >= 80 ? "✅ النظام جاهز" : score >= 60 ? "⚠️ تحتاج مراجعة" : "❌ تحتاج إعداد"}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{passed} من {total} فحص ناجح</div>
        </div>
        <button onClick={() => cfgQ.refetch()} style={{ marginRight: "auto", height: 30, padding: "0 14px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🔄 تحديث</button>
      </div>

      {/* قائمة الفحوصات */}
      <div style={{ marginBottom: 16 }}>
        {checks.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", background: "#fff", borderRadius: 6, border: `1px solid ${c.ok ? "#dcfce7" : "#fee2e2"}`, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{c.ok ? "✅" : "❌"}</span>
            <span style={{ fontWeight: 700, fontSize: 12, flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{c.detail}</span>
          </div>
        ))}
      </div>

      {/* أدوات إضافية */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "اختبار الاتصال", icon: "🔌", action: () => testM.mutate(), disabled: !(cfg?.isAdmin) },
          { label: "فحص XML",       icon: "🔎", action: () => toast.info("انتقل لقسم التحقق من XML"), disabled: false },
          { label: "فحص الشهادة",   icon: "🛡️", action: () => toast.info("انتقل لقسم إدارة الشهادات"), disabled: false },
          { label: "سجل الأخطاء",   icon: "🚨", action: () => toast.info("انتقل لقسم سجل الأخطاء"), disabled: false },
          { label: "مزامنة الساعة", icon: "⏰", action: () => toast.info(`توقيت النظام: ${new Date().toLocaleString("ar-SA")}`), disabled: false },
          { label: "تقرير شامل",    icon: "📊", action: () => toast.info("انتقل لقسم التقارير"), disabled: false },
        ].map(b => (
          <button key={b.label} onClick={b.action} disabled={b.disabled}
            style={{ height: 38, padding: "0 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: b.disabled ? "not-allowed" : "pointer", color: b.disabled ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. التحقق من XML (مُبسَّط — نفس ZatcaXmlValidator)
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

  const exportCsv = () => {
    if (!result) return;
    const header = ["#", "النوع", "العنصر", "الوصف", "القيمة الحالية", "القيمة المتوقعة", "الحل"];
    const csv = [header.join(","), ...result.results.map(r => [r.id, r.type, `"${r.element}"`, `"${r.description}"`, `"${r.currentValue}"`, `"${r.expectedValue}"`, `"${r.fix}"`].join(","))].join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    link.download = `zatca-xml-${Date.now()}.csv`;
    link.click();
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
              <button onClick={exportCsv} style={{ height: 26, padding: "0 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, cursor: "pointer", fontWeight: 700 }}>📥 CSV</button>
            </div>
            {showXml && (
              <div style={{ background: "#1e293b", borderRadius: 6, padding: "10px 12px", marginBottom: 10, maxHeight: 200, overflow: "auto" }}>
                <pre style={{ fontFamily: "monospace", fontSize: 9, color: "#e2e8f0", margin: 0, whiteSpace: "pre-wrap" }}>{result.xml}</pre>
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["#", "النوع", "العنصر", "الوصف"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => {
                    const ts = TYPE_STYLE[r.type] ?? TYPE_STYLE.info;
                    const isSel = selectedRow === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr onClick={() => setSelectedRow(isSel ? null : r.id)} style={{ borderBottom: "1px solid #f1f5f9", background: isSel ? ts.bg : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}>
                          <td style={{ padding: "4px 8px", color: "#6b7280" }}>{r.id}</td>
                          <td style={{ padding: "4px 8px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: ts.color }}>{ts.icon} {r.type === "error" ? "خطأ" : r.type === "warning" ? "تحذير" : "معلومة"}</span>
                          </td>
                          <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 9, color: "#6366f1", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.element}</td>
                          <td style={{ padding: "4px 8px", color: r.type === "error" ? "#dc2626" : r.type === "warning" ? "#92400e" : "#374151", fontSize: 11 }}>{r.description}</td>
                        </tr>
                        {isSel && (
                          <tr style={{ background: `${ts.bg}` }}>
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
    { title: "الفواتير المُخلَّصة",  value: s?.cleared ?? 0,      total: s?.totalInvoices ?? 0, color: "#16a34a", icon: "✅" },
    { title: "الفواتير في الانتظار", value: s?.pending ?? 0,      total: s?.totalInvoices ?? 0, color: "#d97706", icon: "⏳" },
    { title: "الفواتير المرفوضة",   value: s?.rejected ?? 0,     total: s?.totalInvoices ?? 0, color: "#dc2626", icon: "❌" },
    { title: "الفواتير ذات الأخطاء", value: s?.errors ?? 0,       total: s?.totalInvoices ?? 0, color: "#7c3aed", icon: "⚠️" },
    { title: "غير مُرسَلة",          value: s?.notSubmitted ?? 0,  total: s?.totalInvoices ?? 0, color: "#6b7280", icon: "📭" },
  ];

  return (
    <div>
      <SecTitle icon="📊" title="التقارير والإحصائيات" />

      {/* ملخص */}
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

      {/* الإجمالي */}
      <div style={{ background: "#fff", borderRadius: 8, padding: "14px 16px", border: "1px solid #e2e8f0", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>إجمالي الفواتير</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{s?.totalInvoices ?? 0}</div>
          </div>
          {s && s.totalInvoices > 0 && (
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 2, height: 16, borderRadius: 8, overflow: "hidden" }}>
                {[
                  { v: s.cleared,      c: "#16a34a" },
                  { v: s.pending,      c: "#d97706" },
                  { v: s.rejected,     c: "#dc2626" },
                  { v: s.errors,       c: "#7c3aed" },
                  { v: s.notSubmitted, c: "#e2e8f0" },
                ].map((seg, i) => (
                  <div key={i} style={{ flex: seg.v, background: seg.c, minWidth: seg.v > 0 ? 4 : 0 }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#6b7280", flexWrap: "wrap" }}>
                {[["#16a34a","مُخلَّصة"], ["#d97706","انتظار"], ["#dc2626","مرفوضة"], ["#7c3aed","أخطاء"], ["#e2e8f0","لم تُرسَل"]].map(([c,l]) => (
                  <span key={l} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />{l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* آخر العمليات */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12 }}>🕐 آخر 5 عمليات</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <tbody>
            {(logsQ.data?.logs ?? []).map((log, i) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "6px 12px", color: "#6b7280" }}>{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                <td style={{ padding: "6px 12px", fontWeight: 700, color: "#D19C05" }}>{log.invoiceNumber ?? "-"}</td>
                <td style={{ padding: "6px 12px" }}>
                  <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 8, fontWeight: 700, color: STATUS_MAP[log.status]?.color ?? "#6b7280", background: STATUS_MAP[log.status]?.bg ?? "#f3f4f6" }}>
                    {STATUS_MAP[log.status]?.label ?? log.status}
                  </span>
                </td>
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
  const [active, setActive] = useState<Section>("dashboard");

  function renderSection() {
    switch (active) {
      case "dashboard": return <DashboardSection />;
      case "env":       return <EnvSection />;
      case "devices":   return <ComingSoonSection icon="💻" title="إدارة الأجهزة (EGS)"
        description="إدارة أجهزة الفوترة الإلكترونية المسجلة لدى الهيئة مع تتبع حالة كل جهاز واتصاله."
        features={["اسم الجهاز + UUID","Device ID + رقم تسلسلي","الفرع والمستخدم","حالة التسجيل","CSID الحالي","اختبار الجهاز","إعادة التسجيل","إلغاء الجهاز"]} />;
      case "certs":     return <CertsSection />;
      case "keys":      return <ComingSoonSection icon="🔐" title="إدارة مفاتيح التشفير"
        description="إنشاء وإدارة مفاتيح التشفير المستخدمة في توقيع الفواتير وفق معايير ZATCA."
        features={["Private Key EC secp256k1","Public Key","مفتاح التوقيع","تشفير AES-256","تدوير المفاتيح","نسخ احتياطي مشفّر","HSM Support","Key Lifecycle"]} />;
      case "xmlcheck":  return <XmlCheckSection />;
      case "csr":       return <ComingSoonSection icon="📜" title="إنشاء CSR"
        description="إنشاء Certificate Signing Request تلقائياً وفق مواصفات ZATCA مع تعبئة جميع بيانات المنشأة والجهاز."
        features={["توليد CSR تلقائي","بيانات المنشأة","بيانات الجهاز","EC key pair","مواصفات X.509","حفظ في DB","تصدير PEM","رفع للهيئة"]} />;
      case "register":  return <ComingSoonSection icon="📱" title="تسجيل الجهاز — معالج خطوة بخطوة"
        description="معالج مُرشِد لتسجيل جهاز الفوترة الإلكترونية لدى هيئة الزكاة من 8 خطوات."
        features={["اختيار المنشأة","اختيار الفرع","اختيار الجهاز","إدخال OTP فاتورة","رفع CSR","استلام CSID","اختبار الاتصال","اعتماد الجهاز"]} />;
      case "csid":      return <CsidSection />;
      case "test":      return <TestSection />;
      case "send":      return <SendSection />;
      case "oplogs":    return <LogsSection errorsOnly={false} />;
      case "errlogs":   return <LogsSection errorsOnly />;
      case "diag":      return <DiagSection />;
      case "reports":   return <ReportsSection />;
    }
  }

  const cur = SECTIONS.find(s => s.id === active);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif", display: "grid", gridTemplateColumns: "220px 1fr", gap: 0, minHeight: 500 }}>
      {/* القائمة الجانبية */}
      <div style={{ background: "#1e293b", borderRadius: "10px 0 0 10px", padding: "16px 0", overflowY: "auto" }}>
        {/* رأس */}
        <div style={{ padding: "0 14px 14px", borderBottom: "1px solid #334155", marginBottom: 8 }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>🏛️</div>
          <div style={{ fontWeight: 800, fontSize: 12, color: "#f8fafc", lineHeight: 1.4 }}>مركز التكامل مع هيئة الزكاة والضريبة والجمارك</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>ZATCA Integration Center</div>
        </div>
        {/* عناصر القائمة */}
        {SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => setActive(s.id)}
            style={{ width: "100%", textAlign: "right", padding: "8px 14px", background: active === s.id ? "#D19C05" : "transparent", color: active === s.id ? "#fff" : "#94a3b8", border: "none", cursor: "pointer", fontSize: 12, fontWeight: active === s.id ? 700 : 400, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s", borderRight: active === s.id ? "3px solid #F59E0B" : "3px solid transparent" }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ flex: 1 }}>{i + 1}. {s.label}</span>
            {s.badge && (
              <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 6, background: "#334155", color: "#94a3b8" }}>{s.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* منطقة المحتوى */}
      <div style={{ background: "#f8fafc", borderRadius: "0 10px 10px 0", padding: 20, overflowY: "auto" }}>
        {/* عنوان القسم */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <span style={{ fontSize: 22 }}>{cur?.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>{cur?.label}</div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>مركز التكامل مع هيئة الزكاة والضريبة والجمارك</div>
          </div>
        </div>
        {renderSection()}
      </div>
    </div>
  );
}
