import { useState } from 'react';
import { useInstallerStore } from '../store/installer.store';

export default function Step07FirstUser() {
  const { firstUser, setFirstUser } = useInstallerStore();
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const pwdMatch = firstUser.password === confirmPwd;
  const isValid = firstUser.fullName.trim().length >= 2
    && firstUser.username.trim().length >= 3
    && firstUser.password.length >= 6
    && pwdMatch;

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13,
    background: '#F9FAFB', color: '#1E344F', fontFamily: 'inherit', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          👤 المستخدم الإداري
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          هذا الحساب سيكون مدير النظام بكامل الصلاحيات
        </p>
      </div>

      <div style={{
        background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
        padding: '10px 14px', fontSize: 12, color: '#92400E',
      }}>
        ⚠️ <strong>مهم:</strong> احفظ بيانات الدخول في مكان آمن — لا يمكن استرجاع كلمة المرور لاحقاً
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={lbl}>الاسم الكامل <span style={{ color: '#EF4444' }}>*</span></label>
          <input style={inp} value={firstUser.fullName}
            onChange={e => setFirstUser({ fullName: e.target.value })}
            placeholder="أحمد محمد العتيبي" />
        </div>

        <div>
          <label style={lbl}>اسم الدخول <span style={{ color: '#EF4444' }}>*</span></label>
          <input style={inp} value={firstUser.username}
            onChange={e => setFirstUser({ username: e.target.value.toLowerCase().replace(/\s/g, '') })}
            placeholder="admin" />
        </div>

        <div>
          <label style={lbl}>كلمة المرور <span style={{ color: '#EF4444' }}>*</span> (6 أحرف على الأقل)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={inp}
              type={showPwd ? 'text' : 'password'}
              value={firstUser.password}
              onChange={e => setFirstUser({ password: e.target.value })}
              placeholder="••••••••••"
            />
            <button onClick={() => setShowPwd(p => !p)} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 14,
            }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label style={lbl}>تأكيد كلمة المرور <span style={{ color: '#EF4444' }}>*</span></label>
          <input
            style={{ ...inp, borderColor: confirmPwd && !pwdMatch ? '#EF4444' : '#D1D5DB' }}
            type={showPwd ? 'text' : 'password'}
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="••••••••••"
          />
          {confirmPwd && !pwdMatch && (
            <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>❌ كلمتا المرور لا تتطابقان</div>
          )}
        </div>

        <div style={{
          background: '#F0FDF4', border: '1px solid #86EFAC',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803D',
        }}>
          🔒 الصلاحية: <strong>Super Admin</strong> — صلاحية كاملة على النظام
        </div>
      </div>

    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #406B93, #2d5070)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
