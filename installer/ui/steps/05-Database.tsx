import { useState } from 'react';
import { useInstallerStore } from '../store/installer.store';
import type { DatabaseMode } from '../../core/types';
import type { ExistingDbInfo } from '../../core/database/ExistingDbDetector';
import { generateSecurePassword } from '../lib/generatePassword';

const DB_MODES: {
  id: DatabaseMode;
  icon: string;
  title: string;
  subtitle: string;
  future?: boolean;
}[] = [
  {
    id:       'local-install',
    icon:     '📦',
    title:    'PostgreSQL محلي — تثبيت جديد',
    subtitle: 'سيقوم المثبِّت بتنزيل وإعداد PostgreSQL تلقائياً على هذا الجهاز',
  },
  {
    id:       'local-existing',
    icon:     '🔍',
    title:    'PostgreSQL محلي — موجود مسبقاً',
    subtitle: 'استخدم PostgreSQL مثبَّتاً على هذا الجهاز — يمكنك اختيار قاعدة موجودة أو إنشاء جديدة',
  },
  {
    id:       'remote',
    icon:     '🌐',
    title:    'قاعدة بيانات بعيدة (Remote)',
    subtitle: 'الاتصال بـ PostgreSQL على جهاز أو سيرفر آخر في الشبكة',
  },
  {
    id:       'cloud',
    icon:     '☁️',
    title:    'قاعدة بيانات سحابية',
    subtitle: 'محجوز للمستقبل — Supabase / RDS / Azure PostgreSQL',
    future:   true,
  },
];

type ChainStep = 'idle' | 'testing' | 'saving' | 'verifying' | 'done' | 'failed';
type StepState = 'pending' | 'running' | 'ok' | 'fail';

export default function Step06DatabaseMode() {
  const {
    databaseMode, setDatabaseMode,
    dbOpts, setDbOpts,
    setDbConfigVerified,
    connectToExisting, setConnectToExisting,
    existingDbInfo, setExistingDbInfo,
  } = useInstallerStore();

  const [detectingExisting, setDetectingExisting] = useState(false);

  const [chainStep, setChainStep] = useState<ChainStep>('idle');
  const [testState,   setTestState]   = useState<StepState>('pending');
  const [saveState,   setSaveState]   = useState<StepState>('pending');
  const [verifyState, setVerifyState] = useState<StepState>('pending');
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [configPath,  setConfigPath]  = useState<string | null>(null);

  const [detecting,   setDetecting]   = useState(false);
  const [detectedDbs, setDetectedDbs] = useState<string[]>([]);

  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false);

  const resetChain = () => {
    setChainStep('idle');
    setTestState('pending');
    setSaveState('pending');
    setVerifyState('pending');
    setErrorMsg(null);
    setConfigPath(null);
    setDbConfigVerified(false);
    setConnectToExisting(false);
    setExistingDbInfo(null);
    (window.installer as any)?.clearConfig?.().catch(() => {});
  };

  // بعد نجاح سلسلة التحقق: افحص إن كانت قاعدة OneSoft موجودة مسبقاً
  const detectExisting = async () => {
    setDetectingExisting(true);
    try {
      const info = await window.installer?.detectExistingDb?.({
        host: dbOpts.host, port: dbOpts.port,
        database: dbOpts.database, user: dbOpts.user, password: dbOpts.password,
      });
      if (info) {
        setExistingDbInfo(info as ExistingDbInfo);
        // نفعّل الاتصال بالموجود افتراضياً فقط عند اكتشاف قاعدة OneSoft مأهولة
        // بها مستخدم واحد على الأقل — وإلا فلا يوجد حساب لتسجيل الدخول، فنُعامِلها
        // كتثبيت جديد (سيُنشئ المعالج المؤسسة والمستخدم الأول).
        const canConnectToExisting = info.exists === true && info.userCount > 0;
        setConnectToExisting(canConnectToExisting);
      }
    } catch {
      setExistingDbInfo(null);
      setConnectToExisting(false);
    } finally {
      setDetectingExisting(false);
    }
  };

  const selectMode = (m: DatabaseMode) => {
    setDatabaseMode(m);
    resetChain();
    setDetectedDbs([]);
    if (m === 'local-install') {
      setDbOpts({ host: 'localhost', password: generateSecurePassword() });
    } else if (m === 'local-existing') {
      setDbOpts({ host: 'localhost' });
    }
  };

  const regeneratePassword = () => {
    setDbOpts({ password: generateSecurePassword() });
    resetChain();
  };

  const onFieldChange = (opts: Parameters<typeof setDbOpts>[0]) => {
    setDbOpts(opts);
    resetChain();
  };

  const runChain = async () => {
    if (!dbOpts.password) return;

    resetChain();
    setChainStep('testing');
    setTestState('running');

    let testOk = false;
    try {
      const r = await window.installer?.testConnection?.({
        host: dbOpts.host, port: dbOpts.port,
        database: 'postgres', user: dbOpts.user, password: dbOpts.password,
      });
      testOk = r?.ok === true;
      setTestState(testOk ? 'ok' : 'fail');
      if (!testOk) {
        setErrorMsg(r?.detail ?? 'فشل اختبار الاتصال — تأكد من كلمة المرور');
        setChainStep('failed');
        await (window.installer as any)?.clearConfig?.().catch(() => {});
        return;
      }
    } catch (e: unknown) {
      setTestState('fail');
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setChainStep('failed');
      await (window.installer as any)?.clearConfig?.().catch(() => {});
      return;
    }

    setChainStep('saving');
    setSaveState('running');

    const cfg = {
        version: (await window.installer?.getVersion?.()) ?? '1.0.28',
      database: {
        host:          dbOpts.host,
        port:          dbOpts.port,
        name:          dbOpts.database,
        user:          'onesoft_app',
        password:      dbOpts.password,
        poolMin:       2,
        poolMax:       10,
      },
      server: {
        backendPort:  3000,
        frontendPort: 5000,
      },
    };

    try {
      await window.installer?.saveConfig?.(cfg as any);
      setSaveState('ok');
    } catch (e: unknown) {
      setSaveState('fail');
      setErrorMsg(`فشل الحفظ: ${e instanceof Error ? e.message : String(e)}`);
      setChainStep('failed');
      return;
    }

    setChainStep('verifying');
    setVerifyState('running');

    try {
      const verify = await (window.installer as any)?.verifyConfig?.() ?? null;
      if (verify?.ok) {
        setVerifyState('ok');
        setConfigPath(verify.configPath ?? null);
        setChainStep('done');
        setDbConfigVerified(true);
        // بعد التحقق: افحص إن كانت قاعدة OneSoft موجودة على هذا الاتصال
        await detectExisting();
      } else {
        setVerifyState('fail');
        setErrorMsg(verify?.detail ?? 'تعذّر التحقق من الإعدادات المحفوظة');
        setChainStep('failed');
      }
    } catch (e: unknown) {
      setVerifyState('fail');
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setChainStep('failed');
    }
  };

  const detectDatabases = async () => {
    setDetecting(true);
    resetChain();
    try {
      const r = await window.installer?.testConnection?.({
        host: 'localhost', port: dbOpts.port,
        database: 'postgres', user: dbOpts.user, password: dbOpts.password,
      });
      if (r?.ok) {
        setDetectedDbs(['onesoft_erp', 'postgres']);
        setDbOpts({ host: 'localhost' });
      }
    } finally {
      setDetecting(false);
    }
  };

  const isBusy = chainStep === 'testing' || chainStep === 'saving' || chainStep === 'verifying';
  const isDone = chainStep === 'done';

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
    background: '#F9FAFB', color: '#1E344F', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
  };
  const smallBtn: React.CSSProperties = {
    flexShrink: 0, padding: '8px 14px', fontSize: 12, fontWeight: 700,
    borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff',
    color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  };

  const stepIcon = (s: StepState, label: string) => {
    const icons: Record<StepState, string> = { pending: '○', running: '⏳', ok: '✅', fail: '❌' };
    const colors: Record<StepState, string> = {
      pending: '#9CA3AF', running: '#2563EB', ok: '#15803D', fail: '#B91C1C',
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors[s] }}>
        <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{icons[s]}</span>
        <span style={{ fontWeight: s === 'running' ? 700 : s === 'ok' ? 700 : 500 }}>{label}</span>
      </div>
    );
  };

  const needsConnectionFields = databaseMode === 'local-existing' || databaseMode === 'remote';
  const canTest = !!dbOpts.password && (databaseMode === 'local-existing' ? true : databaseMode === 'remote' ? !!dbOpts.host : false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          🗄️ إعداد قاعدة البيانات
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          اختر كيف تريد توصيل OneSoft بقاعدة البيانات
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DB_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => !m.future && selectMode(m.id)}
            disabled={m.future}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
              background: databaseMode === m.id ? '#EBF5FF' : m.future ? '#FAFAFA' : '#fff',
              border: `2px solid ${databaseMode === m.id ? '#3B82F6' : m.future ? '#E5E7EB' : '#E5E0D8'}`,
              borderRadius: 10, cursor: m.future ? 'not-allowed' : 'pointer', textAlign: 'right',
              fontFamily: 'inherit', opacity: m.future ? 0.55 : 1, transition: 'all 0.15s',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: databaseMode === m.id ? '#1D4ED8' : '#1E344F',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {m.title}
                {m.future && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    background: '#F3F4F6', padding: '1px 7px', borderRadius: 10,
                  }}>
                    قريباً
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{m.subtitle}</div>
            </div>
            {databaseMode === m.id && (
              <span style={{ fontSize: 18, color: '#3B82F6', flexShrink: 0, marginTop: 1 }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {databaseMode === 'local-install' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 12 }}>
            🔐 حماية قاعدة البيانات
          </div>
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#15803D', fontWeight: 600 }}>
            ✅ تم إنشاء كلمة مرور قوية تلقائياً لهذا الجهاز — لا حاجة لكتابة أو تذكّر أي شيء
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              style={{ ...inp, fontFamily: 'monospace', letterSpacing: 1, background: '#F9FAFB' }}
              type={showGeneratedPassword ? 'text' : 'password'}
              value={dbOpts.password}
              readOnly
            />
            <button type="button" onClick={() => setShowGeneratedPassword(v => !v)} style={smallBtn}>
              {showGeneratedPassword ? 'إخفاء' : 'إظهار'}
            </button>
            <button type="button" onClick={regeneratePassword} style={smallBtn}>
              إعادة توليد
            </button>
          </div>
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0F9FF', borderRadius: 8, fontSize: 12, color: '#0369A1' }}>
            ℹ️ سيتم تثبيت PostgreSQL 16 تلقائياً وإنشاء قاعدة بيانات <b>onesoft_erp</b>. تُحفظ كلمة المرور
            في ملف إعدادات محمي على هذا الجهاز فقط، ولا تظهر لأي شخص آخر.
          </div>
        </div>
      )}

      {databaseMode === 'local-existing' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F' }}>
              🔍 اكتشاف PostgreSQL المحلي
            </div>
            <button
              onClick={detectDatabases}
              disabled={detecting || !dbOpts.password || isBusy}
              style={{
                background: detecting ? '#9CA3AF' : '#6366F1',
                color: '#fff', border: 'none', borderRadius: 7,
                padding: '6px 16px', fontSize: 12, fontWeight: 600,
                cursor: (detecting || !dbOpts.password || isBusy) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {detecting ? '⏳ جارٍ الاكتشاف...' : '🔍 اكتشاف تلقائي'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>المستخدم الإداري</label>
              <input style={inp} value={dbOpts.user}
                onChange={e => onFieldChange({ user: e.target.value })} placeholder="postgres" />
            </div>
            <div>
              <label style={lbl}>المنفذ</label>
              <input style={inp} type="number" value={dbOpts.port}
                onChange={e => onFieldChange({ port: parseInt(e.target.value) || 5432 })} />
            </div>
          </div>
          <div>
            <label style={lbl}>كلمة المرور</label>
            <input style={inp} type="password" value={dbOpts.password}
              onChange={e => onFieldChange({ password: e.target.value })} placeholder="••••••••" />
          </div>

          {detectedDbs.length > 0 && (
            <div>
              <label style={lbl}>قاعدة البيانات</label>
              <select style={inp} value={dbOpts.database}
                onChange={e => onFieldChange({ database: e.target.value })}>
                <option value="onesoft_erp">onesoft_erp (جديدة — ستُنشأ)</option>
                {detectedDbs.filter(d => d !== 'onesoft_erp').map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {databaseMode === 'remote' && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E344F', marginBottom: 4 }}>
            🌐 بيانات الاتصال بالسيرفر البعيد
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>عنوان السيرفر (IP أو Hostname)</label>
              <input style={inp} value={dbOpts.host}
                onChange={e => onFieldChange({ host: e.target.value })}
                placeholder="192.168.1.100 أو db.example.com" dir="ltr" />
            </div>
            <div>
              <label style={lbl}>المنفذ</label>
              <input style={inp} type="number" value={dbOpts.port}
                onChange={e => onFieldChange({ port: parseInt(e.target.value) || 5432 })} />
            </div>
          </div>
          <div>
            <label style={lbl}>اسم قاعدة البيانات</label>
            <input style={inp} value={dbOpts.database}
              onChange={e => onFieldChange({ database: e.target.value })} placeholder="onesoft_erp" dir="ltr" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>المستخدم</label>
              <input style={inp} value={dbOpts.user}
                onChange={e => onFieldChange({ user: e.target.value })} placeholder="postgres" dir="ltr" />
            </div>
            <div>
              <label style={lbl}>كلمة المرور</label>
              <input style={inp} type="password" value={dbOpts.password}
                onChange={e => onFieldChange({ password: e.target.value })} placeholder="••••••••" />
            </div>
          </div>
        </div>
      )}

      {needsConnectionFields && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={runChain}
            disabled={!canTest || isBusy || isDone}
            style={{
              background: isDone
                ? 'linear-gradient(135deg, #059669, #047857)'
                : isBusy
                  ? '#9CA3AF'
                  : 'linear-gradient(135deg, #1E344F, #2d5070)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 13, fontWeight: 700,
              cursor: (!canTest || isBusy || isDone) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', alignSelf: 'flex-start',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {isDone ? '✅ تم التحقق بنجاح' : isBusy ? '⏳ جارٍ...' : '🔌 اختبار الاتصال وحفظ الإعدادات'}
          </button>

          {chainStep !== 'idle' && (
            <div style={{
              background: '#F9FAFB', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 2 }}>
                خطوات التحقق:
              </div>
              {stepIcon(testState,   '1️⃣  اختبار الاتصال بـ PostgreSQL')}
              {stepIcon(saveState,   '2️⃣  حفظ الإعدادات في ملف Config')}
              {stepIcon(verifyState, '3️⃣  إعادة قراءة الملف والتحقق منه')}
            </div>
          )}

          {chainStep === 'failed' && errorMsg && (
            <div style={{
              padding: '12px 16px', borderRadius: 8, fontSize: 13,
              background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>❌ فشل التحقق</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>{errorMsg}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#991B1B' }}>
                💡 تأكد من كلمة المرور وإعادة الاختبار. لن يُسمح بالمتابعة إلا بعد نجاح جميع الخطوات.
              </div>
            </div>
          )}

          {isDone && (
            <div style={{
              padding: '14px 18px', borderRadius: 10, fontSize: 13,
              background: '#F0FDF4', border: '2px solid #86EFAC', color: '#15803D',
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
                ✅ اكتملت جميع خطوات التحقق — يمكنك الانتقال للخطوة التالية
              </div>
              <div style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>
                تم اختبار الاتصال ✓ &nbsp;|&nbsp; تم حفظ الإعدادات ✓ &nbsp;|&nbsp; تم التحقق من الملف ✓
              </div>
              {configPath && (
                <div style={{
                  marginTop: 6, fontSize: 11, fontFamily: 'monospace', direction: 'ltr',
                  background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: 4, color: '#166534',
                }}>
                  📁 {configPath}
                </div>
              )}
            </div>
          )}

          {/* ── اكتشاف قاعدة بيانات OneSoft موجودة ─────────────────────────── */}
          {isDone && detectingExisting && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1',
            }}>
              ⏳ جارٍ فحص قاعدة البيانات للبحث عن تثبيت OneSoft موجود...
            </div>
          )}

          {isDone && !detectingExisting && existingDbInfo?.exists && (
            <div style={{
              padding: '16px 18px', borderRadius: 12,
              background: '#EFF6FF', border: '2px solid #3B82F6',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>🗄️</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1D4ED8' }}>
                    تم العثور على قاعدة بيانات OneSoft موجودة
                  </div>
                  <div style={{ fontSize: 12, color: '#1E40AF', marginTop: 2 }}>
                    {existingDbInfo.orgCount} مؤسسة · {existingDbInfo.userCount} مستخدم
                    {existingDbInfo.schemaVersion ? ` · مخطط ${existingDbInfo.schemaVersion}` : ''}
                  </div>
                </div>
              </div>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                background: connectToExisting ? '#DBEAFE' : '#fff',
                border: `1px solid ${connectToExisting ? '#3B82F6' : '#CBD5E1'}`,
                borderRadius: 8, padding: '10px 14px',
              }}>
                <input
                  type="checkbox"
                  checked={connectToExisting}
                  onChange={e => setConnectToExisting(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 1, accentColor: '#2563EB', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A' }}>
                    الاتصال بالقاعدة الموجودة (إعادة تثبيت آمنة)
                  </div>
                  <div style={{ fontSize: 12, color: '#3730A3', marginTop: 2 }}>
                    سيتم الاحتفاظ بكل بياناتك ومستخدميك — لن تُنشأ مؤسسة أو مستخدم جديد،
                    ولن تُبذر شجرة الحسابات، وستُطبَّق فقط تحديثات المخطط الآمنة.
                    سجّل الدخول بحسابك الحالي بعد الانتهاء.
                  </div>
                </div>
              </label>

              {!connectToExisting && (
                <div style={{
                  padding: '8px 12px', background: '#FEF3C7', border: '1px solid #FCD34D',
                  borderRadius: 8, fontSize: 12, color: '#92400E',
                }}>
                  ⚠️ ألغيت خيار الاتصال بالموجود — سيطلب المُثبِّت إنشاء مؤسسة ومستخدم جديدين.
                  لن تُحذف بياناتك، لكن قد يفشل الإنشاء لوجود مؤسسة مسبقاً.
                </div>
              )}
            </div>
          )}

          {isDone && !detectingExisting && existingDbInfo && !existingDbInfo.exists && existingDbInfo.databaseExists && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#4B5563',
            }}>
              ℹ️ {existingDbInfo.detail} — سيُكمل المُثبِّت كتثبيت جديد.
            </div>
          )}
        </div>
      )}

      {needsConnectionFields && chainStep === 'idle' && canTest && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E',
        }}>
          ⚠️ يجب إجراء اختبار الاتصال وحفظ الإعدادات قبل المتابعة — اضغط الزر أعلاه
        </div>
      )}

    </div>
  );
}
