import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  ShieldCheck, ShieldAlert, ShieldOff, Copy, Check,
  RefreshCw, KeyRound, FileUp, ClipboardList, Info,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  sales:       "المبيعات",
  purchases:   "المشتريات",
  inventory:   "المخزون",
  accounting:  "المحاسبة",
  pos:         "نقاط البيع",
  hr:          "الموارد البشرية",
  assets:      "الأصول الثابتة",
  manufacturing: "التصنيع",
};

const ERROR_LABELS: Record<string, string> = {
  license_not_found:           "لم يتم تفعيل البرنامج بعد",
  invalid_json:                "ملف الترخيص تالف",
  unknown_algorithm:           "خوارزمية الترخيص غير مدعومة",
  unknown_kid:                 "مفتاح الترخيص غير معروف",
  invalid_signature:           "التوقيع الرقمي غير صالح — تحقق من صحة الملف",
  expired:                     "انتهت صلاحية الترخيص",
  not_yet_valid:               "الترخيص لم يبدأ بعد",
  date_manipulation_suspected: "تم اكتشاف تلاعب بتاريخ الجهاز",
  read_error:                  "تعذّر قراءة ملف الترخيص",
};

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LicenseActivationPage() {
  const [tab,           setTab]           = useState<"code" | "file">("code");
  const [activCode,     setActivCode]     = useState("");
  const [fileContent,   setFileContent]   = useState("");
  const [fileName,      setFileName]      = useState("");
  const [reqOrgId,      setReqOrgId]      = useState("");
  const [reqLicKey,     setReqLicKey]     = useState("");
  const [requestCode,   setRequestCode]   = useState("");
  const [notice,        setNotice]        = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { copied: copiedDevice,  copy: copyDevice  } = useCopyToClipboard();
  const { copied: copiedRequest, copy: copyRequest } = useCopyToClipboard();

  const utils = trpc.useUtils();
  const { data: status, refetch: refetchStatus } = trpc.license.getStatus.useQuery(
    undefined, { retry: false }
  );
  const { data: deviceInfo } = trpc.license.getDeviceInfo.useQuery(undefined, { retry: false });

  const genRequestCode = trpc.license.generateRequestCode.useMutation({
    onSuccess: (d) => setRequestCode(d.code),
  });

  const activateByCode = trpc.license.activateByCode.useMutation({
    onSuccess: (d) => {
      setNotice({ ok: true, msg: `تم التفعيل بنجاح — ${d.customer}` });
      setActivCode("");
      utils.license.getStatus.invalidate();
    },
    onError: (e) => setNotice({ ok: false, msg: e.message }),
  });

  const activateByFile = trpc.license.activateByFile.useMutation({
    onSuccess: (d) => {
      setNotice({ ok: true, msg: `تم التفعيل بنجاح — ${d.customer}` });
      setFileContent("");
      setFileName("");
      utils.license.getStatus.invalidate();
    },
    onError: (e) => setNotice({ ok: false, msg: e.message }),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileContent((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  const lic     = status;
  const isValid = lic?.valid;
  const isExp   = lic?.error === "expired";
  const p       = lic?.payload;

  return (
    <div className="p-5 space-y-5 max-w-3xl" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <KeyRound className="w-5 h-5 text-primary" />
        <h2 className="erp-page-title">الترخيص والتفعيل</h2>
        <button
          onClick={() => { refetchStatus(); setNotice(null); }}
          className="mr-auto p-1 rounded text-muted-foreground hover:text-foreground"
          title="تحديث الحالة"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Notice ── */}
      {notice && (
        <div className={`text-sm rounded px-3 py-2 ${notice.ok
          ? "bg-green-50 text-green-800 border border-green-200"
          : "bg-red-50 text-red-800 border border-red-200"}`}>
          {notice.msg}
        </div>
      )}

      {/* ── Status Card ── */}
      <div className={`rounded-lg border p-4 space-y-3 ${
        isValid ? "border-green-300 bg-green-50"
        : isExp  ? "border-amber-300 bg-amber-50"
        : "border-red-200 bg-red-50"
      }`}>
        <div className="flex items-center gap-2">
          {isValid
            ? <ShieldCheck className="w-5 h-5 text-green-600" />
            : isExp
              ? <ShieldAlert className="w-5 h-5 text-amber-600" />
              : <ShieldOff   className="w-5 h-5 text-red-500" />
          }
          <span className={`font-semibold ${
            isValid ? "text-green-700" : isExp ? "text-amber-700" : "text-red-600"
          }`}>
            {isValid ? "مُفعَّل" : isExp ? "انتهت الصلاحية" : (ERROR_LABELS[lic?.error ?? ""] ?? "غير مفعّل")}
          </span>
        </div>

        {p && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <Row label="العميل"    value={p.customer_name} />
            <Row label="رقم الترخيص" value={p.license_id}    />
            <Row label="تاريخ الانتهاء" value={p.expiry_date} />
            <Row label="الجهة المصدرة"  value={p.issued_by}   />
            <Row label="المستخدمون"  value={String(p.max_users)} />
            <Row label="الفروع"      value={String(p.max_branches)} />
            <Row label="نقاط البيع"  value={String(p.max_pos)} />
            <Row label="الأجهزة"     value={String(p.max_devices)} />
          </div>
        )}

        {p?.enabled_modules && p.enabled_modules.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {p.enabled_modules.map(m => (
              <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">
                {MODULE_LABELS[m] ?? m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Device Info ── */}
      <div className="rounded border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Info className="w-4 h-4" />
          معلومات الجهاز
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 select-all">
            {deviceInfo?.device_id ?? "جارٍ التحميل..."}
          </code>
          <button
            onClick={() => deviceInfo?.device_id && copyDevice(deviceInfo.device_id)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="نسخ معرّف الجهاز"
          >
            {copiedDevice ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          أرسل هذا المعرّف إلى الدعم الفني لإصدار الترخيص المناسب.
        </p>
      </div>

      {/* ── Request Code Generator ── */}
      <div className="rounded border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ClipboardList className="w-4 h-4 text-primary" />
          كود الطلب (Phase 1 — Offline)
        </div>
        <p className="text-xs text-muted-foreground">
          أدخل بياناتك أدناه ثم اضغط "توليد" لإنشاء كود الطلب — أرسله للدعم الفني للحصول على كود التفعيل.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="erp-label block mb-1">معرّف المؤسسة (اختياري)</label>
            <input
              value={reqOrgId}
              onChange={e => setReqOrgId(e.target.value)}
              placeholder="ORG-2026-XXXX"
              className="w-full erp-input text-sm"
            />
          </div>
          <div>
            <label className="erp-label block mb-1">رمز الترخيص (اختياري)</label>
            <input
              value={reqLicKey}
              onChange={e => setReqLicKey(e.target.value)}
              placeholder="LIC-XXXX-XXXX"
              className="w-full erp-input text-sm"
            />
          </div>
        </div>
        <button
          onClick={() => genRequestCode.mutate({ org_id: reqOrgId, license_key: reqLicKey })}
          disabled={genRequestCode.isPending}
          className="erp-btn-secondary text-sm"
        >
          {genRequestCode.isPending ? "جارٍ التوليد..." : "توليد كود الطلب"}
        </button>
        {requestCode && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <textarea
                readOnly
                value={requestCode}
                rows={3}
                className="w-full text-xs font-mono bg-muted rounded p-2 border border-border resize-none select-all"
              />
              <button
                onClick={() => copyRequest(requestCode)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground self-start"
                title="نسخ كود الطلب"
              >
                {copiedRequest ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{requestCode.length} حرف</p>
          </div>
        )}
      </div>

      {/* ── Activation ── */}
      <div className="rounded border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldCheck className="w-4 h-4 text-primary" />
          تفعيل الترخيص
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["code", "file"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setNotice(null); }}
              className={`px-3 py-1.5 text-sm rounded-t transition-colors ${
                tab === t
                  ? "border border-b-0 border-border bg-card font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "code" ? "كود التفعيل" : "استيراد ملف .ons"}
            </button>
          ))}
        </div>

        {tab === "code" && (
          <div className="space-y-2">
            <label className="erp-label block">أدخل كود التفعيل الذي أرسله لك الدعم الفني:</label>
            <textarea
              value={activCode}
              onChange={e => setActivCode(e.target.value)}
              rows={5}
              placeholder="الصق كود التفعيل هنا..."
              className="w-full text-xs font-mono erp-input resize-none"
            />
            <button
              onClick={() => {
                setNotice(null);
                activateByCode.mutate({ code: activCode.trim() });
              }}
              disabled={!activCode.trim() || activateByCode.isPending}
              className="erp-btn-primary text-sm"
            >
              {activateByCode.isPending ? "جارٍ التحقق..." : "تفعيل"}
            </button>
          </div>
        )}

        {tab === "file" && (
          <div className="space-y-2">
            <label className="erp-label block">استورد ملف الترخيص (.ons) الذي أرسله لك الدعم الفني:</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-accent transition-colors"
            >
              <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {fileName || "اضغط لاختيار ملف .ons أو اسحبه هنا"}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".ons,.json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => {
                setNotice(null);
                activateByFile.mutate({ content: fileContent });
              }}
              disabled={!fileContent || activateByFile.isPending}
              className="erp-btn-primary text-sm"
            >
              {activateByFile.isPending ? "جارٍ التحقق..." : "استيراد وتفعيل"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="erp-secondary">{label}:</span>
      <span className="erp-value font-medium">{value}</span>
    </>
  );
}
