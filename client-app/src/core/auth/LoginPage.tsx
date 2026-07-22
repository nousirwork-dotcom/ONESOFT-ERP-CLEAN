import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useLocation } from 'wouter';
import FirstRunWizard from '@/core/auth/FirstRunWizard';
import ForgotPasswordFlow from '@/core/auth/ForgotPasswordFlow';
import ElectronTitleBar from '@/shared/components/ElectronTitleBar';
import { useBranding, getStartupPath } from '@/core/contexts/BrandingContext';

// ─── Transition durations (ms) ────────────────────────────────────────────────
const TRANS_DURATION: Record<string, number> = {
  fade: 500, slide: 550, zoom: 520, split_center: 620,
};

// ─── TransitionOverlay ────────────────────────────────────────────────────────
function TransitionOverlay({ type, loginBg, onDone }: { type: string; loginBg: string; onDone: () => void }) {
  const doneRef = useRef(false);
  const duration = TRANS_DURATION[type] ?? 600;
  useEffect(() => {
    const t = setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone(); } }, duration + 50);
    return () => clearTimeout(t);
  }, [duration, onDone]);
  const base: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' };
  if (type === 'split_center') return (
    <>
      <div style={{ ...base, width: '50%', left: 0, right: 'auto', background: loginBg, animation: `onesoft-split-left ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
      <div style={{ ...base, width: '50%', left: '50%', background: loginBg, animation: `onesoft-split-right ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
      <TransitionStyles />
    </>
  );
  if (type === 'fade')  return <><div style={{ ...base, background: loginBg, animation: `onesoft-fade-out ${duration}ms ease-in-out forwards` }} /><TransitionStyles /></>;
  if (type === 'slide') return <><div style={{ ...base, background: loginBg, animation: `onesoft-slide-up ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} /><TransitionStyles /></>;
  if (type === 'zoom')  return <><div style={{ ...base, background: loginBg, animation: `onesoft-zoom-out ${duration}ms cubic-bezier(0.4,0,0.6,1) forwards` }} /><TransitionStyles /></>;
  return null;
}

function TransitionStyles() {
  return <style>{`
    @keyframes onesoft-split-left  { 0%{transform:translateX(0);opacity:1} 20%{transform:translateX(0);opacity:1} 100%{transform:translateX(-102%);opacity:0.8} }
    @keyframes onesoft-split-right { 0%{transform:translateX(0);opacity:1} 20%{transform:translateX(0);opacity:1} 100%{transform:translateX(102%);opacity:0.8}  }
    @keyframes onesoft-fade-out    { 0%{opacity:1} 30%{opacity:1} 100%{opacity:0} }
    @keyframes onesoft-slide-up    { 0%{transform:translateY(0);opacity:1} 20%{transform:translateY(0);opacity:1} 100%{transform:translateY(-105%);opacity:0.7} }
    @keyframes onesoft-zoom-out    { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.18);opacity:0} }
    @keyframes spin { to { transform: rotate(360deg); } }
  `}</style>;
}

function Spinner({ size = 32 }: { size?: number }) {
  return <div style={{
    width: size, height: size,
    border: '3px solid rgba(var(--brand-primary-rgb)/0.18)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  }} />;
}

// ─── ChangeOrgDialog — حوار كلمة مرور المسؤول لتغيير المؤسسة ─────────────────
function ChangeOrgDialog({
  onConfirmed,
  onCancel,
}: {
  onConfirmed: () => void;
  onCancel:    () => void;
}) {
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const verifyMut = trpc.auth.verifyAdminPassword.useMutation({
    onSuccess: () => { onConfirmed(); },
    onError:   (e) => { setError(e.message); },
  });

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--background)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 13px', fontSize: 13,
    color: 'var(--foreground)', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        dir="rtl"
        style={{
          background: 'var(--card)', borderRadius: 16,
          padding: '28px 32px', width: 340,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          fontFamily: "'Cairo', Tahoma, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 8 }}>🔐</div>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, textAlign: 'center', color: 'var(--foreground)' }}>
          تغيير المؤسسة
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
          يتطلب تغيير المؤسسة التحقق من صلاحية المسؤول
        </p>

        {error && (
          <div style={{
            color: '#B91C1C', fontSize: 12, background: '#FEF2F2',
            border: '1px solid #FCA5A5', borderRadius: 6,
            padding: '7px 12px', marginBottom: 12, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              اسم مستخدم المسؤول
            </label>
            <input
              style={inp}
              placeholder="admin"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoFocus
              data-global-keyboard="false"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              كلمة مرور المسؤول
            </label>
            <input
              type="password"
              style={inp}
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') verifyMut.mutate(form); }}
              data-global-keyboard="false"
            />
          </div>

          <button
            onClick={() => verifyMut.mutate(form)}
            disabled={verifyMut.isPending || !form.username}
            style={{
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              border: 'none', borderRadius: 8, padding: '10px 0',
              fontWeight: 700, fontSize: 13, cursor: verifyMut.isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: verifyMut.isPending ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {verifyMut.isPending ? <><Spinner size={14} />جارٍ التحقق...</> : 'تأكيد الصلاحية'}
          </button>

          <button
            onClick={onCancel}
            disabled={verifyMut.isPending}
            style={{
              background: 'transparent', color: 'var(--muted-foreground)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '9px 0', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrgInfoCard — كارت المؤسسة الثابت (للقراءة فقط) ─────────────────────────
function OrgInfoCard({
  orgName,
  orgCode,
  licenseId,
  isTrial,
  onRequestChangeOrg,
}: {
  orgName:            string;
  orgCode:            string;
  licenseId:          string | null;
  isTrial:            boolean;
  onRequestChangeOrg: () => void;
}) {
  return (
    <div style={{
      background: isTrial
        ? 'linear-gradient(135deg, rgba(234,179,8,0.10) 0%, rgba(234,179,8,0.04) 100%)'
        : 'linear-gradient(135deg, rgba(var(--brand-primary-rgb)/0.07) 0%, rgba(var(--brand-primary-rgb)/0.02) 100%)',
      border: isTrial
        ? '1.5px solid rgba(234,179,8,0.35)'
        : '1.5px solid rgba(var(--brand-primary-rgb)/0.22)',
      borderRadius: 10, padding: '14px 18px', marginBottom: 16,
    }}>
      {/* رأس الكارت */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: isTrial ? 'rgba(234,179,8,0.15)' : 'rgba(var(--brand-primary-rgb)/0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>{isTrial ? '🧪' : '🏢'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 2 }}>
            {isTrial ? 'نسخة تجريبية' : 'المؤسسة'}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 800, color: 'var(--foreground)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {orgName}
          </div>
        </div>
      </div>

      {/* كود المؤسسة / التجربة */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--background)', border: '1px solid var(--border)',
        borderRadius: 7, padding: '6px 12px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 1 }}>
            {isTrial ? 'كود التجربة' : 'كود المؤسسة'}
          </div>
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: 14, fontWeight: 700, letterSpacing: 0.8,
            color: 'var(--primary)',
          }}>
            {orgCode}
          </div>
        </div>
        <span style={{
          fontSize: 9, color: 'var(--muted-foreground)',
          background: 'rgba(var(--brand-primary-rgb)/0.08)',
          padding: '2px 7px', borderRadius: 4, fontWeight: 600,
          whiteSpace: 'nowrap', userSelect: 'none',
        }}>
          للقراءة فقط
        </span>
      </div>

      {licenseId && (
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 6, direction: 'ltr', textAlign: 'right' }}>
          License: {licenseId}
        </div>
      )}

      {/* رابط تغيير المؤسسة — يُطلب كلمة مرور مسؤول */}
      <button
        type="button"
        onClick={onRequestChangeOrg}
        style={{
          display: 'block', width: '100%', marginTop: 10,
          background: 'none', border: 'none', padding: 0,
          color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer',
          textDecoration: 'underline', fontFamily: 'inherit', textAlign: 'center',
        }}
      >
        🔄 تغيير المؤسسة (للمسؤول فقط)
      </button>
    </div>
  );
}

// ─── LoginForm ────────────────────────────────────────────────────────────────
function LoginForm({
  onSuccess,
  utils,
  orgCode,
  orgName,
  licenseId,
  isTrial,
  onRequestChangeOrg,
  onForgotPassword,
}: {
  onSuccess:          (role: string) => void;
  utils:              ReturnType<typeof trpc.useUtils>;
  orgCode:            string;
  orgName:            string;
  licenseId:          string | null;
  isTrial:            boolean;
  onRequestChangeOrg: () => void;
  onForgotPassword:   () => void;
}) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--background)', border: '1px solid var(--border)',
    borderRadius: 'var(--brand-border-radius)', padding: '10px 14px',
    fontSize: 13, color: 'var(--foreground)', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          password,
          orgCode: orgCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'خطأ في تسجيل الدخول');
      } else {
        await utils.auth.me.invalidate();
        onSuccess(data.user?.role ?? 'user');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>

      {/* كارت المؤسسة — للقراءة فقط (يظهر فقط عند توفر كود المؤسسة) */}
      {orgCode && (
        <OrgInfoCard
          orgName={orgName}
          orgCode={orgCode}
          licenseId={licenseId}
          isTrial={isTrial}
          onRequestChangeOrg={onRequestChangeOrg}
        />
      )}

      {error && (
        <div style={{
          color: '#B91C1C', fontSize: 12, textAlign: 'center',
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: '7px 12px',
        }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 5, textAlign: 'right' }}>
          اسم المستخدم
        </label>
        <input
          style={inp} placeholder="أدخل اسم المستخدم"
          required autoFocus autoComplete="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          data-global-keyboard="false"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 5, textAlign: 'right' }}>
          كلمة المرور
        </label>
        <input
          type="password" style={inp}
          placeholder="أدخل كلمة المرور"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          data-global-keyboard="false"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          background: 'var(--primary)', color: 'var(--primary-foreground)',
          border: 'none', borderRadius: 'var(--brand-border-radius)', padding: '11px 0',
          fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginTop: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? <><Spinner size={16} />جارٍ الدخول...</> : 'تسجيل الدخول'}
      </button>

      <button
        type="button"
        onClick={onForgotPassword}
        style={{
          background: 'none', border: 'none', padding: 0,
          color: 'var(--muted-foreground)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
          textDecoration: 'underline', textAlign: 'center',
        }}
      >
        🔐 نسيت كلمة المرور؟
      </button>
    </form>
  );
}

// ─── LicenseExpiredView ───────────────────────────────────────────────────────
function LicenseExpiredView({ orgName, orgCode, expiry }: { orgName: string; orgCode: string; expiry: string | null }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
      padding: '28px 32px', border: '1px solid #FCA5A5',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 360, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: '#B91C1C', marginBottom: 8 }}>
        انتهت صلاحية الترخيص
      </div>
      <div style={{
        background: '#FEF2F2', border: '1px solid #FCA5A5',
        borderRadius: 8, padding: '10px 14px', marginBottom: 14, textAlign: 'right',
      }}>
        <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 4 }}>المؤسسة: <strong>{orgName}</strong></div>
        <div style={{ fontSize: 12, color: '#B91C1C', fontFamily: 'monospace' }}>الكود: {orgCode}</div>
        {expiry && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>انتهى: {expiry}</div>}
      </div>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
        انتهت صلاحية الترخيص أو تم إيقافه.
        <br />
        يرجى التواصل مع مزود النظام لتجديد الاشتراك.
      </p>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [phase, setPhase]               = useState<'loading' | 'dbError' | 'login' | 'wizard'>('loading');
  const [transitioning, setTransitioning] = useState(false);
  const [transType, setTransType]       = useState('none');
  const [showChangeOrgDialog, setShowChangeOrgDialog] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const utils        = trpc.useUtils();
  const [, navigate] = useLocation();
  const { settings } = useBranding();

  const firstRunQ   = trpc.setup.isFirstRun.useQuery(undefined, {
    retry: 3,
    retryDelay: 2000,
    staleTime: 0,
    // أثناء تهيئة الإقلاع نستطلع كل ثانية حتى تكتمل ثم ننتقل تلقائياً لشاشة الدخول
    refetchInterval: (query) => (query.state.data?.initializing ? 1000 : false),
  });
  const licCtxQ     = trpc.license.getLoginContext.useQuery(undefined, { staleTime: 30_000, retry: 1 });
  const clearOrgMut = trpc.license.clearSavedOrgCode.useMutation({
    onSuccess: () => licCtxQ.refetch(),
  });

  const loginBg = (() => {
    const s = settings;
    if (s.login_background_type === 'solid') return s.login_background_value;
    if (s.login_background_type === 'image') return `url(${s.login_background_value}) center/cover no-repeat`;
    return s.login_background_value;
  })();

  const doNavigate = useCallback((p: string) => navigate(p), [navigate]);

  const tryAutoLogin = async () => {
    // لا تجربة auto-login إذا لم تكن هناك علامة جلسة من هذا التشغيل.
    // sessionStorage تُمسح عند إغلاق البرنامج أو التبويب — تشغيل جديد = لا stamp.
    if (sessionStorage.getItem('onesoft_login_launch') !== 'active') return false;
    try {
      const res = await fetch('/api/auth/auto-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      if (res.ok) { await utils.auth.me.invalidate(); doNavigate(getStartupPath(settings.startup_page)); return true; }
    } catch { /* show manual login */ }
    return false;
  };

  useEffect(() => {
    if (firstRunQ.isLoading) { setPhase('loading'); return; }
    if (firstRunQ.isError)   { setPhase('dbError'); return; }
    const { firstRun, dbError, initializing } = firstRunQ.data ?? {};
    if (initializing) { setPhase('loading'); return; } // ما زال الخادم يهيّئ — استمر بالتحميل والاستطلاع
    if (dbError)  { setPhase('dbError'); return; }
    if (firstRun) { setPhase('wizard'); return; }
    tryAutoLogin().then(ok => { if (!ok) setPhase('login'); });
  }, [firstRunQ.isLoading, firstRunQ.isError, firstRunQ.data]);

  // إذا بقي التحميل أكثر من 15 ثانية → أظهر خطأ مع زر إعادة المحاولة
  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = setTimeout(() => {
      setPhase('dbError');
    }, 15000);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleLoginSuccess = useCallback(async (_role: string) => {
    // تعيين علامة الجلسة — تبقى حتى إغلاق البرنامج/التبويب أو تسجيل الخروج
    sessionStorage.setItem('onesoft_login_launch', 'active');
    const transition = settings.opening_transition ?? 'none';
    const targetPath = getStartupPath(settings.startup_page);
    if (transition === 'none') { doNavigate(targetPath); return; }
    setTransType(transition); setTransitioning(true);
    await new Promise(r => setTimeout(r, (TRANS_DURATION[transition] ?? 600) + 80));
    doNavigate(targetPath);
  }, [settings.opening_transition, settings.startup_page, doNavigate]);

  // المسؤول تحقق بنجاح → مسح prefs والانتقال لصفحة التفعيل
  const handleChangeOrgConfirmed = useCallback(() => {
    setShowChangeOrgDialog(false);
    clearOrgMut.mutate();
    navigate('/cfg/license');
  }, [clearOrgMut, navigate]);

  // ── First Run Wizard ──
  if (phase === 'wizard') {
    return <FirstRunWizard onComplete={async () => { await utils.auth.me.invalidate(); doNavigate('/'); }} />;
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh', background: loginBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cairo', Tahoma, sans-serif",
        fontSize: 'var(--brand-font-size)', position: 'relative', overflow: 'hidden',
        paddingTop: 32,
      }}
    >
      <ElectronTitleBar />

      {transitioning && <TransitionOverlay type={transType} loginBg={loginBg} onDone={() => setTransitioning(false)} />}

      {/* حوار التحقق من المسؤول */}
      {showChangeOrgDialog && (
        <ChangeOrgDialog
          onConfirmed={handleChangeOrgConfirmed}
          onCancel={() => setShowChangeOrgDialog(false)}
        />
      )}

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        {/* Logo + Title */}
        <img src="/logo.png" alt="OneSoft ERP" style={{
          width: 118, height: 118,
          display: 'block', margin: '0 auto 20px',
          borderRadius: 'var(--brand-border-radius)',
          boxShadow: '0 8px 28px rgba(var(--brand-primary-rgb)/0.35)',
          objectFit: 'cover',
        }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px' }}>
          One<span style={{ color: 'var(--primary)' }}>Soft</span> ERP
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '0 0 24px' }}>
          نظام إدارة الأعمال المتكامل
        </p>

        {/* ── تحميل ── */}
        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spinner size={36} />
            <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>جارٍ الاتصال بالخادم...</span>
          </div>
        )}

        {/* ── خطأ قاعدة البيانات ── */}
        {phase === 'dbError' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
            padding: '24px 28px', border: '1px solid #FCA5A5',
            boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb)/0.1)', maxWidth: 340,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>تعذّر الاتصال بقاعدة البيانات</div>
            <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
              الخادم يعمل لكن لا يستطيع الاتصال بـ PostgreSQL. تأكد من أن الخدمة تعمل وأن ملف config.json صحيح.
            </div>
            <button onClick={() => { setPhase('loading'); firstRunQ.refetch(); }} style={{
              background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none',
              borderRadius: 'var(--brand-border-radius)', padding: '9px 20px', fontWeight: 700,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, width: '100%',
            }}>🔄 إعادة المحاولة</button>
            <button onClick={() => setPhase('login')} style={{
              background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
              borderRadius: 'var(--brand-border-radius)', padding: '7px 20px', fontWeight: 600,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
            }}>تسجيل الدخول يدوياً</button>
          </div>
        )}

        {/* ── شاشة الدخول ── */}
        {phase === 'login' && (
          <>
            {/* تحميل سياق الترخيص */}
            {licCtxQ.isLoading && (
              <div style={{
                background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
                padding: '28px 40px', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              }}>
                <Spinner size={28} />
                <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>جارٍ التحقق من الترخيص...</span>
              </div>
            )}

            {/* الترخيص منتهي */}
            {!licCtxQ.isLoading && licCtxQ.data?.isExpired && (
              <LicenseExpiredView
                orgName={licCtxQ.data.orgName ?? ''}
                orgCode={licCtxQ.data.orgCode ?? ''}
                expiry={licCtxQ.data.licExpiry}
              />
            )}

            {/* غير منتهي فعلياً → نموذج الدخول دائماً (لا حلقة، لا عدّاد، لا توجيه) */}
            {!licCtxQ.isLoading && !licCtxQ.data?.isExpired && (
              <div style={{
                background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
                padding: '24px 28px', border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb)/0.1)',
              }}>
                {showForgotPassword ? (
                  <ForgotPasswordFlow
                    onBack={() => setShowForgotPassword(false)}
                    orgCode={licCtxQ.data?.orgCode ?? ''}
                    orgName={licCtxQ.data?.orgName ?? licCtxQ.data?.orgCode ?? ''}
                  />
                ) : (
                  <LoginForm
                    onSuccess={handleLoginSuccess}
                    utils={utils}
                    orgCode={licCtxQ.data?.orgCode ?? ''}
                    orgName={licCtxQ.data?.orgName ?? licCtxQ.data?.orgCode ?? ''}
                    licenseId={licCtxQ.data?.licenseId ?? null}
                    isTrial={licCtxQ.data?.isTrial ?? false}
                    onRequestChangeOrg={() => setShowChangeOrgDialog(true)}
                    onForgotPassword={() => setShowForgotPassword(true)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
