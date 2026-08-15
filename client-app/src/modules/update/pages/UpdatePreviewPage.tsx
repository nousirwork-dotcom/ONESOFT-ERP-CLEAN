/**
 * UpdatePreviewPage — معاينة شاشة التحديث (dev فقط)
 * المسار: /dev/update-preview
 */
import { useState } from "react";

const MOCK_MANIFEST = {
  latestVersion:       "1.0.41",
  minSupportedVersion: "1.0.0",
  mandatory:           false,
  messageAr:           "يوجد تحديث جديد: تجربة مجانية لمدة 180 يوماً وإصلاحات لمثبت Windows.",
  messageEn:           "New update with 180-day trial support and Windows installer fixes.",
  releaseNotes:        [
    "تجربة مجانية لمدة 180 يوماً تبدأ بعد أول تثبيت ناجح",
    "الحفاظ على تاريخ بداية التجربة عند التحديث وإعادة التثبيت",
    "تثبيت وترقية Windows بصمت",
  ],
  downloadUrl:  "https://github.com/nousirwork-dotcom/ONESOFT-ERP-CLEAN/releases/download/v1.0.41/OneSoftSetup-1.0.41-x64.exe",
  fileSizeBytes: 81_966_246,
};

const MOCK_MANDATORY = { ...MOCK_MANIFEST, mandatory: true, minSupportedVersion: "1.0.2",
  messageAr: "هذا التحديث إجباري ويحتوي على تعديلات أمنية مهمة. يجب التحديث للمتابعة." };

type DemoState = "optional" | "mandatory" | "downloading" | "downloaded" | "error";

export default function UpdatePreviewPage() {
  const [demo, setDemo] = useState<DemoState>("optional");
  const [pct,  setPct]  = useState(65);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", backgroundColor: "#1e293b", padding: "2rem" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        {(["optional", "mandatory", "downloading", "downloaded", "error"] as DemoState[]).map(s => (
          <button key={s} onClick={() => setDemo(s)}
            style={{
              padding: "0.4rem 1.1rem", borderRadius: "0.6rem", fontWeight: 700, fontSize: "0.8rem",
              cursor: "pointer", border: "none",
              backgroundColor: demo === s ? "#1B2B5C" : "#334155",
              color: "#fff",
            }}>
            {s}
          </button>
        ))}
        {demo === "downloading" && (
          <input type="range" min={0} max={100} value={pct} onChange={e => setPct(+e.target.value)}
            style={{ accentColor: "#C9A84C", width: 140 }} />
        )}
      </div>

      {/* Dialog preview */}
      <DemoDialog state={demo} pct={pct} />
    </div>
  );
}

function DemoDialog({ state, pct }: { state: DemoState; pct: number }) {
  const [showNotes, setShowNotes] = useState(false);
  const manifest   = state === "mandatory" ? MOCK_MANDATORY : MOCK_MANIFEST;
  const isMandatory = state === "mandatory";
  const currentVer  = "1.0.40";

  const bps  = 1_258_291;
  const total = manifest.fileSizeBytes!;
  const transferred = Math.round(total * pct / 100);

  function fmtBytes(b: number) {
    if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
    if (b >= 1_024)     return `${(b / 1_024).toFixed(0)} KB`;
    return `${b} B`;
  }
  function fmtSpeed(bps: number) {
    if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/ث`;
    return `${(bps / 1_024).toFixed(0)} KB/ث`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 440,
        borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        overflow: "hidden", backgroundColor: "#FAF7F0",
      }}>

        {/* ── شريط التحذير الإجباري ── */}
        {isMandatory && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px",
            backgroundColor:"#C9A84C", color:"#fff" }}>
            <span style={{ fontSize:16 }}>⚠️</span>
            <span style={{ fontSize:13, fontWeight:700 }}>
              تحديث إجباري مطلوب — لا يمكن متابعة العمل قبل التحديث
            </span>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"20px 24px 16px",
          borderBottom:"1px solid rgba(201,168,76,0.25)" }}>
          <div style={{ width:42, height:42, borderRadius:12,
            backgroundColor:"rgba(27,43,92,0.08)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
            {state === "downloaded" ? "✅" : state === "downloading" ? "⬇️" : state === "error" ? "❌" : "🔄"}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:"#1B2B5C", lineHeight:1.3 }}>
              {state === "downloaded"  ? "التحديث جاهز للتثبيت"
               : state === "downloading" ? "جاري تحميل التحديث..."
               : state === "error"    ? "تعذّر تحميل التحديث"
               : isMandatory          ? "تحديث إجباري مطلوب"
               : "يوجد تحديث جديد متاح"}
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
              {manifest.messageAr}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:"16px 24px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* إصدارات */}
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <VersionBox label="الإصدار الحالي" version={currentVer} dim />
            <span style={{ color:"#d1d5db", fontSize:18 }}>←</span>
            <VersionBox label="الإصدار الجديد" version={manifest.latestVersion} highlight />
          </div>

          {/* حجم التحديث */}
          {state !== "downloading" && state !== "downloaded" && (
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b7280" }}>
              ⬇️ <span>حجم التحديث: <strong>{fmtBytes(manifest.fileSizeBytes!)}</strong></span>
            </div>
          )}

          {/* Progress */}
          {state === "downloading" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6b7280" }}>
                <span>{fmtBytes(transferred)} / {fmtBytes(total)}</span>
                <span style={{ fontWeight:700, color:"#1B2B5C" }}>{pct}%</span>
              </div>
              <div style={{ height:10, borderRadius:99, backgroundColor:"rgba(27,43,92,0.1)", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`,
                  background:"linear-gradient(90deg,#1B2B5C,#C9A84C)",
                  borderRadius:99, transition:"width 0.3s" }} />
              </div>
              <div style={{ fontSize:11, textAlign:"center", color:"#6b7280" }}>
                سرعة التحميل: <strong>{fmtSpeed(bps)}</strong>
              </div>
            </div>
          )}

          {/* Downloaded */}
          {state === "downloaded" && (
            <div style={{ padding:"12px 14px", borderRadius:12,
              backgroundColor:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.25)",
              display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>✅</span>
              <span style={{ fontSize:13, fontWeight:600, color:"#15803d" }}>
                اكتمل التحميل — سيتم إعادة تشغيل البرنامج لتطبيق التحديث
              </span>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div style={{ padding:"12px 14px", borderRadius:12,
              backgroundColor:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.2)" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#b91c1c" }}>تعذّر إتمام التحميل</div>
              <div style={{ fontSize:11, color:"#b91c1c", opacity:0.8, marginTop:4 }}>
                HTTP 404: لم يُعثر على ملف التحديث على الخادم.
              </div>
            </div>
          )}

          {/* ملاحظات الإصدار */}
          <div>
            <button onClick={() => setShowNotes(v => !v)}
              style={{ display:"flex", alignItems:"center", gap:6, fontSize:12,
                fontWeight:700, color:"#1B2B5C", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <span>{showNotes ? "▲" : "▼"}</span>
              ملخص التغييرات ({manifest.releaseNotes.length})
            </button>
            {showNotes && (
              <ul style={{ marginTop:8, paddingRight:16, display:"flex", flexDirection:"column", gap:6 }}>
                {manifest.releaseNotes.map((n, i) => (
                  <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:13, color:"#374151" }}>
                    <span style={{ width:6, height:6, borderRadius:99, backgroundColor:"#C9A84C",
                      marginTop:6, flexShrink:0, display:"inline-block" }} />
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display:"flex", gap:10, padding:"12px 24px 20px",
          borderTop:"1px solid rgba(201,168,76,0.15)" }}>

          {/* زر رئيسي */}
          {state === "downloaded" ? (
            <Btn primary>🔄 إعادة التشغيل والتحديث</Btn>
          ) : state === "error" ? (
            <Btn primary>🔄 إعادة المحاولة</Btn>
          ) : state === "downloading" ? (
            <div style={{ flex:1, padding:"10px 0", textAlign:"center", borderRadius:12,
              backgroundColor:"rgba(27,43,92,0.08)", color:"#1B2B5C", fontWeight:700, fontSize:13 }}>
              ⚡ {pct}% — {fmtSpeed(bps)}
            </div>
          ) : (
            <Btn primary>⬇️ تحديث الآن</Btn>
          )}

          {/* زر "لاحقاً" — اختياري فقط */}
          {!isMandatory && state !== "downloading" && state !== "downloaded" && (
            <Btn>⏰ لاحقاً</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionBox({ label, version, dim, highlight }: {
  label: string; version: string; dim?: boolean; highlight?: boolean;
}) {
  return (
    <div style={{ flex:1, borderRadius:12, padding:"10px 12px", textAlign:"center",
      backgroundColor: highlight ? "rgba(27,43,92,0.06)" : "rgba(107,114,128,0.06)",
      border: `1px solid ${highlight ? "rgba(27,43,92,0.2)" : "rgba(107,114,128,0.15)"}` }}>
      <div style={{ fontSize:11, color: dim ? "#9ca3af" : "#6b7280", marginBottom:4 }}>{label}</div>
      <div style={{ fontWeight:800, fontSize:16, color: highlight ? "#1B2B5C" : "#9ca3af" }}>
        v{version}
      </div>
    </div>
  );
}

function Btn({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button style={{
      flex: primary ? 1 : undefined,
      padding: "10px 20px", borderRadius:12, border:"none", cursor:"pointer",
      fontWeight:700, fontSize:13,
      backgroundColor: primary ? "#1B2B5C" : "rgba(107,114,128,0.1)",
      color: primary ? "#fff" : "#4b5563",
      display:"flex", alignItems:"center", justifyContent:"center", gap:6,
    }}>
      {children}
    </button>
  );
}
