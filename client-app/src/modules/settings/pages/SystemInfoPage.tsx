/**
 * SystemInfoPage — شاشة معلومات النظام
 * تعرض: إصدار البرنامج، Node.js، PostgreSQL، Electron، حالة الترخيص، النسخ الاحتياطي
 */
import { trpc } from "@/shared/lib/trpc";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card } from "@/core/ui/card";
import {
  Server, Database, Cpu, HardDrive, Shield, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Package, Zap, Archive,
} from "lucide-react";

function InfoRow({ label, value, badge, badgeColor = "secondary" }: {
  label: string; value: React.ReactNode;
  badge?: string; badgeColor?: "default"|"secondary"|"destructive"|"outline";
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {badge && <Badge variant={badgeColor} className="text-xs">{badge}</Badge>}
        <span className="text-xs font-mono font-medium">{value}</span>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50">
      <div className="flex items-center gap-2 p-3 border-b border-border/40 bg-muted/30">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </Card>
  );
}

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}س ${m}د ${s}ث`;
}

const FRONTEND_BUILD_DATE = __VITE_BUILD_DATE__;
const FRONTEND_BUILD_ID   = `Build ${__VITE_BUILD_DATE_ID__}`;

export default function SystemInfoPage() {
  const infoQ = trpc.setup.systemInfo.useQuery(undefined, { refetchInterval: 30_000 });
  const d = infoQ.data;

  if (infoQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> جارٍ تحميل معلومات النظام...
      </div>
    );
  }

  if (!d) return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground gap-2">
      <AlertCircle className="w-4 h-4" /> تعذّر تحميل معلومات النظام
    </div>
  );

  const lastBackup = d.backup.lastDate
    ? new Date(d.backup.lastDate).toLocaleString("ar-SA")
    : "لا توجد نسخ بعد";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">معلومات النظام</h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => infoQ.refetch()}>
          <RefreshCw className="w-3 h-3" /> تحديث
        </Button>
      </div>

      {/* بطاقة مختصرة */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إصدار البرنامج", value: `v${d.app.version}`, icon: Package, color: "text-amber-500" },
          { label: "حالة الخادم",    value: "يعمل",              icon: Server,  color: "text-green-500" },
          { label: "قاعدة البيانات", value: d.database.status === "connected" ? "متصلة" : "غير متصلة", icon: Database, color: d.database.status === "connected" ? "text-green-500" : "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-3 border-border/50">
            <Icon className={`w-5 h-5 mb-2 ${color}`} />
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-bold mt-0.5">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* معلومات التطبيق */}
        <SectionCard title="معلومات البرنامج" icon={Package}>
          <InfoRow label="الاسم"              value={d.app.name} />
          <InfoRow label="الإصدار"            value={d.app.version} badge={`v${d.app.version}`} badgeColor="default" />
          <InfoRow label="Build ID (Backend)" value={`${d.app.buildNumber} — ${d.app.buildDate}`} />
          <InfoRow label="Build ID (Frontend)" value={`${FRONTEND_BUILD_ID} — ${FRONTEND_BUILD_DATE}`} />
          <InfoRow label="إصدار Schema"       value={d.app.schemaVersion} />
          <InfoRow label="البيئة"         value={d.app.environment}
            badge={d.app.environment === "production" ? "إنتاج" : "تطوير"}
            badgeColor={d.app.environment === "production" ? "default" : "secondary"} />
          <InfoRow label="المنفذ"         value={String(d.app.port)} />
          {d.app.isElectron && <InfoRow label="وضع التشغيل" value="Electron Desktop" badge="سطح المكتب" badgeColor="default" />}
        </SectionCard>

        {/* بيئة التشغيل */}
        <SectionCard title="بيئة التشغيل" icon={Cpu}>
          <InfoRow label="Node.js"         value={d.runtime.nodeVersion} />
          <InfoRow label="Electron"        value={d.runtime.electronVersion === "N/A" ? "—" : d.runtime.electronVersion} />
          <InfoRow label="النظام"          value={d.runtime.platform} />
          <InfoRow label="المعمارية"       value={d.runtime.arch} />
          <InfoRow label="وقت التشغيل"    value={formatUptime(d.runtime.uptime)} />
        </SectionCard>

        {/* قاعدة البيانات */}
        <SectionCard title="قاعدة البيانات" icon={Database}>
          <InfoRow label="النوع"           value={d.database.type.toUpperCase()} />
          <InfoRow label="الإصدار"         value={d.database.version} />
          <InfoRow label="الخادم"          value={d.database.host} />
          <InfoRow label="الحالة"          value={d.database.status === "connected" ? "متصلة ✓" : "غير متصلة ✗"}
            badge={d.database.status === "connected" ? "متصلة" : "خطأ"}
            badgeColor={d.database.status === "connected" ? "default" : "destructive"} />
        </SectionCard>

        {/* النسخ الاحتياطي */}
        <SectionCard title="النسخ الاحتياطي" icon={Archive}>
          <InfoRow label="آخر نسخة"       value={lastBackup} />
          <InfoRow label="عدد النسخ"      value={String(d.backup.count)} />
          <InfoRow label="المجلد"         value={<span className="text-[10px] font-mono truncate max-w-[150px] block">{d.backup.directory}</span>} />
        </SectionCard>

        {/* الترخيص */}
        <SectionCard title="حالة الترخيص" icon={Shield}>
          <InfoRow label="نوع الترخيص"   value={d.license.type === "standard" ? "قياسي" : d.license.type}
            badge={d.license.type === "standard" ? "نشط" : "—"} badgeColor="default" />
          <InfoRow label="الحالة"        value={d.license.status === "active" ? "نشط ✓" : "غير نشط"}
            badge={d.license.status === "active" ? "نشط" : "منتهي"} badgeColor={d.license.status === "active" ? "default" : "destructive"} />
          <InfoRow label="الانتهاء"      value={d.license.expires ? new Date(d.license.expires).toLocaleDateString("ar-SA") : "بدون انتهاء"} />
        </SectionCard>

        {/* الأمان */}
        <SectionCard title="الأمان" icon={Zap}>
          {[
            { label: "تشفير كلمات المرور", value: "bcrypt (cost 12)", ok: true },
            { label: "JWT",               value: "jose HS256 (30 يوم)", ok: true },
            { label: "جلسات HTTPOnly",    value: "مُفعّل", ok: true },
            { label: "تشفير الإعدادات",   value: "AES-256-GCM", ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                {ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  : <AlertCircle  className="w-3.5 h-3.5 text-red-500" />
                }
                {label}
              </span>
              <span className="text-xs font-mono">{value}</span>
            </div>
          ))}
        </SectionCard>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        <Clock className="w-3 h-3 inline ml-1" />
        آخر تحديث: {new Date().toLocaleString("ar-SA")}
      </p>
    </div>
  );
}
