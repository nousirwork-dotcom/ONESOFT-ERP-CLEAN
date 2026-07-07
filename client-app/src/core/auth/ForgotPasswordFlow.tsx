import { useEffect, useState } from 'react';
import { trpc } from '@/shared/lib/trpc';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'loading' | 'choose' | 'request' | 'reset' | 'support' | 'done';
type Channel = 'phone' | 'email';

interface ForgotPasswordFlowProps {
  onBack: () => void;
  /** كود المؤسسة — يُمرَّر من LoginPage لعرضه في Support Recovery */
  orgCode?: string;
  orgName?: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ff = "'Cairo', Tahoma, sans-serif";

const card: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
  border: '1px solid var(--border)', width: 340,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontFamily: ff, display: 'flex', flexDirection: 'column', gap: 16,
};

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 13px', fontSize: 13,
  color: 'var(--foreground)', outline: 'none', fontFamily: ff, direction: 'ltr',
};

const btn = (primary = true, disabled = false): React.CSSProperties => ({
  width: '100%', border: primary ? 'none' : '1px solid var(--border)',
  background: primary
    ? (disabled ? 'var(--muted)' : 'var(--primary)')
    : 'transparent',
  color: primary
    ? (disabled ? 'var(--muted-foreground)' : 'var(--primary-foreground)')
    : 'var(--muted-foreground)',
  borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: ff,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  opacity: disabled ? 0.7 : 1,
});

const optionBtn = (active = false, disabled = false): React.CSSProperties => ({
  border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
  background: disabled ? 'var(--muted)' : 'var(--background)',
  borderRadius: 10, padding: '12px 16px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  textAlign: 'right' as const, fontFamily: ff,
  display: 'flex', alignItems: 'center', gap: 10,
  opacity: disabled ? 0.55 : 1,
});

// ─── Sub-components ───────────────────────────────────────────────────────────
function Spinner({ size = 14, dark = false }: { size?: number; dark?: boolean }) {
  return <div style={{
    width: size, height: size, flexShrink: 0,
    border: `2px solid ${dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)'}`,
    borderTopColor: dark ? 'var(--foreground)' : 'white',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  }} />;
}

function Title({ t, sub }: { t: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{t}</h3>
      {sub && <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{
      color: '#B91C1C', fontSize: 12, background: '#FEF2F2',
      border: '1px solid #FCA5A5', borderRadius: 6,
      padding: '7px 12px', textAlign: 'center',
    }}>{msg}</div>
  );
}

function DevOtpBanner({ otp }: { otp: string }) {
  return (
    <div style={{
      background: '#FEF3C7', border: '1px solid #F59E0B',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: '#92400E', marginBottom: 4, fontWeight: 600 }}>
        كود التجربة — بيئة التطوير فقط
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 800, color: '#92400E', letterSpacing: 5 }}>
        {otp}
      </div>
    </div>
  );
}

// ─── Request Code generator (client-side, for support) ────────────────────────
function generateRequestCode(orgCode?: string): string {
  // Minute-precision timestamp + org + entropy
  const ts   = Math.floor(Date.now() / 60000).toString(36).toUpperCase();
  const org  = (orgCode ?? 'XX').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
  const hw   = (navigator.hardwareConcurrency || 4).toString(16).toUpperCase();
  const raw  = `${org}-${ts}-${hw}`;
  // Simple checksum
  const sum  = raw.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 97;
  return `${raw}-${sum.toString().padStart(2, '0')}`;
}

// Stable device fingerprint (non-identifying, for support reference only)
function getDeviceId(): string {
  const ua  = navigator.userAgent;
  const scr = `${screen.width}x${screen.height}`;
  const lang = navigator.language ?? 'ar';
  const raw  = `${ua}|${scr}|${lang}|${navigator.hardwareConcurrency}`;
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').toUpperCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ForgotPasswordFlow({ onBack, orgCode, orgName }: ForgotPasswordFlowProps) {
  const [step, setStep]               = useState<Step>('loading');
  const [channel, setChannel]         = useState<Channel>('email');
  const [identifier, setIdentifier]   = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [devOtp, setDevOtp]           = useState('');
  const [otp, setOtp]                 = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [error, setError]             = useState('');

  // System channel availability
  const channelsQ = trpc.recovery.getSystemChannels.useQuery(undefined, {
    staleTime: 60_000, retry: 1,
  });

  useEffect(() => {
    if (!channelsQ.isLoading) setStep('choose');
  }, [channelsQ.isLoading]);

  const emailEnabled = channelsQ.data?.emailEnabled ?? true;
  const smsEnabled   = channelsQ.data?.smsEnabled   ?? false;

  const requestReset = trpc.recovery.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setError('');
      setResetToken(data.resetToken ?? '');
      if (data.devOtp) setDevOtp(data.devOtp);
      setStep('reset');
    },
    onError: (e) => setError(e.message),
  });

  const resetPassword = trpc.recovery.resetPassword.useMutation({
    onSuccess: () => { setError(''); setStep('done'); },
    onError:   (e) => setError(e.message),
  });

  const handleRequest = () => {
    if (!identifier.trim()) { setError('يرجى إدخال اسم المستخدم أو بريدك الإلكتروني'); return; }
    setError('');
    requestReset.mutate({ identifier: identifier.trim(), channel });
  };

  const handleReset = () => {
    if (otp.length < 4)          { setError('يرجى إدخال كود التحقق');                    return; }
    if (newPassword.length < 6)  { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPassword !== confirmPwd) { setError('كلمتا المرور غير متطابقتين');             return; }
    if (!resetToken)             { setError('حدث خطأ. يرجى طلب كود جديد.');               return; }
    setError('');
    resetPassword.mutate({ resetToken, otp, newPassword });
  };

  const goBack = () => {
    setStep('choose');
    setOtp(''); setNewPassword(''); setConfirmPwd('');
    setDevOtp(''); setResetToken(''); setError('');
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div dir="rtl" style={{ ...card, alignItems: 'center', gap: 12 }}>
      <Spinner size={28} dark />
      <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>جاري التحقق من خيارات الاستعادة...</span>
    </div>
  );

  // ── اختيار الطريقة ──────────────────────────────────────────────────────────
  if (step === 'choose') return (
    <div dir="rtl" style={card}>
      <Title t="استعادة كلمة المرور" sub="اختر طريقة الاستعادة المناسبة" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* 1. Email OTP — دائماً متاح */}
        <button
          onClick={() => { setChannel('email'); setStep('request'); }}
          style={optionBtn(channel === 'email')}
        >
          <span style={{ fontSize: 22 }}>📧</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>
              عبر البريد الإلكتروني
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              يُرسَل كود OTP لبريدك المسجل • الأسرع والأكثر موثوقية
            </div>
          </div>
          <span style={{
            fontSize: 10, background: '#DCFCE7', color: '#166534',
            border: '1px solid #BBF7D0', borderRadius: 4, padding: '1px 6px', fontWeight: 700,
          }}>مُوصى به</span>
        </button>

        {/* 2. SMS OTP — اختياري، يظهر فقط إذا مفعّل */}
        {smsEnabled ? (
          <button
            onClick={() => { setChannel('phone'); setStep('request'); }}
            style={optionBtn(channel === 'phone')}
          >
            <span style={{ fontSize: 22 }}>📱</span>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>عبر رقم الجوال (SMS)</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
                يُرسَل كود OTP لرقم جوالك المسجل عبر الرسائل
              </div>
            </div>
          </button>
        ) : (
          <div style={{ ...optionBtn(false, true), cursor: 'default' }}>
            <span style={{ fontSize: 22 }}>📱</span>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted-foreground)' }}>عبر رقم الجوال (SMS)</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
                SMS غير مفعّل في هذا النظام — تواصل مع مسؤول النظام
              </div>
            </div>
            <span style={{
              fontSize: 10, background: '#FEF3C7', color: '#92400E',
              border: '1px solid #FDE68A', borderRadius: 4, padding: '1px 6px', fontWeight: 700,
            }}>غير متاح</span>
          </div>
        )}

        {/* 3. Support Recovery — دائماً متاح كاحتياطي */}
        <button
          onClick={() => setStep('support')}
          style={optionBtn()}
        >
          <span style={{ fontSize: 22 }}>🛟</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>
              دعم فني — Support Recovery
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              عند عدم توفر بريد أو جوال • Offline • يتطلب تواصلاً مع الدعم
            </div>
          </div>
        </button>

        {/* 4. Backup Codes — مستقبلاً */}
        <div style={{ ...optionBtn(false, true), cursor: 'default' }}>
          <span style={{ fontSize: 22 }}>🔑</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted-foreground)' }}>
              أكواد احتياطية — Backup Codes
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              لا تحتاج إنترنت أو SMS • قيد التطوير
            </div>
          </div>
          <span style={{
            fontSize: 10, background: 'var(--muted)', color: 'var(--muted-foreground)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 700,
          }}>قريباً</span>
        </div>

        {/* 5. Authenticator App — مستقبلاً */}
        <div style={{ ...optionBtn(false, true), cursor: 'default' }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted-foreground)' }}>
              تطبيق المصادقة — Authenticator App
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              Google / Microsoft Authenticator • مجاني تماماً • قيد التطوير
            </div>
          </div>
          <span style={{
            fontSize: 10, background: 'var(--muted)', color: 'var(--muted-foreground)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px', fontWeight: 700,
          }}>قريباً</span>
        </div>
      </div>

      <button onClick={onBack} style={btn(false)}>العودة لتسجيل الدخول</button>
    </div>
  );

  // ── طلب OTP ─────────────────────────────────────────────────────────────────
  if (step === 'request') return (
    <div dir="rtl" style={card}>
      <Title
        t={channel === 'email' ? '📧 استعادة عبر البريد الإلكتروني' : '📱 استعادة عبر الجوال (SMS)'}
        sub={`أدخل ${channel === 'email' ? 'اسم المستخدم أو البريد الإلكتروني' : 'اسم المستخدم أو رقم الجوال'} المسجل`}
      />

      {error && <ErrBox msg={error} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            {channel === 'email' ? 'اسم المستخدم أو البريد الإلكتروني' : 'اسم المستخدم أو رقم الجوال'}
          </label>
          <input
            style={inp}
            autoFocus
            placeholder={channel === 'email' ? 'username أو name@company.com' : 'username أو +9665xxxxxxxx'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !requestReset.isPending && handleRequest()}
          />
        </div>

        <button onClick={handleRequest} disabled={requestReset.isPending} style={btn(true, requestReset.isPending)}>
          {requestReset.isPending ? <><Spinner />جاري الإرسال...</> : 'إرسال كود الاستعادة'}
        </button>
        <button onClick={goBack} style={btn(false)}>رجوع</button>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.7 }}>
        إذا كانت البيانات صحيحة، ستصلك رسالة بكود الاستعادة.
        <br />
        <strong>لن يتم الإفصاح عن وجود الحساب من عدمه.</strong>
      </p>
    </div>
  );

  // ── إدخال OTP وكلمة المرور الجديدة ─────────────────────────────────────────
  if (step === 'reset') return (
    <div dir="rtl" style={card}>
      <Title
        t="🔑 إدخال الكود وكلمة المرور الجديدة"
        sub={channel === 'email'
          ? 'أدخل الكود الذي وصل إلى بريدك الإلكتروني'
          : 'أدخل الكود الذي وصل إلى جوالك'}
      />

      {devOtp && <DevOtpBanner otp={devOtp} />}
      {error && <ErrBox msg={error} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            كود التحقق (6 أرقام)
          </label>
          <input
            style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: 7, fontWeight: 800 }}
            placeholder="000000"
            maxLength={6}
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            كلمة المرور الجديدة
          </label>
          <input
            type="password" style={inp}
            placeholder="6 أحرف على الأقل"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            تأكيد كلمة المرور
          </label>
          <input
            type="password" style={inp}
            placeholder="أعد إدخال كلمة المرور"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !resetPassword.isPending && handleReset()}
          />
        </div>

        <button onClick={handleReset} disabled={resetPassword.isPending} style={btn(true, resetPassword.isPending)}>
          {resetPassword.isPending ? <><Spinner />جاري التغيير...</> : 'تغيير كلمة المرور'}
        </button>

        <button onClick={goBack} style={btn(false)}>
          طلب كود جديد
        </button>
      </div>
    </div>
  );

  // ── Support Recovery ─────────────────────────────────────────────────────────
  if (step === 'support') {
    const deviceId    = getDeviceId();
    const requestCode = generateRequestCode(orgCode);
    const now         = new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });

    const info = [
      { label: 'كود المؤسسة',   value: orgCode   || '—' },
      { label: 'اسم المؤسسة',   value: orgName   || '—' },
      { label: 'Device ID',      value: deviceId             },
      { label: 'Request Code',   value: requestCode          },
      { label: 'التوقيت',        value: now                  },
    ];

    const copyText = [
      '=== OneSoft ERP — Support Recovery Request ===',
      ...info.map((i) => `${i.label}: ${i.value}`),
      '==============================================',
    ].join('\n');

    return (
      <div dir="rtl" style={card}>
        <Title
          t="🛟 Support Recovery"
          sub="أرسل هذه المعلومات لمسؤول النظام أو فريق الدعم الفني"
        />

        {/* بطاقة المعلومات */}
        <div style={{
          background: 'var(--muted)', borderRadius: 10,
          padding: '12px 14px', fontSize: 12, lineHeight: 2,
        }}>
          {info.map((i) => (
            <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: 'var(--muted-foreground)', fontSize: 11, whiteSpace: 'nowrap' }}>{i.label}</span>
              <span style={{
                fontFamily: i.label.includes('ID') || i.label.includes('Code') ? 'monospace' : 'inherit',
                fontWeight: i.label.includes('Code') ? 800 : 600,
                color: i.label === 'Request Code' ? 'var(--primary)' : 'var(--foreground)',
                fontSize: i.label.includes('ID') || i.label.includes('Code') ? 13 : 12,
                wordBreak: 'break-all', textAlign: 'left',
              }}>{i.value}</span>
            </div>
          ))}
        </div>

        {/* زر نسخ */}
        <button
          onClick={() => navigator.clipboard.writeText(copyText).catch(() => {})}
          style={{ ...btn(false), border: '1px solid var(--border)', gap: 8 }}
        >
          📋 نسخ جميع المعلومات
        </button>

        {/* إرشادات */}
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, padding: '10px 12px', fontSize: 11,
          color: '#1E40AF', lineHeight: 1.8,
        }}>
          <strong>كيف يعمل Support Recovery؟</strong>
          <ol style={{ margin: '6px 0 0', paddingRight: 16, paddingLeft: 0 }}>
            <li>أرسل <strong>Request Code</strong> و <strong>Device ID</strong> لمسؤول النظام.</li>
            <li>يصدر المسؤول كود Support Reset من License Center.</li>
            <li>أدخل الكود في النظام لتغيير كلمة مرورك.</li>
          </ol>
        </div>

        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
          لا يوجد كلمة مرور رئيسية (Master Password).
          <br />لا يوجد باب خلفي (Backdoor) بأي شكل.
        </div>

        <button onClick={goBack} style={btn(false)}>رجوع</button>
      </div>
    );
  }

  // ── نجاح ────────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div dir="rtl" style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
          تم تغيير كلمة المرور بنجاح
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
          يمكنك الآن تسجيل الدخول بكلمة مرورك الجديدة.
        </p>
        <button onClick={onBack} style={btn()}>تسجيل الدخول الآن</button>
      </div>
    </div>
  );

  return null;
}
