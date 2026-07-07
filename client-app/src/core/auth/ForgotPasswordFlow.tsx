import { useState } from 'react';
import { trpc } from '@/shared/lib/trpc';

type Step = 'choose' | 'request' | 'reset' | 'support' | 'done';

interface ForgotPasswordFlowProps {
  onBack: () => void;
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--background)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 13px', fontSize: 13,
  color: 'var(--foreground)', outline: 'none',
  fontFamily: "'Cairo', Tahoma, sans-serif",
  direction: 'ltr',
};

const btn = (primary = true): React.CSSProperties => ({
  width: '100%', border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? 'var(--primary)' : 'transparent',
  color: primary ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
  borderRadius: 8, padding: '10px 0', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', fontFamily: "'Cairo', Tahoma, sans-serif",
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
});

function Spinner({ size = 14 }: { size?: number }) {
  return <div style={{
    width: size, height: size,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  }} />;
}

export default function ForgotPasswordFlow({ onBack }: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<Step>('choose');
  const [channel, setChannel] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const requestReset = trpc.recovery.requestPasswordReset.useMutation({
    onSuccess: (data) => {
      setError('');
      if (data.resetToken) {
        setResetToken(data.resetToken);
        if (data.devOtp) setDevOtp(data.devOtp);
        setStep('reset');
      } else {
        // No resetToken = user/channel not configured (generic message shown)
        setStep('reset');
      }
    },
    onError: (e) => setError(e.message),
  });

  const resetPassword = trpc.recovery.resetPassword.useMutation({
    onSuccess: () => { setError(''); setStep('done'); },
    onError: (e) => setError(e.message),
  });

  const handleRequest = () => {
    if (!identifier.trim()) { setError('يرجى إدخال اسم المستخدم أو رقم الجوال أو البريد الإلكتروني'); return; }
    setError('');
    requestReset.mutate({ identifier: identifier.trim(), channel });
  };

  const handleReset = () => {
    if (otp.length < 4) { setError('يرجى إدخال كود التحقق'); return; }
    if (newPassword.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPassword !== confirmPassword) { setError('كلمتا المرور غير متطابقتين'); return; }
    if (!resetToken) { setError('حدث خطأ. يرجى طلب كود جديد.'); return; }
    setError('');
    resetPassword.mutate({ resetToken, otp, newPassword });
  };

  const card: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 16, padding: '24px 28px',
    border: '1px solid var(--border)', width: 340,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    fontFamily: "'Cairo', Tahoma, sans-serif",
    display: 'flex', flexDirection: 'column', gap: 16,
  };

  const title = (t: string) => (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>{t}</h3>
    </div>
  );

  const err = error && (
    <div style={{
      color: '#B91C1C', fontSize: 12, background: '#FEF2F2',
      border: '1px solid #FCA5A5', borderRadius: 6,
      padding: '7px 12px', textAlign: 'center',
    }}>{error}</div>
  );

  // ── اختيار الطريقة ──────────────────────────────────────────────────────────
  if (step === 'choose') return (
    <div dir="rtl" style={card}>
      {title('استعادة كلمة المرور')}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.7 }}>
        اختر طريقة استعادة كلمة المرور
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* استعادة بالجوال */}
        <button
          onClick={() => { setChannel('phone'); setStep('request'); }}
          style={{
            border: channel === 'phone' ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
            cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>📱</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>عبر رقم الجوال</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>يُرسَل كود OTP لرقم جوالك المسجل</div>
          </div>
        </button>

        {/* استعادة بالبريد */}
        <button
          onClick={() => { setChannel('email'); setStep('request'); }}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
            cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>📧</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>عبر البريد الإلكتروني</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>يُرسَل كود OTP لبريدك الإلكتروني المسجل</div>
          </div>
        </button>

        {/* دعم فني */}
        <button
          onClick={() => setStep('support')}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--background)', borderRadius: 10, padding: '12px 16px',
            cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>🛟</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>التواصل مع الدعم الفني</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>إذا لم تتوفر وسيلة استعادة مباشرة</div>
          </div>
        </button>
      </div>

      <button onClick={onBack} style={btn(false)}>العودة لتسجيل الدخول</button>
    </div>
  );

  // ── طلب OTP ─────────────────────────────────────────────────────────────────
  if (step === 'request') return (
    <div dir="rtl" style={card}>
      {title(channel === 'phone' ? '📱 استعادة عبر الجوال' : '📧 استعادة عبر البريد')}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.7 }}>
        أدخل اسم المستخدم أو {channel === 'phone' ? 'رقم الجوال' : 'البريد الإلكتروني'} المسجل
      </p>
      {err}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            {channel === 'phone' ? 'اسم المستخدم أو رقم الجوال' : 'اسم المستخدم أو البريد الإلكتروني'}
          </label>
          <input
            style={inp}
            placeholder={channel === 'phone' ? 'username أو +9665...' : 'username أو name@co.com'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRequest()}
          />
        </div>
        <button onClick={handleRequest} disabled={requestReset.isPending} style={btn()}>
          {requestReset.isPending ? <><Spinner />جاري الإرسال...</> : 'إرسال كود الاستعادة'}
        </button>
        <button onClick={() => setStep('choose')} style={btn(false)}>رجوع</button>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
        إذا كانت البيانات صحيحة، ستصلك رسالة بكود الاستعادة.
        <br />لن يتم الإفصاح عن وجود الحساب من عدمه.
      </p>
    </div>
  );

  // ── إدخال OTP وكلمة المرور الجديدة ─────────────────────────────────────────
  if (step === 'reset') return (
    <div dir="rtl" style={card}>
      {title('🔑 إدخال الكود وكلمة المرور الجديدة')}
      {devOtp && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#92400E', marginBottom: 4 }}>كود التجربة (بيئة التطوير فقط)</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#92400E', letterSpacing: 4 }}>{devOtp}</div>
        </div>
      )}
      {err}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            كود التحقق (6 أرقام)
          </label>
          <input
            style={{ ...inp, textAlign: 'center', fontSize: 22, letterSpacing: 6, fontWeight: 800 }}
            placeholder="000000"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            كلمة المرور الجديدة
          </label>
          <input
            type="password"
            style={inp}
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
            type="password"
            style={inp}
            placeholder="أعد إدخال كلمة المرور"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button onClick={handleReset} disabled={resetPassword.isPending} style={btn()}>
          {resetPassword.isPending ? <><Spinner />جاري التغيير...</> : 'تغيير كلمة المرور'}
        </button>
        <button onClick={() => { setStep('request'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setError(''); }} style={btn(false)}>
          طلب كود جديد
        </button>
      </div>
    </div>
  );

  // ── دعم فني ─────────────────────────────────────────────────────────────────
  if (step === 'support') {
    const info = [
      { label: 'Device ID', value: navigator.userAgent.slice(0, 40) + '...' },
    ];
    const copyText = info.map((i) => `${i.label}: ${i.value}`).join('\n');
    return (
      <div dir="rtl" style={card}>
        {title('🛟 الدعم الفني')}
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.7 }}>
          إذا لم تكن لديك وسيلة استعادة مفعّلة، يرجى التواصل مع مسؤول النظام وإرسال المعلومات التالية:
        </p>
        <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', lineHeight: 1.8 }}>
          {info.map((i) => (
            <div key={i.label}><strong>{i.label}:</strong> {i.value}</div>
          ))}
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(copyText).catch(() => {}); }}
          style={{ ...btn(false), border: '1px solid var(--border)' }}
        >
          📋 نسخ المعلومات
        </button>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
          لا يوجد مسؤول عام للوصول. لا يوجد كلمة مرور رئيسية.
          <br />يُرجى التواصل مع مزود النظام للحصول على كود الدعم.
        </div>
        <button onClick={() => setStep('choose')} style={btn(false)}>رجوع</button>
      </div>
    );
  }

  // ── نجاح ────────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div dir="rtl" style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--foreground)' }}>
          تم تغيير كلمة المرور بنجاح
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
          يمكنك الآن تسجيل الدخول بكلمة مرورك الجديدة.
        </p>
        <button onClick={onBack} style={btn()}>تسجيل الدخول</button>
      </div>
    </div>
  );

  return null;
}
