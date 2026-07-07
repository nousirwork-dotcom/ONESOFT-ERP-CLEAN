import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/auth/AuthContext";
import {
  LayoutDashboard, Users, KeyRound, Monitor, CloudOff, ClipboardList,
  Settings, Shield, Search, Bell, Moon, Plus, RefreshCw,
  Pause, Play, Code2, MonitorSmartphone, ChevronDown,
  Building2, FileText, Hash, Calendar, CheckCircle2, XCircle,
  Clock, AlertTriangle, Globe, LogOut,
} from "lucide-react";

const NAVY   = "#0F1D40";
const NAVY2  = "#1B2B5C";
const GOLD   = "#C9A84C";
const CREAM  = "#F8F5EF";
const BORDER = "#E5DDD0";

const DEMO_CLIENT = {
  name: "شركة النور التجارية",
  orgId: "ORG-2024-000125",
  commercialReg: "1010456789",
  taxNumber: "300123456700003",
};
const DEMO_LICENSE = {
  id: 0,
  licenseId: "LIC-2024-ALNOOR-001",
  packageName: "باقة احترافية",
  licenseType: "subscription",
  status: "active",
  maxUsers: 10, maxBranches: 5, maxPos: 5, maxDevices: 10, maxWeb: 2,
  enabledModules: ["sales", "purchases", "inventory", "accounting", "reports", "zatca"],
  startDate: "2024-01-01", expiryDate: "2025-12-31",
  issuedBy: "OneSoft ERP",
  webAllowed: true, desktopAllowed: true, offlineAllowed: true,
  clientId: 0, createdAt: new Date(), updatedAt: new Date(),
  licenseKey: null, notes: null,
};
const DEMO_DEVICES = [
  { id: 1, deviceName: "DESKTOP-1A2B3C", deviceId: "b1f8c2e4-7a21-4d91-9f65-8a2c1e5b7d11", status: "active",   lastActivatedAt: "2025-07-06T10:32:00" },
  { id: 2, deviceName: "SERVER-MAIN",     deviceId: "d3a7e5f1-2b43-4c90-a7ef-34d2f8c6ae22", status: "active",   lastActivatedAt: "2025-07-06T08:15:00" },
  { id: 3, deviceName: "LAPTOP-OFFICE",   deviceId: "a9d3b7c5-6e21-4f8c-9b32-0d6a7c3e5f99", status: "active",   lastActivatedAt: "2025-07-05T14:05:00" },
  { id: 4, deviceName: "POS-001",         deviceId: "f7c6a2b7-9d33-4e6a-b2f1-6c8df9c0fa44", status: "active",   lastActivatedAt: "2025-07-05T09:10:00" },
  { id: 5, deviceName: "STORE-PC-02",     deviceId: "e4b1f9c8-3a22-4b6d-8f51-2c1e7d3b9a66", status: "inactive", lastActivatedAt: "2025-07-04T17:50:00" },
];
const DEMO_OPS = [
  { id: 1, description: "تجديد الترخيص",              createdAt: "2025-07-06T10:35:00", operationType: "renew" },
  { id: 2, description: "تم إيقاف الترخيص",            createdAt: "2025-07-05T15:22:00", operationType: "suspend" },
  { id: 3, description: "إصدار Activation Code",        createdAt: "2025-07-05T09:15:00", operationType: "generate_activation_code" },
  { id: 4, description: "إنشاء العميل",                 createdAt: "2025-07-04T11:08:00", operationType: "create_client" },
  { id: 5, description: "إعادة تفعيل الترخيص",          createdAt: "2025-07-03T16:40:00", operationType: "resume" },
];
const DEMO_USAGE = { users: 4, branches: 3, pos: 2, devices: 6, web: 1 };

const MODULE_MAP: Record<string, string> = {
  sales:         "المبيعات",
  purchases:     "المشتريات",
  inventory:     "المخزون",
  accounting:    "الحسابات",
  reports:       "التقارير",
  zatca:         "ZATCA",
  hr:            "الموارد البشرية",
  payroll:       "الرواتب",
  assets:        "الأصول",
  pos:           "نقاط البيع",
  manufacturing: "التصنيع",
  branches:      "الفروع",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}
function fmtDateShort(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { return d; }
}
function fmtTime(d?: string | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" })
      + " " + dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return d; }
}
function daysLeft(exp: string) {
  return Math.max(0, Math.ceil((new Date(exp + "T23:59:59Z").getTime() - Date.now()) / 86_400_000));
}

function ProgressCard({ label, icon, current, max }: { label: string; icon: React.ReactNode; current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? "#EF4444" : pct >= 75 ? "#F59E0B" : NAVY2;
  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-2" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px]" style={{ color: GOLD }}>{icon}</span>
          <span className="text-[14px] font-bold" style={{ color: "#374151" }}>{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-black leading-none" style={{ color: barColor }}>{current}</span>
          <span className="text-[14px] font-medium" style={{ color: "#9CA3AF" }}> / {max}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <p className="text-[13px]" style={{ color: "#9CA3AF" }}>{pct}% مستخدَم</p>
    </div>
  );
}

function ModuleChip({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[15px] font-bold transition-all ${
      active ? "bg-green-50 border-green-200 text-green-800" : "bg-gray-50 border-gray-200 text-gray-400 opacity-60"
    }`}>
      {active
        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        : <XCircle className="w-5 h-5 text-gray-300 shrink-0" />
      }
      {label}
    </div>
  );
}

function ActionBtn({ icon, label, variant = "navy", onClick, disabled }: {
  icon: React.ReactNode; label: string; variant?: "navy" | "orange" | "green"; onClick?: () => void; disabled?: boolean;
}) {
  const bg = variant === "orange" ? "#F97316" : variant === "green" ? "#16A34A" : NAVY2;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[14px] font-bold transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
      style={{ backgroundColor: bg }}
    >
      {icon}
      {label}
    </button>
  );
}

type NavKey = "dashboard" | "clients" | "licenses" | "devices" | "offline" | "log" | "settings";
const NAV_ITEMS: { key: NavKey; icon: React.ReactNode; label: string }[] = [
  { key: "dashboard", icon: <LayoutDashboard className="w-5 h-5" />, label: "لوحة التحكم" },
  { key: "clients",   icon: <Users className="w-5 h-5" />,           label: "العملاء" },
  { key: "licenses",  icon: <KeyRound className="w-5 h-5" />,         label: "التراخيص" },
  { key: "devices",   icon: <MonitorSmartphone className="w-5 h-5" />, label: "الأجهزة المفعلة" },
  { key: "offline",   icon: <CloudOff className="w-5 h-5" />,         label: "التفعيل الأوفلاين" },
  { key: "log",       icon: <ClipboardList className="w-5 h-5" />,    label: "سجل العمليات" },
  { key: "settings",  icon: <Settings className="w-5 h-5" />,         label: "الإعدادات" },
];

function OpDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    create_client: "#3B82F6", create_license: "#8B5CF6",
    activate: "#16A34A", suspend: "#F97316", resume: "#16A34A",
    renew: "#0EA5E9", revoke_device: "#EF4444",
    generate_key: GOLD, generate_activation_code: GOLD,
  };
  return <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: colors[type] || GOLD }} />;
}

export default function LicenseCenterPage() {
  const { user, logout } = useAuth();
  const [activeNav, setActiveNav] = useState<NavKey>("licenses");
  const [searchQ, setSearchQ] = useState("");

  const seed    = trpc.licenseCenter.seedDemo.useMutation();
  const clients = trpc.licenseCenter.listClients.useQuery(undefined, { retry: false });
  const summary = trpc.licenseCenter.getDashboardSummary.useQuery(undefined, { retry: false });

  useEffect(() => {
    seed.mutate(undefined, { onSettled: () => { clients.refetch(); summary.refetch(); } });
  }, []);

  const firstClient = clients.data?.[0];
  const clientId    = firstClient?.id;

  const licQ = trpc.licenseCenter.listLicensesByClient.useQuery(
    { clientId: clientId ?? 0 }, { enabled: !!clientId, retry: false }
  );
  const firstLic = licQ.data?.[0] ?? DEMO_LICENSE;
  const licId    = firstLic?.id;

  const devQ = trpc.licenseCenter.listDevices.useQuery(
    { licenseId: licId ?? 0 }, { enabled: !!licId && licId > 0, retry: false }
  );
  const opsQ = trpc.licenseCenter.listOperationsLog.useQuery(
    { clientId: clientId, limit: 20 }, { retry: false }
  );

  const suspend = trpc.licenseCenter.suspendLicense.useMutation({ onSuccess: () => licQ.refetch() });
  const resume  = trpc.licenseCenter.resumeLicense.useMutation({ onSuccess: () => licQ.refetch() });

  const client  = firstClient  ?? DEMO_CLIENT;
  const license = licQ.data?.[0] ?? DEMO_LICENSE;
  const devices = devQ.data ?? DEMO_DEVICES;
  const ops     = opsQ.data ?? DEMO_OPS;

  const mods    = new Set(license?.enabledModules ?? DEMO_LICENSE.enabledModules);
  const days    = license?.expiryDate ? daysLeft(license.expiryDate) : 256;
  const isActive  = license?.status === "active";
  const isSuspend = license?.status === "suspended";

  const statusBadge = isActive
    ? { label: "Active",    bg: "#ECFDF5", text: "#16A34A", dot: "#22C55E" }
    : isSuspend
    ? { label: "Suspended", bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" }
    : { label: "Expired",   bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" };

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden select-none" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", backgroundColor: CREAM }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="flex flex-col w-[220px] shrink-0 h-full" style={{ backgroundColor: NAVY }}>
        <div className="flex items-center justify-center py-5 border-b" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: GOLD }}>
            <span className="text-[20px] font-black text-white tracking-widest">LC</span>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveNav(item.key)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] font-semibold transition-all text-right"
                style={{
                  backgroundColor: active ? "rgba(201,168,76,0.15)" : "transparent",
                  color: active ? GOLD : "rgba(255,255,255,0.7)",
                  borderRight: active ? `3px solid ${GOLD}` : "3px solid transparent",
                }}
              >
                <span style={{ color: active ? GOLD : "rgba(255,255,255,0.5)" }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-3" style={{ borderColor: "rgba(201,168,76,0.15)" }}>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
            <div>
              <p className="text-[12px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>OneSoft ERP</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>License Center v1.0</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all hover:bg-red-900/30"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-4 px-6 py-3 bg-white border-b shrink-0 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="ml-auto">
            <h1 className="text-[22px] font-black leading-tight" style={{ color: NAVY2 }}>مركز التراخيص</h1>
            <p className="text-[12px] font-medium" style={{ color: GOLD }}>License Center</p>
          </div>

          <div className="flex-1 max-w-xs">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-gray-50" style={{ borderColor: BORDER }}>
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="بحث عام..."
                className="flex-1 bg-transparent text-[14px] outline-none text-right"
                style={{ color: NAVY2 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[13px] font-bold" style={{ borderColor: GOLD, color: GOLD, backgroundColor: "rgba(201,168,76,0.08)" }}>
              <Shield className="w-3.5 h-3.5" /> Owner Only
            </span>
            <div className="flex items-center gap-2.5 pl-3 border-l" style={{ borderColor: BORDER }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[14px] font-black" style={{ backgroundColor: NAVY2 }}>
                {user?.username?.[0]?.toUpperCase() ?? "A"}
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold" style={{ color: NAVY2 }}>{user?.username ?? "admin"}</p>
                <p className="text-[12px]" style={{ color: "#9CA3AF" }}>المدير العام</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 1. معلومات العميل */}
          <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
                <Building2 className="w-4 h-4" style={{ color: GOLD }} />
              </span>
              <h2 className="text-[17px] font-extrabold" style={{ color: NAVY2 }}>معلومات العميل</h2>
            </div>
            <div className="p-5 grid grid-cols-4 gap-x-8 gap-y-4">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>اسم العميل</p>
                <p className="text-[17px] font-black" style={{ color: NAVY2 }}>{(client as any).name}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>السجل التجاري</p>
                <p className="text-[15px] font-semibold font-mono" style={{ color: NAVY2 }}>{(client as any).commercialReg ?? "—"}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>نوع الباقة</p>
                <p className="text-[15px] font-bold" style={{ color: NAVY2 }}>{license?.packageName ?? "—"}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  <Calendar className="w-3.5 h-3.5 inline ml-1" />تاريخ البداية
                </p>
                <p className="text-[15px] font-semibold" style={{ color: NAVY2 }}>{fmtDateShort(license?.startDate)}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>Organization ID</p>
                <p className="text-[14px] font-mono font-semibold" style={{ color: NAVY2 }}>{(client as any).orgId}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>الرقم الضريبي</p>
                <p className="text-[15px] font-semibold font-mono" style={{ color: NAVY2 }}>{(client as any).taxNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>حالة الترخيص</p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold" style={{ backgroundColor: statusBadge.bg, color: statusBadge.text }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusBadge.dot }} />
                  {statusBadge.label}
                </span>
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  <Calendar className="w-3.5 h-3.5 inline ml-1" />تاريخ الانتهاء
                </p>
                <p className="text-[15px] font-semibold" style={{ color: days <= 30 ? "#EF4444" : NAVY2 }}>
                  {fmtDateShort(license?.expiryDate)}
                  <span className="text-[13px] font-medium mr-1.5" style={{ color: days <= 30 ? "#EF4444" : "#6B7280" }}>({days} يوم متبقي)</span>
                </p>
              </div>
            </div>
          </div>

          {/* 2. حدود الترخيص */}
          <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
                <Hash className="w-4 h-4" style={{ color: GOLD }} />
              </span>
              <h2 className="text-[17px] font-extrabold" style={{ color: NAVY2 }}>حدود الترخيص</h2>
            </div>
            <div className="p-5 grid grid-cols-5 gap-4">
              <ProgressCard label="المستخدمون"   icon={<Users className="w-4 h-4" />}            current={DEMO_USAGE.users}    max={license?.maxUsers ?? 10} />
              <ProgressCard label="الفروع"        icon={<Building2 className="w-4 h-4" />}        current={DEMO_USAGE.branches} max={license?.maxBranches ?? 5} />
              <ProgressCard label="نقاط البيع"   icon={<Monitor className="w-4 h-4" />}          current={DEMO_USAGE.pos}      max={license?.maxPos ?? 5} />
              <ProgressCard label="الأجهزة"       icon={<MonitorSmartphone className="w-4 h-4" />} current={DEMO_USAGE.devices} max={license?.maxDevices ?? 10} />
              <ProgressCard label="الويب"         icon={<Globe className="w-4 h-4" />}            current={DEMO_USAGE.web}      max={license?.maxWeb ?? 2} />
            </div>
          </div>

          {/* 3. الموديولات المفعلة */}
          <div className="bg-white rounded-2xl border shadow-sm" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
                <LayoutDashboard className="w-4 h-4" style={{ color: GOLD }} />
              </span>
              <h2 className="text-[17px] font-extrabold" style={{ color: NAVY2 }}>الموديولات المفعلة</h2>
              <span className="mr-auto px-3 py-0.5 rounded-full text-[13px] font-bold" style={{ backgroundColor: "#ECFDF5", color: "#16A34A", border: "1px solid #BBF7D0" }}>
                {mods.size} / {Object.keys(MODULE_MAP).length}
              </span>
            </div>
            <div className="p-5 flex flex-wrap gap-2.5">
              {Object.entries(MODULE_MAP).map(([id, label]) => (
                <ModuleChip key={id} label={label} active={mods.has(id)} />
              ))}
            </div>
          </div>

          {/* 4. Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <ActionBtn icon={<Plus className="w-4 h-4" />}             label="إنشاء عميل جديد"       variant="navy" />
            <ActionBtn icon={<KeyRound className="w-4 h-4" />}          label="توليد License Key"       variant="navy" />
            <ActionBtn icon={<RefreshCw className="w-4 h-4" />}         label="تجديد الترخيص"          variant="navy" />
            <ActionBtn icon={<Pause className="w-4 h-4" />}             label="إيقاف الترخيص"          variant="orange"
              onClick={() => license?.id > 0 && suspend.mutate({ licenseId: license.id })}
              disabled={!isActive || suspend.isPending}
            />
            <ActionBtn icon={<Play className="w-4 h-4" />}              label="إعادة تفعيل"            variant="green"
              onClick={() => license?.id > 0 && resume.mutate({ licenseId: license.id })}
              disabled={!isSuspend || resume.isPending}
            />
            <ActionBtn icon={<Code2 className="w-4 h-4" />}             label="إصدار Activation Code"  variant="navy" />
            <ActionBtn icon={<MonitorSmartphone className="w-4 h-4" />} label="عرض الأجهزة المفعلة"   variant="navy" onClick={() => setActiveNav("devices")} />
          </div>

          {/* 5. Devices + Log */}
          <div className="grid grid-cols-2 gap-4">

            {/* الأجهزة المفعلة */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
                <Monitor className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="text-[16px] font-extrabold" style={{ color: NAVY2 }}>الأجهزة المفعلة</h3>
                <span className="mr-auto text-[13px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                  {devices.filter((d: any) => d.status === "active").length} نشط
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ backgroundColor: "#F9FAFB", borderBottom: `1px solid ${BORDER}` }}>
                      <th className="px-4 py-2.5 text-right font-bold" style={{ color: "#374151" }}>اسم الجهاز</th>
                      <th className="px-4 py-2.5 text-right font-bold" style={{ color: "#374151" }}>Device ID</th>
                      <th className="px-4 py-2.5 text-right font-bold" style={{ color: "#374151" }}>آخر تفعيل</th>
                      <th className="px-4 py-2.5 text-center font-bold" style={{ color: "#374151" }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((dev: any, i: number) => (
                      <tr key={dev.id} style={{ borderBottom: i < devices.length - 1 ? `1px solid ${BORDER}` : "none" }} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 shrink-0" style={{ color: dev.status === "active" ? NAVY2 : "#9CA3AF" }} />
                            <span className="font-bold" style={{ color: NAVY2 }}>{dev.deviceName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "#6B7280" }}>
                          {String(dev.deviceId).substring(0, 20)}…
                        </td>
                        <td className="px-4 py-3" style={{ color: "#6B7280" }}>
                          {dev.lastActivatedAt ? fmtTime(String(dev.lastActivatedAt)) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold ${
                            dev.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dev.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                            {dev.status === "active" ? "نشط" : "غير نشط"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* سجل العمليات */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
                <ClipboardList className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="text-[16px] font-extrabold" style={{ color: NAVY2 }}>سجل العمليات</h3>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto max-h-72">
                {ops.map((op: any) => (
                  <div key={op.id} className="flex items-start gap-3">
                    <OpDot type={op.operationType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: NAVY2 }}>{op.description}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{fmtTime(op.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
