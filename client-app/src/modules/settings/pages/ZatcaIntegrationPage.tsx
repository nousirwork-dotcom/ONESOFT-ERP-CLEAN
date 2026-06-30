/**
 * ZatcaIntegrationPage.tsx — منظومة الربط الإلكتروني مع هيئة الزكاة والضريبة والجمارك
 * يدعم: إعدادات | لوحة المتابعة | الفواتير | سجل العمليات | سجل الأخطاء
 * الصلاحيات: مسؤول ZATCA (admin/superadmin) — عرض موسّع + تحرير
 *             مستخدم عادي — عرض محدود بدون بيانات حساسة
 */
import React, { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type ZatcaTab = "settings" | "monitor" | "invoices" | "logs" | "errors" | "xmlcheck";

// ─── مساعدات العرض ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_submitted: { label: "لم تُرسَل",    color: "#6b7280", bg: "#f3f4f6" },
  pending:       { label: "في الانتظار",  color: "#d97706", bg: "#fef3c7" },
  cleared:       { label: "مُخلَّصة",     color: "#16a34a", bg: "#dcfce7" },
  reported:      { label: "مُبلَّغة",     color: "#0ea5e9", bg: "#e0f2fe" },
  rejected:      { label: "مرفوضة",      color: "#dc2626", bg: "#fee2e2" },
  error:         { label: "خطأ",          color: "#dc2626", bg: "#fee2e2" },
  success:       { label: "ناجحة",        color: "#16a34a", bg: "#dcfce7" },
};

const EVENT_MAP: Record<string, string> = {
  submit:               "إرسال",
  resend:               "إعادة إرسال",
  manual_status_update: "تحديث يدوي",
  config_update:        "تحديث الإعدادات",
  connection_test:      "اختبار الاتصال",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_MAP[status ?? "not_submitted"] ?? STATUS_MAP.not_submitted;
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 10, fontSize: 11,
      fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}33`,
    }}>{s.label}</span>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #fde68a" }}>
        {icon} {title}
      </div>
    </div>
  );
}

const fld: React.CSSProperties = { height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px", fontSize: 12, width: "100%", background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 };
const grp: React.CSSProperties = { marginBottom: 14 };

// ─── شاشة الإعدادات ───────────────────────────────────────────────────────────
function ZatcaSettings() {
  const utils    = trpc.useUtils();
  const cfgQuery = trpc.zatca.getConfig.useQuery();
  const saveMut  = trpc.zatca.saveConfig.useMutation({
    onSuccess: () => { toast.success("تم حفظ إعدادات ZATCA بنجاح"); utils.zatca.getConfig.invalidate(); },
    onError:   (e) => toast.error(e.message),
  });
  const testMut  = trpc.zatca.testConnection.useMutation({
    onSuccess: (r) => r.ok ? toast.success(r.message) : toast.error(r.message),
    onError:   (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const data = cfgQuery.data;
  const cfg  = { ...(data ?? {}), ...form };
  const isAdmin = data?.isAdmin ?? false;

  const set  = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const save = () => saveMut.mutate(cfg as any);

  if (cfgQuery.isLoading) return <div className="p-8 text-center text-sm text-gray-400">جارٍ التحميل...</div>;

  const step = cfg.onboardingStep ?? 0;

  // تحذير انتهاء الشهادة
  let certWarningBanner: React.ReactNode = null;
  if (cfg.certExpiryDate) {
    const diff = Math.ceil((new Date(cfg.certExpiryDate).getTime() - Date.now()) / 86400000);
    if (diff <= 30) {
      const clr = diff <= 7 ? "#dc2626" : diff <= 15 ? "#d97706" : "#d97706";
      const bg  = diff <= 7 ? "#fee2e2" : "#fef3c7";
      certWarningBanner = (
        <div style={{ background: bg, border: `1px solid ${clr}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>{diff <= 7 ? "🚨" : "⚠️"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: clr }}>
              {diff <= 0 ? "انتهت صلاحية الشهادة!" : `تنتهي الشهادة خلال ${diff} يوم`}
            </div>
            <div style={{ fontSize: 11, color: clr, opacity: 0.8 }}>
              تاريخ الانتهاء: {new Date(cfg.certExpiryDate).toLocaleDateString("ar-SA")} — يرجى تجديد الشهادة لدى الهيئة
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{ maxWidth: 740 }}>
      {certWarningBanner}

      {/* خطوات التفعيل */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        {["بيانات المنشأة", "بيانات الاتصال", "الشهادة والمفتاح", "التفعيل"].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 4px", fontSize: 11, fontWeight: 700, background: step > i ? "#16a34a" : step === i ? "#D19C05" : "#f8fafc", color: step >= i ? "#fff" : "#6b7280", borderRight: i < 3 ? "1px solid #e2e8f0" : undefined }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{step > i ? "✓" : i + 1}</div>
            {s}
          </div>
        ))}
      </div>

      {/* تفعيل / بيئة */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "10px 14px", background: cfg.enabled ? "#dcfce7" : "#f1f5f9", borderRadius: 8, border: `1px solid ${cfg.enabled ? "#16a34a" : "#cbd5e1"}` }}>
        {isAdmin ? (
          <input type="checkbox" id="zatca-enabled" checked={!!cfg.enabled} onChange={e => set("enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: "#D19C05" }} />
        ) : (
          <span style={{ fontSize: 16 }}>{cfg.enabled ? "✅" : "⭕"}</span>
        )}
        <label htmlFor="zatca-enabled" style={{ fontWeight: 700, fontSize: 13, color: cfg.enabled ? "#16a34a" : "#374151", cursor: isAdmin ? "pointer" : "default" }}>
          {cfg.enabled ? "✓ منظومة ZATCA مُفعَّلة" : "منظومة ZATCA غير مُفعَّلة"}
        </label>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          {isAdmin ? (
            <select value={cfg.environment ?? "sandbox"} onChange={e => set("environment", e.target.value)} style={{ height: 26, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px", fontSize: 11, fontWeight: 700, color: cfg.environment === "production" ? "#dc2626" : "#d97706" }}>
              <option value="sandbox">🧪 بيئة الاختبار (Sandbox)</option>
              <option value="production">🟢 بيئة الإنتاج (Production)</option>
            </select>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: cfg.environment === "production" ? "#dcfce7" : "#fef3c7", color: cfg.environment === "production" ? "#16a34a" : "#d97706" }}>
              {cfg.environment === "production" ? "🟢 إنتاج" : "🧪 اختبار"}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* حالة الخدمة — مرئية للجميع */}
        <SectionTitle icon="📋" title="حالة خدمة الربط" />
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
          {[
            { label: "حالة الخدمة",           value: cfg.enabled ? "✅ مُفعَّلة" : "⭕ غير مُفعَّلة" },
            { label: "تاريخ التفعيل",          value: cfg.serviceActivatedAt ? new Date(cfg.serviceActivatedAt).toLocaleDateString("ar-SA") : "—" },
            { label: "فنّي التفعيل",           value: cfg.serviceActivatedBy ?? "—" },
            { label: "آخر تحديث للإعدادات",    value: cfg.lastConfigUpdate ? new Date(cfg.lastConfigUpdate).toLocaleString("ar-SA") : "—" },
            { label: "آخر اختبار اتصال",       value: cfg.lastConnectionTest ? new Date(cfg.lastConnectionTest).toLocaleString("ar-SA") : "لم يُختبر" },
            { label: "حالة الاتصال",           value: cfg.lastConnectionStatus === "success" ? "✅ متصل" : cfg.lastConnectionStatus === "failed" ? "❌ منقطع" : "—" },
          ].map(item => (
            <div key={item.label} style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{item.value}</div>
            </div>
          ))}
        </div>

        {isAdmin && (
          <div style={{ gridColumn: "1 / -1", marginBottom: 8 }}>
            <button onClick={() => testMut.mutate()} disabled={testMut.isPending} style={{ height: 30, padding: "0 16px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #0369a1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: testMut.isPending ? 0.6 : 1 }}>
              {testMut.isPending ? "جارٍ الاختبار..." : "🔌 اختبار الاتصال بالهيئة"}
            </button>
          </div>
        )}

        {/* بيانات المنشأة */}
        <SectionTitle icon="🏢" title="بيانات المنشأة" />
        <div style={grp}>
          <label style={lbl}>الرقم الضريبي (VAT)</label>
          <input style={fld} value={cfg.vatNumber ?? ""} onChange={e => set("vatNumber", e.target.value)} placeholder="3XXXXXXXXXXXXXXXXX3" readOnly={!isAdmin} />
        </div>
        <div style={grp}>
          <label style={lbl}>السجل التجاري</label>
          <input style={fld} value={cfg.crNumber ?? ""} onChange={e => set("crNumber", e.target.value)} placeholder="10XXXXXXXX" readOnly={!isAdmin} />
        </div>
        <div style={grp}>
          <label style={lbl}>اسم المنشأة (عربي)</label>
          <input style={fld} value={cfg.businessName ?? ""} onChange={e => set("businessName", e.target.value)} readOnly={!isAdmin} />
        </div>
        <div style={grp}>
          <label style={lbl}>اسم المنشأة (إنجليزي)</label>
          <input style={{ ...fld, direction: "ltr" }} value={cfg.businessNameEn ?? ""} onChange={e => set("businessNameEn", e.target.value)} readOnly={!isAdmin} />
        </div>

        {/* العنوان */}
        <SectionTitle icon="📍" title="عنوان المنشأة" />
        <div style={grp}><label style={lbl}>رقم المبنى</label><input style={fld} value={cfg.buildingNumber ?? ""} onChange={e => set("buildingNumber", e.target.value)} readOnly={!isAdmin} /></div>
        <div style={grp}><label style={lbl}>اسم الشارع</label><input style={fld} value={cfg.streetName ?? ""} onChange={e => set("streetName", e.target.value)} readOnly={!isAdmin} /></div>
        <div style={grp}><label style={lbl}>الحي</label><input style={fld} value={cfg.district ?? ""} onChange={e => set("district", e.target.value)} readOnly={!isAdmin} /></div>
        <div style={grp}><label style={lbl}>المدينة</label><input style={fld} value={cfg.city ?? ""} onChange={e => set("city", e.target.value)} readOnly={!isAdmin} /></div>
        <div style={grp}><label style={lbl}>الرمز البريدي</label><input style={fld} value={cfg.postalCode ?? ""} onChange={e => set("postalCode", e.target.value)} readOnly={!isAdmin} /></div>
        <div style={grp}>
          <label style={lbl}>نوع العملاء</label>
          <select value={cfg.sellerType ?? "both"} onChange={e => set("sellerType", e.target.value)} style={fld} disabled={!isAdmin}>
            <option value="both">B2B + B2C (الكل)</option>
            <option value="B2B">B2B فقط (شركات)</option>
            <option value="B2C">B2C فقط (أفراد)</option>
          </select>
        </div>

        {/* إعدادات الإرسال */}
        {isAdmin && (
          <>
            <SectionTitle icon="⚙️" title="إعدادات الإرسال التلقائي" />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 24 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={!!cfg.submitOnPost} onChange={e => set("submitOnPost", e.target.checked)} style={{ width: 14, height: 14, accentColor: "#D19C05" }} />
                إرسال تلقائي عند الترحيل
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={!!cfg.autoSubmit} onChange={e => set("autoSubmit", e.target.checked)} style={{ width: 14, height: 14, accentColor: "#D19C05" }} />
                إرسال تلقائي عند الحفظ
              </label>
            </div>
          </>
        )}

        {/* بيانات الاتصال — للمسؤول فقط */}
        {isAdmin && (
          <>
            <SectionTitle icon="🔑" title="بيانات الاتصال بالهيئة (CSID) — للمسؤول فقط" />
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#92400e", marginBottom: 10 }}>
                ℹ️ هذه البيانات حساسة — مرئية لمسؤول الربط فقط. لا تُشارك هذه البيانات مع أي جهة.
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", ...grp }}>
              <label style={lbl}>CSID (معرّف الشهادة)</label>
              <input style={{ ...fld, direction: "ltr", fontFamily: "monospace", fontSize: 11 }} value={cfg.csid ?? ""} onChange={e => set("csid", e.target.value)} placeholder="Base64 encoded CSID..." />
            </div>
            <div style={{ gridColumn: "1 / -1", ...grp }}>
              <label style={lbl}>Secret Key (المفتاح السري)</label>
              <input type="password" style={{ ...fld, direction: "ltr", fontFamily: "monospace", fontSize: 11 }} value={cfg.secretKey ?? ""} onChange={e => set("secretKey", e.target.value)} placeholder="••••••••••••••••" />
            </div>
            <div style={{ gridColumn: "1 / -1", ...grp }}>
              <label style={lbl}>رابط API الهيئة</label>
              <input style={{ ...fld, direction: "ltr", fontSize: 11 }} value={cfg.apiBaseUrl ?? ""} onChange={e => set("apiBaseUrl", e.target.value)} />
            </div>
            <SectionTitle icon="🛡️" title="معلومات الشهادة" />
            <div style={grp}>
              <label style={lbl}>رقم تسلسل الشهادة</label>
              <input style={{ ...fld, direction: "ltr", fontFamily: "monospace" }} value={cfg.certSerialNumber ?? ""} onChange={e => set("certSerialNumber", e.target.value)} placeholder="SN-XXXXXXX" />
            </div>
            <div style={grp}>
              <label style={lbl}>تاريخ انتهاء الشهادة</label>
              <input type="date" style={fld} value={cfg.certExpiryDate?.slice(0, 10) ?? ""} onChange={e => set("certExpiryDate", e.target.value)} />
            </div>
          </>
        )}
      </div>

      {isAdmin && (
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button onClick={save} disabled={saveMut.isPending} style={{ height: 34, padding: "0 22px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saveMut.isPending ? 0.6 : 1 }}>
            {saveMut.isPending ? "جارٍ الحفظ..." : "💾 حفظ الإعدادات"}
          </button>
          <button onClick={() => setForm({})} style={{ height: 34, padding: "0 16px", background: "#f1f5f9", color: "#374151", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            تراجع
          </button>
        </div>
      )}
    </div>
  );
}

// ─── لوحة المتابعة ────────────────────────────────────────────────────────────
function ZatcaMonitor() {
  const statsQ = trpc.zatca.getStats.useQuery();
  const s = statsQ.data;

  const cards = [
    { label: "إجمالي الفواتير",  value: s?.totalInvoices ?? 0, color: "#6366f1", icon: "📄" },
    { label: "مُخلَّصة ✓",       value: s?.cleared ?? 0,        color: "#16a34a", icon: "✅" },
    { label: "في الانتظار",      value: s?.pending ?? 0,        color: "#d97706", icon: "⏳" },
    { label: "مرفوضة",           value: s?.rejected ?? 0,       color: "#dc2626", icon: "❌" },
    { label: "أخطاء",            value: s?.errors ?? 0,         color: "#7c3aed", icon: "⚠️" },
    { label: "لم تُرسَل",        value: s?.notSubmitted ?? 0,   color: "#6b7280", icon: "📭" },
  ];

  // بطاقة الشهادة
  const certColor = s?.certWarning === "critical" ? "#dc2626" : s?.certWarning === "warning" ? "#d97706" : s?.certWarning === "ok" ? "#16a34a" : "#6b7280";
  const certIcon  = s?.certWarning === "critical" ? "🚨" : s?.certWarning === "warning" ? "⚠️" : s?.certWarning === "ok" ? "🛡️" : "🛡️";

  // بطاقة الاتصال
  const connColor = s?.connectionStatus === "success" ? "#16a34a" : s?.connectionStatus === "failed" ? "#dc2626" : "#6b7280";
  const connIcon  = s?.connectionStatus === "success" ? "🟢" : s?.connectionStatus === "failed" ? "🔴" : "⚪";

  return (
    <div>
      {/* تحذير انتهاء الشهادة */}
      {s?.certWarning === "critical" && (
        <div style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          🚨 <strong style={{ color: "#dc2626" }}>تنبيه عاجل:</strong>
          <span style={{ color: "#dc2626", fontSize: 13 }}>
            {s.certDaysLeft !== null && s.certDaysLeft <= 0
              ? "انتهت صلاحية شهادة CSID — يجب تجديدها فوراً!"
              : `تنتهي شهادة CSID خلال ${s.certDaysLeft} أيام فقط!`}
          </span>
        </div>
      )}
      {s?.certWarning === "warning" && (
        <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
          ⚠️ <span style={{ color: "#92400e", fontSize: 13 }}>تنتهي شهادة CSID خلال <strong>{s.certDaysLeft} يوم</strong> — يُرجى التخطيط للتجديد مع المطور.</span>
        </div>
      )}

      {/* بطاقات الإحصائيات */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "14px 10px", border: `1px solid ${c.color}33`, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* بطاقتا الاتصال والشهادة */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: `1px solid ${connColor}33`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{connIcon}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>حالة الاتصال بالهيئة</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: connColor }}>
            {s?.connectionStatus === "success" ? "متصل بنجاح" : s?.connectionStatus === "failed" ? "انقطع الاتصال" : "غير مُختبر"}
          </div>
          {s?.lastConnectionTest && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              آخر اختبار: {new Date(s.lastConnectionTest).toLocaleString("ar-SA")}
            </div>
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 10, padding: "16px 18px", border: `1px solid ${certColor}33`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>{certIcon}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>حالة شهادة CSID</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: certColor }}>
            {s?.certExpiryDate
              ? (s.certDaysLeft !== null && s.certDaysLeft > 0 ? `صالحة — ${s.certDaysLeft} يوم متبقٍ` : "منتهية الصلاحية")
              : "غير محدد"}
          </div>
          {s?.certExpiryDate && (
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
              تاريخ الانتهاء: {new Date(s.certExpiryDate).toLocaleDateString("ar-SA")}
            </div>
          )}
        </div>
      </div>

      {/* بيئة التشغيل */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#374151" }}>البيئة الحالية:</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 12px", borderRadius: 10, background: s?.environment === "production" ? "#dcfce7" : "#fef3c7", color: s?.environment === "production" ? "#16a34a" : "#d97706", border: `1px solid ${s?.environment === "production" ? "#16a34a" : "#d97706"}` }}>
          {s?.environment === "production" ? "🟢 بيئة الإنتاج" : "🧪 بيئة الاختبار"}
        </span>
      </div>

      {/* شريط الامتثال */}
      <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 12 }}>📊 حالة الامتثال لمتطلبات الهيئة</div>
        {s && s.totalInvoices > 0 ? (
          <>
            <div style={{ height: 12, borderRadius: 6, background: "#f1f5f9", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${(s.cleared / s.totalInvoices) * 100}%`, background: "#16a34a", borderRadius: 6, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              نسبة الامتثال: <strong style={{ color: "#16a34a" }}>{Math.round((s.cleared / s.totalInvoices) * 100)}%</strong>
              &nbsp;— {s.cleared} من {s.totalInvoices} فاتورة مُخلَّصة
              {s.rejected > 0 && <span style={{ color: "#dc2626" }}> | {s.rejected} مرفوضة</span>}
              {s.errors > 0 && <span style={{ color: "#7c3aed" }}> | {s.errors} أخطاء</span>}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "30px", color: "#9ca3af", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            لا توجد فواتير مبيعات بعد
          </div>
        )}
      </div>
    </div>
  );
}

// ─── قائمة الفواتير ───────────────────────────────────────────────────────────
function ZatcaInvoices() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [xmlModal, setXmlModal] = useState<string | null>(null);
  const [responseModal, setResponseModal] = useState<any>(null);

  const listQ   = trpc.zatca.getInvoicesList.useQuery({ page, limit: 20, status: filterStatus || undefined });
  const submitM = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (r) => { toast.success(r.message ?? "تم الإرسال"); listQ.refetch(); },
    onError:   (e) => toast.error(e.message),
  });

  const rows = listQ.data?.invoices ?? [];

  const shortHash = (h: string | null | undefined) => h ? `${h.slice(0, 8)}…` : "—";
  const shortUuid = (u: string | null | undefined) => u ? `${u.slice(0, 12)}…` : "—";

  return (
    <div>
      {/* XML Modal */}
      {xmlModal !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setXmlModal(null)}>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 20, maxWidth: 700, width: "90%", maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#e2e8f0", fontWeight: 700 }}>📄 UBL XML</span>
              <button onClick={() => setXmlModal(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", whiteSpace: "pre-wrap", margin: 0 }}>{xmlModal || "لا يوجد XML مُولَّد"}</pre>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {responseModal !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setResponseModal(null)}>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: 20, maxWidth: 600, width: "90%", maxHeight: "80vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#e2e8f0", fontWeight: 700 }}>📡 استجابة الهيئة</span>
              <button onClick={() => setResponseModal(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#e2e8f0", whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(responseModal, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["", "not_submitted", "pending", "cleared", "rejected", "error"].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }} style={{ height: 26, padding: "0 12px", borderRadius: 12, border: `1px solid ${filterStatus === s ? "#D19C05" : "#e2e8f0"}`, background: filterStatus === s ? "#D19C05" : "#fff", color: filterStatus === s ? "#fff" : "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {s === "" ? "الكل" : (STATUS_MAP[s]?.label ?? s)}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "الحالة", "UUID", "Hash", "تخليص", "إبلاغ", "وقت الإرسال", "المحاولات", "سبب الرفض", "الإجراءات"].map(h => (
                <th key={h} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد فواتير</td></tr>
            ) : rows.map((inv, i) => {
              const resp = inv.zatcaResponse as any;
              const clearance = resp?.clearanceStatus ?? "—";
              const reporting = resp?.reportingStatus ?? "—";
              return (
                <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: "#D19C05", whiteSpace: "nowrap" }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: "5px 8px", color: "#6b7280", whiteSpace: "nowrap" }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("ar-SA") : "-"}</td>
                  <td style={{ padding: "5px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customerName ?? "-"}</td>
                  <td style={{ padding: "5px 8px", fontWeight: 600, direction: "ltr", textAlign: "left", whiteSpace: "nowrap" }}>{parseFloat(inv.total ?? "0").toLocaleString("en", { minimumFractionDigits: 2 })} SAR</td>
                  <td style={{ padding: "5px 8px" }}><StatusBadge status={inv.zatcaStatus} /></td>
                  <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#6366f1", fontSize: 10 }} title={inv.zatcaUuid ?? ""}>{shortUuid(inv.zatcaUuid)}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "monospace", color: "#6b7280", fontSize: 10 }} title={inv.zatcaHash ?? ""}>{shortHash(inv.zatcaHash)}</td>
                  <td style={{ padding: "5px 8px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: clearance === "CLEARED" ? "#16a34a" : "#6b7280" }}>{clearance}</span>
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: reporting === "REPORTED" ? "#0ea5e9" : "#6b7280" }}>{reporting}</span>
                  </td>
                  <td style={{ padding: "5px 8px", color: "#6b7280", fontSize: 10, whiteSpace: "nowrap" }}>
                    {inv.zatcaSubmittedAt ? new Date(inv.zatcaSubmittedAt).toLocaleString("ar-SA") : "—"}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: (inv.zatcaAttemptCount ?? 0) > 1 ? "#d97706" : "#6b7280" }}>
                    {inv.zatcaAttemptCount ?? 0}
                  </td>
                  <td style={{ padding: "5px 8px", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#dc2626", fontSize: 10 }}
                    title={inv.zatcaRejectionReason ?? ""}>
                    {inv.zatcaRejectionReason ?? "—"}
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {inv.zatcaStatus !== "cleared" && (
                        <button onClick={() => submitM.mutate({ invoiceId: inv.id, forceResend: (inv.zatcaAttemptCount ?? 0) > 0 })} disabled={submitM.isPending}
                          style={{ height: 20, padding: "0 7px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          {(inv.zatcaAttemptCount ?? 0) > 0 ? "↩ إعادة" : "إرسال"}
                        </button>
                      )}
                      {inv.zatcaXml && (
                        <button onClick={() => setXmlModal(inv.zatcaXml ?? "")}
                          style={{ height: 20, padding: "0 7px", background: "#e0f2fe", color: "#0369a1", border: "1px solid #0369a1", borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          XML
                        </button>
                      )}
                      {inv.zatcaResponse && (
                        <button onClick={() => setResponseModal(inv.zatcaResponse)}
                          style={{ height: 20, padding: "0 7px", background: "#f3e8ff", color: "#7c3aed", border: "1px solid #7c3aed", borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          JSON
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ترقيم الصفحات */}
      {(listQ.data?.pages ?? 0) > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
          {Array.from({ length: listQ.data?.pages ?? 0 }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${page === i + 1 ? "#D19C05" : "#e2e8f0"}`, background: page === i + 1 ? "#D19C05" : "#fff", color: page === i + 1 ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── سجل العمليات ─────────────────────────────────────────────────────────────
function ZatcaLogs({ errorsOnly = false }: { errorsOnly?: boolean }) {
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [invNum,   setInvNum]   = useState("");
  const [evType,   setEvType]   = useState("");
  const [status,   setStatus]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const logsQ = trpc.zatca.getLogs.useQuery({
    page, limit: 50,
    invoiceNumber: invNum || undefined,
    eventType:     evType || undefined,
    status:        status || undefined,
    dateFrom:      dateFrom || undefined,
    dateTo:        dateTo || undefined,
    errorsOnly,
  });
  const rows = logsQ.data?.logs ?? [];

  const exportCsv = () => {
    const header = ["التاريخ", "الفاتورة", "نوع العملية", "الحالة", "البيئة", "المستخدم", "رسالة الخطأ"];
    const lines  = rows.map(r => [
      new Date(r.createdAt).toLocaleString("ar-SA"),
      r.invoiceNumber ?? "",
      EVENT_MAP[r.eventType] ?? r.eventType,
      r.status,
      r.environment ?? "",
      r.userName ?? "",
      r.errorMessage ?? "",
    ].join(","));
    const csv  = [header.join(","), ...lines].join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    link.download = `zatca-logs-${Date.now()}.csv`;
    link.click();
  };

  return (
    <div>
      {/* فلاتر البحث */}
      <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", marginBottom: 14, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) auto", gap: 8, alignItems: "end" }}>
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
          <div>
            <label style={lbl}>من تاريخ</label>
            <input type="date" style={{ ...fld, height: 26 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label style={lbl}>إلى تاريخ</label>
            <input type="date" style={{ ...fld, height: 26 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setInvNum(""); setEvType(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }} style={{ height: 26, padding: "0 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>مسح</button>
            <button onClick={exportCsv} style={{ height: 26, padding: "0 10px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>📥 CSV</button>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
          {logsQ.data?.total ?? 0} سجل
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["التاريخ", "الفاتورة", "نوع العملية", "الحالة", "البيئة", "المستخدم", "الخطأ", "تفاصيل"].map(h => (
                <th key={h} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد سجلات</td></tr>
            ) : rows.map((log, i) => (
              <React.Fragment key={log.id}>
                <tr style={{ borderBottom: "1px solid #f1f5f9", background: log.status === "error" || log.status === "rejected" ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafafa", cursor: log.responseBody ? "pointer" : "default" }}
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <td style={{ padding: "5px 8px", color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("ar-SA")}</td>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: "#D19C05" }}>{log.invoiceNumber ?? "-"}</td>
                  <td style={{ padding: "5px 8px" }}>{EVENT_MAP[log.eventType] ?? log.eventType}</td>
                  <td style={{ padding: "5px 8px" }}><StatusBadge status={log.status} /></td>
                  <td style={{ padding: "5px 8px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: log.environment === "production" ? "#dcfce7" : "#fef3c7", color: log.environment === "production" ? "#16a34a" : "#d97706" }}>
                      {log.environment === "production" ? "إنتاج" : "اختبار"}
                    </span>
                  </td>
                  <td style={{ padding: "5px 8px", color: "#374151" }}>{log.userName ?? "-"}</td>
                  <td style={{ padding: "5px 8px", color: "#dc2626", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={log.errorMessage ?? ""}>{log.errorMessage ?? "-"}</td>
                  <td style={{ padding: "5px 8px", color: "#6366f1" }}>{log.responseBody ? (expanded === log.id ? "▲" : "▼") : ""}</td>
                </tr>
                {expanded === log.id && log.responseBody && (
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={8} style={{ padding: "8px 14px" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", background: "#1e293b", color: "#e2e8f0", borderRadius: 6, padding: "10px 14px" }}>
                        {(() => { try { return JSON.stringify(JSON.parse(log.responseBody), null, 2); } catch { return log.responseBody; } })()}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {(logsQ.data?.pages ?? 0) > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
          {Array.from({ length: logsQ.data?.pages ?? 0 }, (_, i) => (
            <button key={i + 1} onClick={() => setPage(i + 1)} style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${page === i + 1 ? "#D19C05" : "#e2e8f0"}`, background: page === i + 1 ? "#D19C05" : "#fff", color: page === i + 1 ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── أداة التحقق من XML ───────────────────────────────────────────────────────
function ZatcaXmlValidator() {
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [searchInv,  setSearchInv]  = useState("");
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showXml, setShowXml] = useState(false);

  // جلب قائمة الفواتير للاختيار منها
  const invListQ = trpc.zatca.getInvoicesList.useQuery({ page: 1, limit: 50 });
  const invoices = invListQ.data?.invoices ?? [];
  const filtered = invoices.filter(i =>
    !searchInv || i.invoiceNumber?.toLowerCase().includes(searchInv.toLowerCase()) || (i.customerName ?? "").includes(searchInv)
  );

  const validateM = trpc.zatca.validateXml.useMutation();
  const result    = validateM.data;

  const handleValidate = () => {
    if (!invoiceId) return toast.error("اختر فاتورة أولاً");
    validateM.mutate({ invoiceId });
    setSelectedRow(null);
    setShowXml(false);
  };

  const selectedRule = result?.results.find(r => r.id === selectedRow);

  const exportCsv = () => {
    if (!result) return;
    const header = ["#", "النوع", "العنصر", "الوصف", "القيمة الحالية", "القيمة المتوقعة", "طريقة الحل"];
    const lines  = result.results.map(r => [r.id, r.type, `"${r.element}"`, `"${r.description}"`, `"${r.currentValue}"`, `"${r.expectedValue}"`, `"${r.fix}"`].join(","));
    const csv  = [header.join(","), ...lines].join("\n");
    const link = document.createElement("a");
    link.href  = `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
    link.download = `zatca-validation-${invoiceId}-${Date.now()}.csv`;
    link.click();
  };

  const copyXml = () => {
    if (result?.xml) { navigator.clipboard.writeText(result.xml); toast.success("تم نسخ XML"); }
  };

  const downloadXml = () => {
    if (!result?.xml) return;
    const link = document.createElement("a");
    link.href  = `data:application/xml;charset=utf-8,${encodeURIComponent(result.xml)}`;
    link.download = `invoice-${invoiceId}.xml`;
    link.click();
  };

  const TYPE_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
    error:   { color: "#dc2626", bg: "#fee2e2", icon: "❌" },
    warning: { color: "#d97706", bg: "#fef3c7", icon: "⚠️" },
    info:    { color: "#16a34a", bg: "#dcfce7", icon: "✅" },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, minHeight: 500 }}>
      {/* العمود الأيسر — اختيار الفاتورة */}
      <div>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: "#1e293b" }}>🔍 اختر فاتورة للتحقق</div>
          <input
            value={searchInv} onChange={e => setSearchInv(e.target.value)}
            placeholder="بحث برقم الفاتورة أو العميل..."
            style={{ ...fld, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 6 }}>
            {filtered.length === 0
              ? <div style={{ padding: "12px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>لا توجد فواتير</div>
              : filtered.map(inv => (
                <div key={inv.id}
                  onClick={() => setInvoiceId(inv.id)}
                  style={{
                    padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                    background: invoiceId === inv.id ? "#fef3c7" : "transparent",
                    borderRight: invoiceId === inv.id ? "3px solid #D19C05" : "3px solid transparent",
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: invoiceId === inv.id ? "#D19C05" : "#1e293b" }}>{inv.invoiceNumber}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{inv.customerName ?? "—"}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("ar-SA") : ""}</div>
                </div>
              ))
            }
          </div>
          <button
            onClick={handleValidate}
            disabled={!invoiceId || validateM.isPending}
            style={{ width: "100%", height: 36, marginTop: 12, background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 13, cursor: invoiceId ? "pointer" : "not-allowed", opacity: (!invoiceId || validateM.isPending) ? 0.6 : 1 }}>
            {validateM.isPending ? "⏳ جارٍ التحقق..." : "🔎 التحقق من الفاتورة"}
          </button>
        </div>

        {/* ملخص النتيجة */}
        {result && (
          <div style={{ background: result.passed ? "#dcfce7" : "#fee2e2", borderRadius: 10, border: `1px solid ${result.passed ? "#16a34a" : "#dc2626"}`, padding: 14 }}>
            <div style={{ fontSize: 22, textAlign: "center", marginBottom: 6 }}>{result.passed ? "✅" : "❌"}</div>
            <div style={{ fontWeight: 800, fontSize: 13, textAlign: "center", color: result.passed ? "#16a34a" : "#dc2626", marginBottom: 8 }}>
              {result.passed ? "الفاتورة مطابقة للمتطلبات" : "توجد أخطاء تحتاج تصحيح"}
            </div>
            {result.passed && <div style={{ fontSize: 11, color: "#15803d", textAlign: "center" }}>✓ الفاتورة جاهزة للإرسال إلى هيئة الزكاة</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
              <div style={{ textAlign: "center", background: "#fee2e2", borderRadius: 6, padding: "6px 4px" }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#dc2626" }}>{result.errorCount}</div>
                <div style={{ fontSize: 10, color: "#dc2626" }}>أخطاء</div>
              </div>
              <div style={{ textAlign: "center", background: "#fef3c7", borderRadius: 6, padding: "6px 4px" }}>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#d97706" }}>{result.warningCount}</div>
                <div style={{ fontSize: 10, color: "#d97706" }}>تحذيرات</div>
              </div>
            </div>
            {result.isGeneratedXml && (
              <div style={{ marginTop: 8, fontSize: 10, color: "#6b7280", textAlign: "center", background: "#f8fafc", borderRadius: 4, padding: "4px 6px" }}>
                ⚠️ تم توليد XML من بيانات الفاتورة (لا يوجد XML مُرسَل)
              </div>
            )}
          </div>
        )}
      </div>

      {/* العمود الأيمن — النتائج + XML */}
      <div>
        {!result && !validateM.isPending && (
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "60px 40px", textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 6 }}>أداة التحقق من XML</div>
            <div style={{ fontSize: 12 }}>اختر فاتورة من القائمة ثم اضغط "التحقق من الفاتورة"</div>
            <div style={{ fontSize: 11, marginTop: 8, color: "#cbd5e1" }}>يتم فحص الفاتورة وفق معايير ZATCA UBL 2.1</div>
          </div>
        )}

        {result && (
          <>
            {/* شريط الأدوات */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShowXml(!showXml)} style={{ height: 28, padding: "0 12px", background: "#1e293b", color: "#e2e8f0", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {showXml ? "▲ إخفاء XML" : "▼ عرض XML"}
              </button>
              <button onClick={copyXml} style={{ height: 28, padding: "0 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📋 نسخ XML</button>
              <button onClick={downloadXml} style={{ height: 28, padding: "0 12px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>⬇️ تحميل XML</button>
              <button onClick={exportCsv} style={{ height: 28, padding: "0 12px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📥 تصدير CSV</button>
            </div>

            {/* عرض XML */}
            {showXml && (
              <div style={{ background: "#1e293b", borderRadius: 8, padding: "12px 14px", marginBottom: 12, maxHeight: 280, overflow: "auto" }}>
                <pre style={{ fontFamily: "monospace", fontSize: 10, color: "#e2e8f0", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {result.xml}
                </pre>
              </div>
            )}

            {/* جدول النتائج */}
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    {["#", "النوع", "العنصر", "الوصف", "القيمة الحالية"].map(h => (
                      <th key={h} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => {
                    const ts = TYPE_STYLE[r.type] ?? TYPE_STYLE.info;
                    const isSelected = selectedRow === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          onClick={() => setSelectedRow(isSelected ? null : r.id)}
                          style={{ borderBottom: "1px solid #f1f5f9", background: isSelected ? `${ts.bg}` : i % 2 === 0 ? "#fff" : "#fafafa", cursor: "pointer" }}>
                          <td style={{ padding: "5px 8px", fontWeight: 700, color: "#6b7280", width: 30 }}>{r.id}</td>
                          <td style={{ padding: "5px 8px", width: 80 }}>
                            <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, color: ts.color, background: ts.bg, border: `1px solid ${ts.color}33` }}>
                              {ts.icon} {r.type === "error" ? "خطأ" : r.type === "warning" ? "تحذير" : "معلومة"}
                            </span>
                          </td>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 9, color: "#6366f1", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.element}>{r.element}</td>
                          <td style={{ padding: "5px 8px", color: r.type === "error" ? "#dc2626" : r.type === "warning" ? "#92400e" : "#374151" }}>{r.description}</td>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: "#6b7280", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.currentValue}>{r.currentValue}</td>
                        </tr>
                        {isSelected && (
                          <tr style={{ background: `${ts.bg}88` }}>
                            <td colSpan={5} style={{ padding: "10px 14px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>القيمة الحالية</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 11, background: "#fff", padding: "6px 8px", borderRadius: 4, border: "1px solid #e2e8f0", wordBreak: "break-all" }}>{r.currentValue || "—"}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>القيمة المتوقعة</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 11, background: "#fff", padding: "6px 8px", borderRadius: 4, border: `1px solid ${ts.color}44`, wordBreak: "break-all" }}>{r.expectedValue}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>🔧 طريقة الحل</div>
                                  <div style={{ fontSize: 11, background: "#fff", padding: "6px 8px", borderRadius: 4, border: "1px solid #e2e8f0" }}>{r.fix}</div>
                                </div>
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

            {/* تفاصيل التحقق */}
            <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280", textAlign: "center" }}>
              انقر على أي صف لعرض تفاصيل المشكلة والحل
              {result.isGeneratedXml && " · XML مُولَّد من بيانات الفاتورة"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function ZatcaIntegrationPage({ initialTab }: { initialTab?: ZatcaTab } = {}) {
  const [tab, setTab] = useState<ZatcaTab>(initialTab ?? "settings");

  const tabs: { id: ZatcaTab; label: string; icon: string }[] = [
    { id: "settings",  label: "الإعدادات",      icon: "⚙️" },
    { id: "monitor",   label: "لوحة المتابعة",   icon: "📊" },
    { id: "invoices",  label: "الفواتير",         icon: "📄" },
    { id: "logs",      label: "سجل العمليات",    icon: "📋" },
    { id: "errors",    label: "سجل الأخطاء",     icon: "🚨" },
    { id: "xmlcheck",  label: "التحقق من XML",    icon: "🔎" },
  ];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', Tahoma, Arial, sans-serif" }}>
      {/* رأس الصفحة */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#D19C05,#F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏛️</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#1e293b" }}>منظومة الربط الإلكتروني — ZATCA</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>هيئة الزكاة والضريبة والجمارك — الفوترة الإلكترونية الإلزامية</div>
        </div>
      </div>

      {/* تبويبات */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, background: "#f1f5f9", padding: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 34, border: "none", borderRadius: 6, background: tab === t.id ? "#fff" : "transparent", color: t.id === "errors" ? (tab === t.id ? "#dc2626" : "#dc2626") : tab === t.id ? "#D19C05" : "#6b7280", fontWeight: tab === t.id ? 800 : 600, fontSize: 11, cursor: "pointer", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {tab === "settings"  && <ZatcaSettings />}
      {tab === "monitor"   && <ZatcaMonitor />}
      {tab === "invoices"  && <ZatcaInvoices />}
      {tab === "logs"      && <ZatcaLogs />}
      {tab === "errors"    && <ZatcaLogs errorsOnly />}
      {tab === "xmlcheck"  && <ZatcaXmlValidator />}
    </div>
  );
}
