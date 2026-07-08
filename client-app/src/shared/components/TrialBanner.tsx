import { useState } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { toast } from 'sonner';

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', flexShrink: 0,
    }} />
  );
}

function SetAdminPasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    password: '', confirmPassword: '',
  });
  const [error, setError] = useState('');

  const setPass = trpc.users.setAdminPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.adminPasswordStatus.invalidate();
      await utils.auth.me.invalidate();
      toast.success('✅ تم تعيين كلمة المرور بنجاح');
      onSuccess();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--background)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13,
    color: 'var(--foreground)', outline: 'none',
    fontFamily: "'Cairo', Tahoma, sans-serif",
  };

  const handleSubmit = () => {
    if (!form.password) { setError('كلمة المرور مطلوبة'); return; }
    if (form.password !== form.confirmPassword) { setError('كلمتا المرور غير متطابقتين'); return; }
    setError('');
    setPass.mutate({
      name:            form.name  || undefined,
      phone:           form.phone || undefined,
      email:           form.email || undefined,
      password:        form.password,
      confirmPassword: form.confirmPassword,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div dir="rtl" style={{
        background: 'var(--card)', borderRadius: 16,
        padding: '28px 32px', width: 400, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)',
        fontFamily: "'Cairo', Tahoma, sans-serif",
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🔐</div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--foreground)' }}>
            تعيين كلمة مرور مدير النظام
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            يُحمي النظام من الوصول غير المصرح به.<br />
            بعد الحفظ يُطلب اسم المستخدم وكلمة المرور عند كل دخول.
          </p>
        </div>

        {/* اسم المستخدم readonly */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            اسم المستخدم
          </label>
          <input
            style={{ ...inp, background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'not-allowed' }}
            value="admin"
            readOnly
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              الاسم الكامل <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>(اختياري)</span>
            </label>
            <input
              style={inp} placeholder="مثال: محمد أحمد"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
              رقم الجوال <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>(اختياري)</span>
            </label>
            <input
              style={{ ...inp, direction: 'ltr' }} placeholder="+9665xxxxxxxx"
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            البريد الإلكتروني <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>(اختياري)</span>
          </label>
          <input
            style={{ ...inp, direction: 'ltr' }} placeholder="admin@company.com"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            كلمة المرور <span style={{ color: '#ef4444', fontSize: 10 }}>*</span>
          </label>
          <input
            type="password" style={inp} placeholder="اختر كلمة مرور قوية"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            autoFocus
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
            تأكيد كلمة المرور <span style={{ color: '#ef4444', fontSize: 10 }}>*</span>
          </label>
          <input
            type="password" style={inp} placeholder="أعد الكتابة"
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && !setPass.isPending && handleSubmit()}
          />
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5',
            borderRadius: 6, padding: '7px 12px',
            color: '#B91C1C', fontSize: 12, textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={setPass.isPending}
            style={{
              flex: 1, background: 'var(--primary)', color: 'var(--primary-foreground)',
              border: 'none', borderRadius: 8, padding: '10px 0',
              fontWeight: 700, fontSize: 13, cursor: setPass.isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: setPass.isPending ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {setPass.isPending ? <><Spinner />جارٍ الحفظ...</> : '🔐 حفظ كلمة المرور'}
          </button>
          <button
            onClick={onClose}
            disabled={setPass.isPending}
            style={{
              flex: 1, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 0',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', color: 'var(--muted-foreground)',
            }}
          >
            لاحقاً
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function TrialBanner() {
  const [showModal, setShowModal] = useState(false);
  const statusQ = trpc.auth.adminPasswordStatus.useQuery(undefined, {
    staleTime: 30_000,
    retry: 1,
  });

  if (statusQ.isLoading || !statusQ.data) return null;
  if (statusQ.data.passwordStatus !== 'not_set') return null;

  return (
    <>
      <div dir="rtl" style={{
        background: 'linear-gradient(90deg, #92400E 0%, #B45309 100%)',
        color: '#FEF3C7',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 12, fontFamily: "'Cairo', Tahoma, sans-serif",
        zIndex: 50, flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>⚠</span>
        <span style={{ flex: 1, lineHeight: 1.5 }}>
          <strong>نسخة تجريبية — النظام غير محمي.</strong>{' '}
          لم يتم تعيين كلمة مرور مدير النظام بعد. يرجى تعيين كلمة مرور لحماية بياناتك.
        </span>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: '#FEF3C7', color: '#92400E',
            border: 'none', borderRadius: 6, padding: '5px 14px',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          🔐 تعيين كلمة مرور المدير
        </button>
      </div>

      {showModal && (
        <SetAdminPasswordModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </>
  );
}
