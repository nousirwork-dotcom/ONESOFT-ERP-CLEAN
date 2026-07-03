import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Play, Square, RotateCcw, Server, Database, Monitor, CheckCircle, XCircle, AlertCircle, Clock, Info } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { toast } from "sonner";

interface SystemStatus {
  backendPort:    number;
  frontendPort:   number;
  backendStatus:  string;
  frontendStatus: string;
  dbHost:         string;
  dbPort:         number;
  dbName:         string;
  dbUser:         string;
  logPath:        string;
  configPath:     string;
  configFound:    boolean;
  platform:       string;
  nodeVersion:    string;
  uptime:         number;
}

const STATUS_LABEL: Record<string, string> = {
  running:       'يعمل',
  stopped:       'متوقف',
  starting:      'يبدأ...',
  'not-installed': 'غير مثبّت',
  unknown:       'غير معروف',
  'n/a':         'لا ينطبق',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    running:         { color: 'bg-green-100 text-green-800 border-green-200',   icon: <CheckCircle size={12} /> },
    stopped:         { color: 'bg-red-100 text-red-800 border-red-200',         icon: <XCircle size={12} /> },
    starting:        { color: 'bg-yellow-100 text-yellow-800 border-yellow-200',icon: <Clock size={12} /> },
    'not-installed': { color: 'bg-gray-100 text-gray-600 border-gray-200',      icon: <Info size={12} /> },
    unknown:         { color: 'bg-orange-100 text-orange-700 border-orange-200',icon: <AlertCircle size={12} /> },
    'n/a':           { color: 'bg-gray-100 text-gray-500 border-gray-200',      icon: <Info size={12} /> },
  };
  const { color, icon } = map[status] ?? map['unknown']!;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {icon}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function UptimeStr(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}س ${m}د`;
  if (m > 0) return `${m}د ${s}ث`;
  return `${s}ث`;
}

export default function ServiceDiagnosticsPage() {
  const [status,      setStatus]      = useState<SystemStatus | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [restarting,  setRestarting]  = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SystemStatus;
      setStatus(data);
      setLastRefresh(new Date());
    } catch (e) {
      toast.error('تعذّر جلب حالة النظام: ' + String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const restartService = async (name: string) => {
    setRestarting(name);
    try {
      const res = await fetch('/api/system/restart-service', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name }),
      });
      const data = await res.json() as { ok: boolean; message?: string; error?: string };
      if (data.ok) {
        toast.success(data.message ?? `تمّت إعادة تشغيل ${name}`);
        setTimeout(() => { void fetchStatus(); }, 3000);
      } else {
        toast.error(data.error ?? 'فشل إعادة التشغيل');
      }
    } catch (e) {
      toast.error('خطأ في الاتصال: ' + String(e));
    } finally {
      setRestarting(null);
    }
  };

  return (
    <div dir="rtl" className="p-6 space-y-6 max-w-3xl">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">إدارة الخدمات والتشخيص</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            مراقبة خدمات النظام وإعادة تشغيلها
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              آخر تحديث: {lastRefresh.toLocaleTimeString('ar-SA')}
            </span>
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => { void fetchStatus(); }}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </Button>
        </div>
      </div>

      {/* حالة config.json */}
      {status && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          status.configFound
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          {status.configFound
            ? <><CheckCircle size={14} /> ملف الإعدادات موجود: <code className="font-mono text-xs">{status.configPath}</code></>
            : <><AlertCircle size={14} /> ملف الإعدادات غير موجود — سيستخدم النظام القيم الافتراضية</>
          }
        </div>
      )}

      {/* خدمة Backend */}
      <ServiceCard
        icon={<Server size={18} />}
        title="OneSoft-Server (Backend)"
        subtitle={`يستمع على المنفذ ${status?.backendPort ?? 3000}`}
        status={status?.backendStatus ?? 'unknown'}
        serviceName="OneSoft-Server"
        loading={!status}
        restarting={restarting === 'OneSoft-Server'}
        onRestart={restartService}
        details={[
          { label: 'المنفذ',         value: String(status?.backendPort ?? '—') },
          { label: 'وقت التشغيل',   value: status ? UptimeStr(status.uptime) : '—' },
          { label: 'إصدار Node.js', value: status?.nodeVersion ?? '—' },
        ]}
      />

      {/* خدمة Frontend */}
      <ServiceCard
        icon={<Monitor size={18} />}
        title="OneSoft-Client (Frontend)"
        subtitle={`يستمع على المنفذ ${status?.frontendPort ?? 5000}`}
        status={status?.frontendStatus ?? 'unknown'}
        serviceName="OneSoft-Client"
        loading={!status}
        restarting={restarting === 'OneSoft-Client'}
        onRestart={restartService}
        details={[
          { label: 'المنفذ', value: String(status?.frontendPort ?? '—') },
        ]}
      />

      {/* قاعدة البيانات */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
          <div className="text-gray-600"><Database size={18} /></div>
          <div>
            <div className="font-semibold text-gray-800 text-sm">PostgreSQL</div>
            <div className="text-xs text-gray-500">قاعدة بيانات النظام</div>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'السيرفر', value: `${status?.dbHost ?? '—'}:${status?.dbPort ?? '—'}` },
            { label: 'قاعدة البيانات', value: status?.dbName ?? '—' },
            { label: 'مستخدم التطبيق', value: status?.dbUser ?? '—' },
            { label: 'النظام', value: status?.platform === 'win32' ? 'Windows' : status?.platform ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
              <div className="text-sm font-mono text-gray-800 truncate">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* مسار السجلات */}
      {status?.logPath && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs font-medium text-gray-500 mb-1">📁 مسار ملفات السجل (Logs)</div>
          <code className="text-xs text-gray-700 font-mono break-all">{status.logPath}</code>
        </div>
      )}

      {/* تعليمات للمستخدم */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700 space-y-1">
        <div className="font-semibold">💡 ملاحظات:</div>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>إعادة التشغيل تستغرق عادةً 5-15 ثانية — اضغط تحديث بعدها</li>
          <li>إذا استمرت المشكلة، راجع ملفات السجل في المسار أعلاه</li>
          {status?.platform !== 'win32' && (
            <li>إعادة تشغيل الخدمات متاحة فقط على Windows</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// ── مكوّن بطاقة الخدمة ──────────────────────────────────────────────────────
function ServiceCard({
  icon, title, subtitle, status, serviceName,
  loading, restarting, onRestart, details,
}: {
  icon:        React.ReactNode;
  title:       string;
  subtitle:    string;
  status:      string;
  serviceName: string;
  loading:     boolean;
  restarting:  boolean;
  onRestart:   (name: string) => void;
  details:     { label: string; value: string }[];
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* رأس البطاقة */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="text-gray-600">{icon}</div>
          <div>
            <div className="font-semibold text-gray-800 text-sm">{title}</div>
            <div className="text-xs text-gray-500">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-gray-400 animate-pulse">جارٍ التحميل...</span>
          ) : (
            <StatusBadge status={status} />
          )}
          <Button
            variant="outline" size="sm"
            onClick={() => onRestart(serviceName)}
            disabled={restarting || loading}
            className="gap-1 h-7 text-xs"
          >
            <RotateCcw size={12} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'جارٍ الإعادة...' : 'إعادة تشغيل'}
          </Button>
        </div>
      </div>

      {/* تفاصيل */}
      {details.length > 0 && (
        <div className="px-4 py-3 flex gap-6">
          {details.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[11px] text-gray-400 mb-0.5">{label}</div>
              <div className="text-sm font-mono text-gray-700">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
