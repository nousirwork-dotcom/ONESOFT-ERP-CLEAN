import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useLocation } from 'wouter';
import FirstRunWizard from '@/core/auth/FirstRunWizard';
import { useBranding, getStartupPath } from '@/core/contexts/BrandingContext';

// ─── Transition durations (ms) ────────────────────────────────────────────────
const TRANS_DURATION: Record<string, number> = {
  fade:         500,
  slide:        550,
  zoom:         520,
  split_center: 620,
};

// ─── TransitionOverlay ────────────────────────────────────────────────────────
function TransitionOverlay({
  type,
  loginBg,
  onDone,
}: {
  type: string;
  loginBg: string;
  onDone: () => void;
}) {
  const doneRef = useRef(false);
  const duration = TRANS_DURATION[type] ?? 600;

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, duration + 50);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  const base: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
  };

  if (type === 'split_center') return (
    <>
      <div style={{ ...base, width: '50%', left: 0, right: 'auto', background: loginBg, animation: `onesoft-split-left ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
      <div style={{ ...base, width: '50%', left: '50%', background: loginBg, animation: `onesoft-split-right ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} />
      <TransitionStyles />
    </>
  );
  if (type === 'fade') return (
    <><div style={{ ...base, background: loginBg, animation: `onesoft-fade-out ${duration}ms ease-in-out forwards` }} /><TransitionStyles /></>
  );
  if (type === 'slide') return (
    <><div style={{ ...base, background: loginBg, animation: `onesoft-slide-up ${duration}ms cubic-bezier(0.4,0,0.2,1) forwards` }} /><TransitionStyles /></>
  );
  if (type === 'zoom') return (
    <><div style={{ ...base, background: loginBg, animation: `onesoft-zoom-out ${duration}ms cubic-bezier(0.4,0,0.6,1) forwards` }} /><TransitionStyles /></>
  );
  return null;
}

function TransitionStyles() {
  return (
    <style>{`
      @keyframes onesoft-split-left  { 0%{transform:translateX(0);opacity:1} 20%{transform:translateX(0);opacity:1} 100%{transform:translateX(-102%);opacity:0.8} }
      @keyframes onesoft-split-right { 0%{transform:translateX(0);opacity:1} 20%{transform:translateX(0);opacity:1} 100%{transform:translateX(102%);opacity:0.8}  }
      @keyframes onesoft-fade-out    { 0%{opacity:1} 30%{opacity:1} 100%{opacity:0} }
      @keyframes onesoft-slide-up    { 0%{transform:translateY(0);opacity:1} 20%{transform:translateY(0);opacity:1} 100%{transform:translateY(-105%);opacity:0.7} }
      @keyframes onesoft-zoom-out    { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.18);opacity:0} }
      @keyframes spin                { to { transform: rotate(360deg); } }
    `}</style>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: '3px solid rgba(var(--brand-primary-rgb)/0.18)',
      borderTopColor: 'var(--primary)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// ─── OrgCard — كارت المؤسسة الثابت ───────────────────────────────────────────
function OrgCard({
  orgName,
  orgCode,
  licOrgId,
  onChangeOrg,
}: {
  orgName:   string | null;
  orgCode:   string;
  licOrgId:  string | null;
  onChangeOrg: () => void;
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb)/0.06) 0%, rgba(var(--brand-primary-rgb)/0.02) 100%)',
      border: '1.5px solid rgba(var(--brand-primary-rgb)/0.2)',
      borderRadius: 'var(--brand-border-radius)',
      padding: '14px 18px',
      marginBottom: 16,
      textAlign: 'right',
      position: 'relative',
    }}>
      {/* أيقونة المؤسسة */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(var(--brand-primary-rgb)/0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          🏢
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 2 }}>المؤسسة</div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--foreground)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {orgName ?? orgCode}
          </div>
        </div>
      </div>

      {/* كود المؤسسة */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: 6, padding: '5px 10px',
      }}>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', userSelect: 'none' }}>كود المؤسسة</span>
        <span style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 13, fontWeight: 700, letterSpacing: 1,
          color: 'var(--primary)', flex: 1,
        }}>
          {orgCode}
        </span>
        <span style={{
          fontSize: 10, color: 'var(--muted-foreground)',
          background: 'rgba(var(--brand-primary-rgb)/0.08)',
          padding: '1px 6px', borderRadius: 4,
          userSelect: 'none',
        }}>
          للقراءة فقط
        </span>
      </div>

      {licOrgId && (
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 6, textAlign: 'left', direction: 'ltr' }}>
          LICENSE ID: {licOrgId}
        </div>
      )}

      {/* زر تغيير المؤسسة */}
      <button
        type="button"
        onClick={onChangeOrg}
        style={{
          marginTop: 10, background: 'none', border: 'none', padding: 0,
          color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer',
          textDecoration: 'underline', fontFamily: 'inherit', display: 'block',
          width: '100%', textAlign: 'center',
        }}
      >
        تغيير المؤسسة
      </button>
    </div>
  );
}

// ─── NoLicenseView — لا يوجد ترخيص ───────────────────────────────────────────
function NoLicenseView({ onContinueAnyway }: { onContinueAnyway: () => void }) {
  const [, navigate] = useLocation();
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
      padding: '28px 32px', border: '1px solid #FDE68A',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 340, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--foreground)', marginBottom: 8 }}>
        النظام غير مفعّل
      </div>
      <div style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
        لم يتم العثور على ترخيص نشط على هذا الجهاز.
        يرجى استيراد ملف الترخيص أو إدخال كود التفعيل.
      </div>
      <button
        onClick={() => navigate('/cfg/license')}
        style={{
          width: '100%', background: 'var(--primary)', color: 'var(--primary-foreground)',
          border: 'none', borderRadius: 'var(--brand-border-radius)',
          padding: '10px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 10,
        }}
      >
        🔐 انتقل إلى التفعيل
      </button>
      <button
        onClick={onContinueAnyway}
        style={{
          width: '100%', background: 'transparent', color: 'var(--muted-foreground)',
          border: '1px solid var(--border)', borderRadius: 'var(--brand-border-radius)',
          padding: '8px 0', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        المتابعة كوضع التطوير
      </button>
    </div>
  );
}

// ─── LicenseExpiredView — الترخيص منتهي ──────────────────────────────────────
function LicenseExpiredView({ expiry }: { expiry: string | null }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
      padding: '28px 32px', border: '1px solid #FCA5A5',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: 340, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: '#B91C1C', marginBottom: 8 }}>
        انتهت صلاحية الترخيص
      </div>
      {expiry && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 12, fontFamily: "'Courier New', monospace" }}>
          تاريخ الانتهاء: {expiry}
        </div>
      )}
      <div style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.7 }}>
        انتهت صلاحية الترخيص أو تم إيقافه.
        <br />
        يرجى التواصل مع مزود النظام لتجديد الاشتراك.
      </div>
    </div>
  );
}

// ─── ManualLoginForm ──────────────────────────────────────────────────────────
function ManualLoginForm({
  onSuccess,
  utils,
  prefillOrgCode,
  orgName,
  licOrgId,
  onChangeOrg,
  showOrgCard,
}: {
  onSuccess:     (role: string) => void;
  utils:         ReturnType<typeof trpc.useUtils>;
  prefillOrgCode: string | null;
  orgName:       string | null;
  licOrgId:      string | null;
  onChangeOrg:   () => void;
  showOrgCard:   boolean;
}) {
  const [form, setForm]       = useState({ orgCode: prefillOrgCode ?? '', username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

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
          username: form.username,
          password: form.password,
          orgCode:  form.orgCode || undefined,
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

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--background)',
    border: '1px solid var(--border)', borderRadius: 'var(--brand-border-radius)',
    padding: '10px 14px', fontSize: 13, color: 'var(--foreground)', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300 }}>

      {/* كارت المؤسسة (إن كان الكود محفوظاً) */}
      {showOrgCard && form.orgCode ? (
        <OrgCard
          orgName={orgName}
          orgCode={form.orgCode}
          licOrgId={licOrgId}
          onChangeOrg={onChangeOrg}
        />
      ) : (
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 5, textAlign: 'right' }}>
            كود المؤسسة
          </label>
          <input
            style={inp}
            placeholder="أدخل كود المؤسسة"
            value={form.orgCode}
            onChange={e => setForm(f => ({ ...f, orgCode: e.target.value.toUpperCase() }))}
            autoComplete="organization"
          />
        </div>
      )}

      {error && (
        <div style={{
          color: '#B91C1C', fontSize: 12, textAlign: 'center',
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 6, padding: '6px 12px',
        }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 5, textAlign: 'right' }}>
          اسم المستخدم
        </label>
        <input
          style={inp}
          placeholder="أدخل اسم المستخدم"
          required
          value={form.username}
          onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          autoComplete="username"
          autoFocus
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 5, textAlign: 'right' }}>
          كلمة المرور
        </label>
        <input
          type="password"
          style={inp}
          placeholder="أدخل كلمة المرور"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          background: 'var(--primary)', color: 'var(--primary-foreground)',
          border: 'none', borderRadius: 'var(--brand-border-radius)', padding: '11px 0',
          fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
          marginTop: 4,
        }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner size={16} />
            جارٍ الدخول...
          </span>
        ) : 'تسجيل الدخول'}
      </button>
    </form>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [phase, setPhase]         = useState<'loading' | 'dbError' | 'login' | 'wizard'>('loading');
  const [transitioning, setTransitioning] = useState(false);
  const [transType, setTransType] = useState('none');
  const [showChangeOrg, setShowChangeOrg] = useState(false);

  const utils        = trpc.useUtils();
  const [, navigate] = useLocation();
  const { settings } = useBranding();

  const firstRunQ    = trpc.setup.isFirstRun.useQuery(undefined, { retry: 3, retryDelay: 2000, staleTime: 0 });
  const licCtxQ      = trpc.license.getLoginContext.useQuery(undefined, { staleTime: 30_000, retry: 1 });
  const clearOrgMut  = trpc.license.clearSavedOrgCode.useMutation({
    onSuccess: () => {
      licCtxQ.refetch();
      setShowChangeOrg(false);
    },
  });

  const loginBg = (() => {
    const s = settings;
    if (s.login_background_type === 'solid') return s.login_background_value;
    if (s.login_background_type === 'image') return `url(${s.login_background_value}) center/cover no-repeat`;
    return s.login_background_value;
  })();

  const doNavigate = useCallback((targetPath: string) => navigate(targetPath), [navigate]);

  const tryAutoLogin = async () => {
    try {
      const res = await fetch('/api/auth/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        await utils.auth.me.invalidate();
        doNavigate(getStartupPath(settings.startup_page));
        return true;
      }
    } catch { /* show manual login */ }
    return false;
  };

  useEffect(() => {
    if (firstRunQ.isLoading) { setPhase('loading'); return; }
    if (firstRunQ.isError)   { setPhase('dbError'); return; }
    const { firstRun, dbError } = firstRunQ.data ?? {};
    if (dbError)  { setPhase('dbError'); return; }
    if (firstRun) { setPhase('wizard'); return; }
    tryAutoLogin().then(success => { if (!success) setPhase('login'); });
  }, [firstRunQ.isLoading, firstRunQ.isError, firstRunQ.data]);

  const handleLoginSuccess = useCallback(async (_role: string) => {
    const transition = settings.opening_transition ?? 'none';
    const targetPath = getStartupPath(settings.startup_page);
    if (transition === 'none') { doNavigate(targetPath); return; }
    try {
      setTransType(transition);
      setTransitioning(true);
      const dur = TRANS_DURATION[transition] ?? 600;
      await new Promise(r => setTimeout(r, dur + 80));
    } catch { /* fallback */ }
    doNavigate(targetPath);
  }, [settings.opening_transition, settings.startup_page, doNavigate]);

  const handleChangeOrg = useCallback(() => {
    clearOrgMut.mutate();
    setShowChangeOrg(true);
  }, [clearOrgMut]);

  // ── First Run Wizard ──
  if (phase === 'wizard') {
    return (
      <FirstRunWizard onComplete={async () => {
        await utils.auth.me.invalidate();
        doNavigate('/');
      }} />
    );
  }

  // ── خلفية الصفحة ──
  const bg = (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: loginBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cairo', Tahoma, sans-serif",
        fontSize: 'var(--brand-font-size)',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
  void bg;

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: loginBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Cairo', Tahoma, sans-serif",
        fontSize: 'var(--brand-font-size)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {transitioning && (
        <TransitionOverlay type={transType} loginBg={loginBg} onDone={() => setTransitioning(false)} />
      )}

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Logo + Title */}
        <img
          src="/logo.png"
          alt="OneSoft ERP"
          style={{
            width: 88, height: 88, marginBottom: 20,
            borderRadius: 'var(--brand-border-radius)',
            boxShadow: '0 8px 28px rgba(var(--brand-primary-rgb)/0.35)',
            objectFit: 'cover',
          }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px' }}>
          One<span style={{ color: 'var(--primary)' }}>Soft</span> ERP
        </h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '0 0 24px' }}>
          نظام إدارة الأعمال المتكامل
        </p>

        {/* ── حالة التحميل ── */}
        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Spinner size={36} />
            <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>جارٍ الاتصال بالخادم...</span>
          </div>
        )}

        {/* ── خطأ في قاعدة البيانات ── */}
        {phase === 'dbError' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
            padding: '24px 28px', border: '1px solid #FCA5A5',
            boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb)/0.1)', maxWidth: 340,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <div style={{ color: '#B91C1C', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              تعذّر الاتصال بقاعدة البيانات
            </div>
            <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
              الخادم يعمل لكن لا يستطيع الاتصال بـ PostgreSQL.
              تأكد من أن الخدمة تعمل وأن ملف config.json صحيح.
            </div>
            <button
              onClick={() => { setPhase('loading'); firstRunQ.refetch(); }}
              style={{
                background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none',
                borderRadius: 'var(--brand-border-radius)', padding: '9px 20px', fontWeight: 700,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, width: '100%',
              }}
            >
              🔄 إعادة المحاولة
            </button>
            <button
              onClick={() => setPhase('login')}
              style={{
                background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)',
                borderRadius: 'var(--brand-border-radius)', padding: '7px 20px', fontWeight: 600,
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
              }}
            >
              تسجيل الدخول يدوياً
            </button>
          </div>
        )}

        {/* ── شاشة الدخول الرئيسية ── */}
        {phase === 'login' && (
          <div>
            {/* جارٍ تحميل سياق الترخيص */}
            {licCtxQ.isLoading && (
              <div style={{
                background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
                padding: '28px 32px', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <Spinner size={28} />
                <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>جارٍ التحقق من الترخيص...</span>
              </div>
            )}

            {/* ترخيص منتهي الصلاحية */}
            {!licCtxQ.isLoading && licCtxQ.data?.isExpired && (
              <LicenseExpiredView expiry={licCtxQ.data.licExpiry} />
            )}

            {/* لا يوجد ترخيص + لا يوجد كود محفوظ → يطلب التفعيل أولاً */}
            {!licCtxQ.isLoading && !licCtxQ.data?.isExpired && !licCtxQ.data?.hasLicense && !licCtxQ.data?.savedOrgCode && !showChangeOrg && (
              <NoLicenseView onContinueAnyway={() => {
                setShowChangeOrg(true);
              }} />
            )}

            {/* نموذج تسجيل الدخول:
                - ترخيص موجود، أو
                - كود مؤسسة محفوظ (دخل سابقاً)، أو
                - المستخدم اختار "المتابعة" */}
            {!licCtxQ.isLoading && !licCtxQ.data?.isExpired && (licCtxQ.data?.hasLicense || licCtxQ.data?.savedOrgCode || showChangeOrg) && (
              <div style={{
                background: 'var(--card)', borderRadius: 'var(--brand-border-radius)',
                padding: '24px 28px', border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(var(--brand-primary-rgb)/0.1)',
              }}>
                <ManualLoginForm
                  onSuccess={handleLoginSuccess}
                  utils={utils}
                  prefillOrgCode={licCtxQ.data?.savedOrgCode ?? null}
                  orgName={licCtxQ.data?.savedOrgName ?? null}
                  licOrgId={licCtxQ.data?.licOrgId ?? null}
                  showOrgCard={!!licCtxQ.data?.savedOrgCode && !showChangeOrg}
                  onChangeOrg={handleChangeOrg}
                />
              </div>
            )}

            {/* رابط مركز التراخيص (لجميع المستخدمين) */}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a
                href="/license-center"
                style={{ color: 'var(--muted-foreground)', fontSize: 11, textDecoration: 'none' }}
                onClick={e => { e.preventDefault(); navigate('/license-center'); }}
              >
                🔑 مركز التراخيص
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
