/**
 * ZatcaIntegrationPage.tsx
 * منظومة الربط الإلكتروني — هيئة الزكاة والضريبة والجمارك (ZATCA)
 * تغطي: الإعدادات، لوحة المتابعة، قائمة الفواتير، سجل العمليات
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── أنواع ────────────────────────────────────────────────────────────────────
type ZatcaTab = "settings" | "monitor" | "invoices" | "logs";

// ─── مساعدات العرض ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  not_submitted: { label: "لم تُرسَل",    color: "#6b7280", bg: "#f3f4f6" },
  pending:       { label: "في الانتظار",  color: "#d97706", bg: "#fef3c7" },
  cleared:       { label: "مُخلَّصة",     color: "#16a34a", bg: "#dcfce7" },
  reported:      { label: "مُبلَّغة",     color: "#0ea5e9", bg: "#e0f2fe" },
  rejected:      { label: "مرفوضة",      color: "#dc2626", bg: "#fee2e2" },
  error:         { label: "خطأ",          color: "#dc2626", bg: "#fee2e2" },
};

const EVENT_MAP: Record<string, string> = {
  submit:               "إرسال",
  resend:               "إعادة إرسال",
  manual_status_update: "تحديث يدوي",
  config_update:        "تحديث الإعدادات",
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

// ─── شاشة الإعدادات ───────────────────────────────────────────────────────────
function ZatcaSettings() {
  const cfgQuery = trpc.zatca.getConfig.useQuery();
  const saveMut  = trpc.zatca.saveConfig.useMutation({
    onSuccess: () => toast.success("تم حفظ إعدادات ZATCA بنجاح"),
    onError:   (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const cfg = { ...(cfgQuery.data ?? {}), ...form };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const save = () => saveMut.mutate(cfg as any);

  const fieldStyle = {
    input: {
      height: 28, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 8px",
      fontSize: 12, width: "100%", background: "#fff",
    } as React.CSSProperties,
    label: { fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 3 } as React.CSSProperties,
    group: { marginBottom: 14 } as React.CSSProperties,
  };

  if (cfgQuery.isLoading) return <div className="p-8 text-center text-sm text-gray-400">جارٍ التحميل...</div>;

  const step = cfg.onboardingStep ?? 0;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* خطوات التفعيل */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        {["بيانات المنشأة", "بيانات الاتصال", "الشهادة والمفتاح", "التفعيل"].map((s, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", padding: "8px 4px", fontSize: 11, fontWeight: 700,
            background: step > i ? "#16a34a" : step === i ? "#D19C05" : "#f8fafc",
            color: step >= i ? "#fff" : "#6b7280",
            borderRight: i < 3 ? "1px solid #e2e8f0" : undefined,
          }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{step > i ? "✓" : i + 1}</div>
            {s}
          </div>
        ))}
      </div>

      {/* تفعيل / تعطيل */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "10px 14px", background: cfg.enabled ? "#dcfce7" : "#f1f5f9", borderRadius: 8, border: `1px solid ${cfg.enabled ? "#16a34a" : "#cbd5e1"}` }}>
        <input type="checkbox" id="zatca-enabled" checked={!!cfg.enabled} onChange={e => set("enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: "#D19C05" }} />
        <label htmlFor="zatca-enabled" style={{ fontWeight: 700, fontSize: 13, color: cfg.enabled ? "#16a34a" : "#374151", cursor: "pointer" }}>
          {cfg.enabled ? "✓ منظومة ZATCA مُفعَّلة" : "تفعيل منظومة ZATCA"}
        </label>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <select value={cfg.environment ?? "sandbox"} onChange={e => set("environment", e.target.value)} style={{ height: 26, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px", fontSize: 11, fontWeight: 700, color: cfg.environment === "production" ? "#dc2626" : "#d97706" }}>
            <option value="sandbox">🧪 بيئة الاختبار (Sandbox)</option>
            <option value="production">🟢 بيئة الإنتاج (Production)</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* بيانات المنشأة */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #fde68a" }}>
            🏢 بيانات المنشأة
          </div>
        </div>

        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>الرقم الضريبي (VAT)</label>
          <input style={fieldStyle.input} value={cfg.vatNumber ?? ""} onChange={e => set("vatNumber", e.target.value)} placeholder="3XXXXXXXXXXXXXXXXX3" />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>السجل التجاري</label>
          <input style={fieldStyle.input} value={cfg.crNumber ?? ""} onChange={e => set("crNumber", e.target.value)} placeholder="10XXXXXXXX" />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>اسم المنشأة (عربي)</label>
          <input style={fieldStyle.input} value={cfg.businessName ?? ""} onChange={e => set("businessName", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>اسم المنشأة (إنجليزي)</label>
          <input style={{ ...fieldStyle.input, direction: "ltr" }} value={cfg.businessNameEn ?? ""} onChange={e => set("businessNameEn", e.target.value)} />
        </div>

        {/* العنوان */}
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #fde68a" }}>
            📍 عنوان المنشأة
          </div>
        </div>

        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>رقم المبنى</label>
          <input style={fieldStyle.input} value={cfg.buildingNumber ?? ""} onChange={e => set("buildingNumber", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>اسم الشارع</label>
          <input style={fieldStyle.input} value={cfg.streetName ?? ""} onChange={e => set("streetName", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>الحي</label>
          <input style={fieldStyle.input} value={cfg.district ?? ""} onChange={e => set("district", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>المدينة</label>
          <input style={fieldStyle.input} value={cfg.city ?? ""} onChange={e => set("city", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>الرمز البريدي</label>
          <input style={fieldStyle.input} value={cfg.postalCode ?? ""} onChange={e => set("postalCode", e.target.value)} />
        </div>
        <div style={fieldStyle.group}>
          <label style={fieldStyle.label}>نوع العملاء</label>
          <select value={cfg.sellerType ?? "both"} onChange={e => set("sellerType", e.target.value)} style={{ ...fieldStyle.input }}>
            <option value="both">B2B + B2C (الكل)</option>
            <option value="B2B">B2B فقط (شركات)</option>
            <option value="B2C">B2C فقط (أفراد)</option>
          </select>
        </div>

        {/* إعدادات الإرسال */}
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #fde68a" }}>
            ⚙️ إعدادات الإرسال التلقائي
          </div>
        </div>

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

        {/* بيانات الاتصال (CSID) */}
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#D19C05", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #fde68a" }}>
            🔑 بيانات الاتصال بالهيئة (CSID)
          </div>
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#92400e", marginBottom: 10 }}>
            ℹ️ تُستخرج بيانات الاتصال من بوابة الهيئة بعد رفع طلب التسجيل. أدخلها هنا بعد استلامها.
          </div>
        </div>

        <div style={{ gridColumn: "1 / -1", ...fieldStyle.group }}>
          <label style={fieldStyle.label}>CSID (معرّف الشهادة)</label>
          <input style={{ ...fieldStyle.input, direction: "ltr", fontFamily: "monospace", fontSize: 11 }} value={cfg.csid ?? ""} onChange={e => set("csid", e.target.value)} placeholder="Base64 encoded CSID..." />
        </div>
        <div style={{ gridColumn: "1 / -1", ...fieldStyle.group }}>
          <label style={fieldStyle.label}>Secret Key (المفتاح السري)</label>
          <input type="password" style={{ ...fieldStyle.input, direction: "ltr", fontFamily: "monospace", fontSize: 11 }} value={cfg.secretKey ?? ""} onChange={e => set("secretKey", e.target.value)} placeholder="••••••••••••••••" />
        </div>
        <div style={{ gridColumn: "1 / -1", ...fieldStyle.group }}>
          <label style={fieldStyle.label}>رابط API الهيئة</label>
          <input style={{ ...fieldStyle.input, direction: "ltr", fontSize: 11 }} value={cfg.apiBaseUrl ?? ""} onChange={e => set("apiBaseUrl", e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saveMut.isPending} style={{ height: 34, padding: "0 22px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saveMut.isPending ? 0.6 : 1 }}>
          {saveMut.isPending ? "جارٍ الحفظ..." : "💾 حفظ الإعدادات"}
        </button>
        <button onClick={() => setForm({})} style={{ height: 34, padding: "0 16px", background: "#f1f5f9", color: "#374151", border: "1px solid #cbd5e1", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          تراجع
        </button>
      </div>
    </div>
  );
}

// ─── لوحة المتابعة ────────────────────────────────────────────────────────────
function ZatcaMonitor() {
  const statsQ = trpc.zatca.getStats.useQuery();
  const stats = statsQ.data;

  const cards = [
    { label: "إجمالي الفواتير",    value: stats?.totalInvoices ?? 0,  color: "#6366f1", icon: "📄" },
    { label: "مُخلَّصة ✓",         value: stats?.cleared ?? 0,         color: "#16a34a", icon: "✅" },
    { label: "في الانتظار",        value: stats?.pending ?? 0,         color: "#d97706", icon: "⏳" },
    { label: "مرفوضة",             value: stats?.rejected ?? 0,        color: "#dc2626", icon: "❌" },
    { label: "لم تُرسَل",          value: stats?.notSubmitted ?? 0,    color: "#6b7280", icon: "📭" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "16px 14px", border: `1px solid ${c.color}33`, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 12 }}>📊 حالة الامتثال لمتطلبات الهيئة</div>
        {stats && stats.totalInvoices > 0 ? (
          <>
            <div style={{ height: 12, borderRadius: 6, background: "#f1f5f9", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${(stats.cleared / stats.totalInvoices) * 100}%`, background: "#16a34a", borderRadius: 6, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              نسبة الامتثال: <strong style={{ color: "#16a34a" }}>{Math.round((stats.cleared / stats.totalInvoices) * 100)}%</strong>
              &nbsp;— {stats.cleared} من {stats.totalInvoices} فاتورة مُخلَّصة
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
  const listQ  = trpc.zatca.getInvoicesList.useQuery({ page, limit: 30, status: filterStatus || undefined });
  const submitM = trpc.zatca.submitInvoice.useMutation({
    onSuccess: (r) => {
      toast.success(r.message ?? "تم الإرسال");
      listQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = listQ.data?.invoices ?? [];

  return (
    <div>
      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["", "not_submitted", "pending", "cleared", "rejected", "error"].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }} style={{ height: 26, padding: "0 12px", borderRadius: 12, border: `1px solid ${filterStatus === s ? "#D19C05" : "#e2e8f0"}`, background: filterStatus === s ? "#D19C05" : "#fff", color: filterStatus === s ? "#fff" : "#374151", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {s === "" ? "الكل" : (STATUS_MAP[s]?.label ?? s)}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["رقم الفاتورة", "التاريخ", "العميل", "الإجمالي", "حالة الهيئة", "الإجراء"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد فواتير</td></tr>
            ) : rows.map((inv, i) => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#D19C05" }}>{inv.invoiceNumber}</td>
                <td style={{ padding: "6px 10px", color: "#6b7280" }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('ar-SA') : "-"}</td>
                <td style={{ padding: "6px 10px" }}>{inv.customerName ?? "-"}</td>
                <td style={{ padding: "6px 10px", fontWeight: 600, direction: "ltr", textAlign: "left" }}>{parseFloat(inv.total ?? "0").toLocaleString('en', { minimumFractionDigits: 2 })} SAR</td>
                <td style={{ padding: "6px 10px" }}><StatusBadge status={inv.zatcaStatus} /></td>
                <td style={{ padding: "6px 10px" }}>
                  {inv.zatcaStatus !== 'cleared' && (
                    <button
                      onClick={() => submitM.mutate({ invoiceId: inv.id, forceResend: inv.zatcaStatus === 'rejected' })}
                      disabled={submitM.isPending}
                      style={{ height: 22, padding: "0 10px", background: "#D19C05", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: submitM.isPending ? 0.6 : 1 }}
                    >
                      {inv.zatcaStatus === 'rejected' ? "إعادة إرسال" : "إرسال"}
                    </button>
                  )}
                  {inv.zatcaStatus === 'cleared' && <span style={{ color: "#16a34a", fontSize: 11 }}>✓ مُخلَّصة</span>}
                </td>
              </tr>
            ))}
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
function ZatcaLogs() {
  const [page, setPage]       = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const logsQ = trpc.zatca.getLogs.useQuery({ page, limit: 50 });
  const rows  = logsQ.data?.logs ?? [];

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["التاريخ", "الفاتورة", "نوع العملية", "الحالة", "البيئة", "تفاصيل"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>لا توجد سجلات عمليات</td></tr>
            ) : rows.map((log, i) => (
              <React.Fragment key={log.id}>
                <tr style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa", cursor: log.responseBody ? "pointer" : "default" }} onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <td style={{ padding: "6px 10px", color: "#6b7280", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString('ar-SA')}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: "#D19C05" }}>{log.invoiceNumber ?? "-"}</td>
                  <td style={{ padding: "6px 10px" }}>{EVENT_MAP[log.eventType] ?? log.eventType}</td>
                  <td style={{ padding: "6px 10px" }}><StatusBadge status={log.status} /></td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 8, background: log.environment === "production" ? "#dcfce7" : "#fef3c7", color: log.environment === "production" ? "#16a34a" : "#d97706" }}>
                      {log.environment === "production" ? "إنتاج" : "اختبار"}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", color: "#6366f1", fontSize: 11 }}>{log.responseBody ? (expanded === log.id ? "▲ إخفاء" : "▼ عرض") : ""}</td>
                </tr>
                {expanded === log.id && log.responseBody && (
                  <tr style={{ background: "#f8fafc" }}>
                    <td colSpan={6} style={{ padding: "8px 14px" }}>
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

// ─── المكوّن الرئيسي ──────────────────────────────────────────────────────────
export default function ZatcaIntegrationPage({ initialTab }: { initialTab?: ZatcaTab } = {}) {
  const [tab, setTab] = useState<ZatcaTab>(initialTab ?? "settings");

  const tabs: { id: ZatcaTab; label: string; icon: string }[] = [
    { id: "settings",  label: "الإعدادات",      icon: "⚙️" },
    { id: "monitor",   label: "لوحة المتابعة",   icon: "📊" },
    { id: "invoices",  label: "الفواتير",         icon: "📄" },
    { id: "logs",      label: "سجل العمليات",    icon: "📋" },
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
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 34, border: "none", borderRadius: 6, background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#D19C05" : "#6b7280", fontWeight: tab === t.id ? 800 : 600, fontSize: 12, cursor: "pointer", boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {tab === "settings"  && <ZatcaSettings />}
      {tab === "monitor"   && <ZatcaMonitor />}
      {tab === "invoices"  && <ZatcaInvoices />}
      {tab === "logs"      && <ZatcaLogs />}
    </div>
  );
}
