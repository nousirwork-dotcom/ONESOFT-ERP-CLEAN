import React, { useState, useEffect } from 'react';
import type { OneSoftConfig, InstallMode, RemoteServerConfig, ChangeModeRequest } from '../../core/types';
import { DeploymentOrchestrator } from '../../core/deployment/DeploymentOrchestrator';

const orchestrator = new DeploymentOrchestrator();

type Tab = 'overview' | 'server' | 'database' | 'mode' | 'backup' | 'updates' | 'license';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'نظرة عامة',    icon: '🖥️' },
  { id: 'mode',     label: 'وضع التثبيت',  icon: '⚙️' },
  { id: 'server',   label: 'السيرفر',      icon: '🌐' },
  { id: 'database', label: 'قاعدة البيانات', icon: '🗄️' },
  { id: 'backup',   label: 'النسخ الاحتياطية', icon: '💾' },
  { id: 'updates',  label: 'التحديثات',    icon: '🔄' },
  { id: 'license',  label: 'الترخيص',      icon: '🔑' },
];

const MODE_LABELS: Record<string, string> = {
  standalone:    'مستقل — جهاز واحد',
  'server-only': 'سيرفر فقط',
  'client-only': 'عميل فقط',
  'server+client': 'سيرفر + عميل',
  branch:        'فرع',
  'hybrid-cloud': 'هجين سحابي',
  'cloud-only':  'سحابي كامل',
};

export function DeploymentSettings() {
  const [tab, setTab] = useState<Tab>('overview');
  const [config, setConfig] = useState<OneSoftConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (window as any).installer?.getConfig().then((cfg: OneSoftConfig) => setConfig(cfg));
  }, []);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full" dir="rtl">
        <div className="text-gray-500">جارٍ تحميل الإعدادات...</div>
      </div>
    );
  }

  async function save(partial: Partial<OneSoftConfig>) {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const merged = { ...config, ...partial };
      await (window as any).installer?.saveConfig(merged);
      setConfig(merged);
      setMessage({ type: 'success', text: 'تم حفظ الإعدادات بنجاح' });
    } catch (e) {
      setMessage({ type: 'error', text: `فشل الحفظ: ${e}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full bg-gray-50" dir="rtl">
      {/* Sidebar */}
      <nav className="w-48 bg-white border-l border-gray-200 flex flex-col py-4 gap-1">
        <div className="px-4 pb-3 border-b border-gray-100">
          <div className="text-sm font-bold text-gray-700">إعدادات النشر</div>
          <div className="text-xs text-gray-400">v{config.version}</div>
        </div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`mx-2 px-3 py-2 rounded-lg text-right text-sm flex items-center gap-2 transition-colors
              ${tab === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {tab === 'overview'  && <OverviewTab config={config} />}
        {tab === 'mode'      && <ModeTab config={config} onSave={save} saving={saving} />}
        {tab === 'server'    && <ServerTab config={config} onSave={save} saving={saving} />}
        {tab === 'database'  && <DatabaseTab config={config} onSave={save} saving={saving} />}
        {tab === 'backup'    && <BackupTab config={config} onSave={save} saving={saving} />}
        {tab === 'updates'   && <UpdatesTab config={config} onSave={save} saving={saving} />}
        {tab === 'license'   && <LicenseTab config={config} onSave={save} saving={saving} />}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ──────────────────────────────────────────────────────────────────────────────
function OverviewTab({ config }: { config: OneSoftConfig }) {
  const plan = orchestrator.getPlan(config.installMode);
  const components = [
    { label: 'قاعدة البيانات (PostgreSQL)', active: config.components.database },
    { label: 'خادم التطبيق (Backend)',       active: config.components.backend },
    { label: 'واجهة المستخدم (Frontend)',    active: config.components.frontend },
    { label: 'خدمة التحديثات (Updater)',     active: config.components.updater },
    { label: 'خدمة النسخ الاحتياطية',        active: config.components.backup },
  ];
  return (
    <div className="space-y-6">
      <Section title="حالة النظام">
        <div className="grid grid-cols-2 gap-4">
          <InfoCard label="وضع التثبيت" value={MODE_LABELS[config.installMode] ?? config.installMode} />
          <InfoCard label="وضع التشغيل" value={config.runMode} />
          <InfoCard label="إصدار النظام" value={config.version} />
          <InfoCard label="نسخة الإعدادات" value={`v${config.configVersion ?? 1}`} />
        </div>
      </Section>
      <Section title="المكونات المثبّتة">
        <div className="space-y-2">
          {components.map(c => (
            <div key={c.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{c.label}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {c.active ? 'مثبّت' : 'غير مثبّت'}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="وصف الوضع الحالي">
        <p className="text-sm text-gray-600">{plan.description}</p>
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Change Mode
// ──────────────────────────────────────────────────────────────────────────────
function ModeTab({ config, onSave, saving }: TabProps) {
  const [targetMode, setTargetMode] = useState<InstallMode>(config.installMode);
  const [applying, setApplying] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const modes = DeploymentOrchestrator.availableModes();
  const plan  = orchestrator.getPlan(targetMode);
  const changed = targetMode !== config.installMode;

  async function apply() {
    setApplying(true);
    setLog([]);
    try {
      const req: ChangeModeRequest = {
        currentMode: config.installMode,
        targetMode,
      };
      const result = await (window as any).installer?.changeMode(req);
      if (result?.success) {
        setLog(prev => [...prev, '✅ تم تغيير الوضع بنجاح — أعد تشغيل النظام']);
        await onSave({ installMode: targetMode, components: orchestrator.getComponents(targetMode) } as any);
      } else {
        setLog(prev => [...prev, `❌ فشل: ${result?.error}`]);
      }
    } catch (e) {
      setLog(prev => [...prev, `❌ خطأ: ${e}`]);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="اختيار وضع التثبيت">
        <div className="space-y-2">
          {modes.map(m => (
            <label key={m} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              targetMode === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
              <input type="radio" name="mode" value={m} checked={targetMode === m}
                onChange={() => setTargetMode(m)} className="mt-1" />
              <div>
                <div className="text-sm font-medium">{MODE_LABELS[m] ?? m}</div>
                <div className="text-xs text-gray-500">{orchestrator.getPlan(m).description}</div>
              </div>
            </label>
          ))}
        </div>
      </Section>

      {changed && (
        <Section title="التغييرات المطلوبة">
          <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
            ⚠️ التحويل من <b>{MODE_LABELS[config.installMode]}</b> إلى <b>{MODE_LABELS[targetMode]}</b>
            قد يتطلب إعادة تشغيل الخدمات
          </div>
          <button onClick={apply} disabled={applying || saving}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {applying ? 'جارٍ التطبيق...' : 'تطبيق التغيير'}
          </button>
        </Section>
      )}

      {log.length > 0 && (
        <Section title="سجل العملية">
          <div className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono space-y-1">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </Section>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Server Settings
// ──────────────────────────────────────────────────────────────────────────────
function ServerTab({ config, onSave, saving }: TabProps) {
  const [backend,  setBackend]  = useState(config.server.backendPort);
  const [frontend, setFrontend] = useState(config.server.frontendPort);
  const [apiUrl,   setApiUrl]   = useState(config.remoteServer?.apiUrl ?? '');
  const [syncMode, setSyncMode] = useState<RemoteServerConfig['syncMode']>(config.remoteServer?.syncMode ?? 'realtime');

  const showRemote = config.components && !config.components.backend;

  return (
    <div className="space-y-6">
      {!showRemote && (
        <Section title="منافذ الخادم المحلي">
          <Field label="منفذ Backend API">
            <input type="number" value={backend} onChange={e => setBackend(+e.target.value)}
              className={INPUT} min={1024} max={65535} />
          </Field>
          <Field label="منفذ Frontend">
            <input type="number" value={frontend} onChange={e => setFrontend(+e.target.value)}
              className={INPUT} min={1024} max={65535} />
          </Field>
          <SaveButton saving={saving} onClick={() => onSave({
            server: { ...config.server, backendPort: backend, frontendPort: frontend }
          })} />
        </Section>
      )}

      {(showRemote || config.remoteServer?.enabled) && (
        <Section title="إعدادات السيرفر البعيد">
          <Field label="عنوان API الرئيسي">
            <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
              placeholder="http://192.168.1.100:3000" className={INPUT} />
          </Field>
          <Field label="وضع المزامنة">
            <select value={syncMode} onChange={e => setSyncMode(e.target.value as any)} className={INPUT}>
              <option value="realtime">فوري (Realtime)</option>
              <option value="scheduled">مجدوَل</option>
              <option value="manual">يدوي</option>
            </select>
          </Field>
          <SaveButton saving={saving} onClick={async () => {
            const cfg: RemoteServerConfig = { enabled: true, apiUrl, apiKey: config.remoteServer?.apiKey ?? null, syncMode };
            await (window as any).installer?.changeEndpoint(cfg);
            onSave({ remoteServer: cfg });
          }} />
        </Section>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Database
// ──────────────────────────────────────────────────────────────────────────────
function DatabaseTab({ config, onSave, saving }: TabProps) {
  const [host, setHost]   = useState(config.database.host);
  const [port, setPort]   = useState(config.database.port);
  const [name, setName]   = useState(config.database.name);
  const [user, setUser]   = useState(config.database.user);

  return (
    <div className="space-y-6">
      <Section title="اتصال قاعدة البيانات">
        <Field label="المضيف (Host)">
          <input type="text" value={host} onChange={e => setHost(e.target.value)} className={INPUT} />
        </Field>
        <Field label="المنفذ (Port)">
          <input type="number" value={port} onChange={e => setPort(+e.target.value)} className={INPUT} />
        </Field>
        <Field label="اسم قاعدة البيانات">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
        </Field>
        <Field label="المستخدم">
          <input type="text" value={user} onChange={e => setUser(e.target.value)} className={INPUT} />
        </Field>
        <div className="text-xs text-gray-500">
          ⚠️ تغيير هذه الإعدادات يتطلب إعادة تشغيل الخدمات
        </div>
        <SaveButton saving={saving} onClick={() => onSave({
          database: { ...config.database, host, port, name, user }
        })} />
      </Section>

      <Section title="نقل قاعدة البيانات لجهاز آخر">
        <p className="text-sm text-gray-600 mb-3">
          انقل قاعدة البيانات الحالية إلى سيرفر PostgreSQL آخر مع الاحتفاظ بجميع البيانات.
        </p>
        <button
          onClick={() => {/* TODO: فتح معالج نقل قاعدة البيانات */}}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          بدء معالج نقل قاعدة البيانات
        </button>
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Backup
// ──────────────────────────────────────────────────────────────────────────────
function BackupTab({ config, onSave, saving }: TabProps) {
  const [enabled,     setEnabled]     = useState(config.backup.enabled);
  const [retention,   setRetention]   = useState(config.backup.retentionDays);
  const [compress,    setCompress]    = useState(config.backup.compress);
  const [attachments, setAttachments] = useState(config.backup.includeAttachments);

  return (
    <div className="space-y-6">
      <Section title="إعدادات النسخ الاحتياطية">
        <Toggle label="تفعيل النسخ الاحتياطية التلقائية" checked={enabled} onChange={setEnabled} />
        {enabled && (
          <>
            <Field label="الاحتفاظ بالنسخ (أيام)">
              <input type="number" value={retention} onChange={e => setRetention(+e.target.value)}
                className={INPUT} min={1} max={365} />
            </Field>
            <Toggle label="ضغط الملفات (ZIP)" checked={compress} onChange={setCompress} />
            <Toggle label="تضمين المرفقات" checked={attachments} onChange={setAttachments} />
          </>
        )}
        <SaveButton saving={saving} onClick={() => onSave({
          backup: { ...config.backup, enabled, retentionDays: retention, compress, includeAttachments: attachments }
        })} />
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Updates
// ──────────────────────────────────────────────────────────────────────────────
function UpdatesTab({ config, onSave, saving }: TabProps) {
  const [autoCheck, setAutoCheck] = useState(config.update.autoCheck);
  const [channel,   setChannel]   = useState(config.update.channel);
  const [serverUrl, setServerUrl] = useState(config.update.updateServerUrl);

  return (
    <div className="space-y-6">
      <Section title="إعدادات التحديثات">
        <Toggle label="فحص التحديثات تلقائياً" checked={autoCheck} onChange={setAutoCheck} />
        <Field label="قناة التحديث">
          <select value={channel} onChange={e => setChannel(e.target.value as any)} className={INPUT}>
            <option value="stable">مستقر (Stable)</option>
            <option value="beta">تجريبي (Beta)</option>
            <option value="dev">تطوير (Dev)</option>
          </select>
        </Field>
        <Field label="سيرفر التحديثات">
          <input type="text" value={serverUrl} onChange={e => setServerUrl(e.target.value)} className={INPUT} />
        </Field>
        <SaveButton saving={saving} onClick={() => onSave({
          update: { ...config.update, autoCheck, channel, updateServerUrl: serverUrl }
        })} />
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: License
// ──────────────────────────────────────────────────────────────────────────────
function LicenseTab({ config, onSave, saving }: TabProps) {
  const [key, setKey] = useState(config.license.key ?? '');

  const TYPE_LABELS: Record<string, string> = {
    trial: 'تجريبي',
    standard: 'معياري',
    enterprise: 'مؤسسي',
  };

  return (
    <div className="space-y-6">
      <Section title="معلومات الترخيص">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <InfoCard label="نوع الترخيص" value={TYPE_LABELS[config.license.type] ?? config.license.type} />
          <InfoCard label="الحد الأقصى للمستخدمين" value={String(config.license.maxUsers)} />
          <InfoCard label="تاريخ التفعيل"   value={config.license.activatedAt ?? 'غير مفعّل'} />
          <InfoCard label="تاريخ الانتهاء"  value={config.license.expiresAt ?? 'غير محدد'} />
        </div>
      </Section>
      <Section title="تفعيل مفتاح الترخيص">
        <Field label="مفتاح الترخيص">
          <input type="text" value={key} onChange={e => setKey(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX" className={INPUT} dir="ltr" />
        </Field>
        <button disabled={!key || saving}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          تفعيل
        </button>
      </Section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared Components
// ──────────────────────────────────────────────────────────────────────────────
type TabProps = { config: OneSoftConfig; onSave: (p: Partial<OneSoftConfig>) => Promise<void>; saving: boolean };

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
        onClick={() => onChange(!checked)}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${checked ? 'right-0.5' : 'left-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
      {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
    </button>
  );
}
