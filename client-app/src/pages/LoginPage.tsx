import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const [form, setForm] = useState({ orgCode: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'خطأ في تسجيل الدخول');
      } else {
        await utils.auth.me.invalidate();
        const role = data.user?.role;
        navigate(role === 'superadmin' ? '/superadmin' : '/');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #E8E0D4 0%, #D4CCC0 40%, #C8C0B4 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Cairo', Tahoma, sans-serif",
      }}
    >
      {/* زخارف خلفية دافئة */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 340, height: 340,
          background: "radial-gradient(circle, rgba(64,107,147,0.12) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: -100, left: -100,
          width: 400, height: 400,
          background: "radial-gradient(circle, rgba(64,107,147,0.08) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "10%",
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(221,212,196,0.4) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
      </div>

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>

        {/* الشعار */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 64, height: 64,
            background: "linear-gradient(135deg, #406B93 0%, #2d5070 100%)",
            borderRadius: 18,
            marginBottom: 14,
            boxShadow: "0 8px 24px rgba(64,107,147,0.35)",
          }}>
            <span style={{ color: "#fff", fontSize: 26, fontWeight: 800 }}>O</span>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, margin: 0,
            color: "#1E344F",
            letterSpacing: 0.5,
          }}>
            One<span style={{ color: "#406B93" }}>Soft</span> ERP
          </h1>
          <p style={{ color: "#6B7280", marginTop: 4, fontSize: 13, fontWeight: 400 }}>
            نظام إدارة الأعمال المتكامل
          </p>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <div style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(12px)",
          border: "1px solid #D4CDC1",
          borderRadius: 16,
          padding: "32px 36px",
          boxShadow: "0 4px 32px rgba(30,52,79,0.12), 0 1px 4px rgba(30,52,79,0.08)",
        }}>
          <h2 style={{
            fontSize: 17, fontWeight: 700, color: "#1E344F",
            textAlign: "center", marginBottom: 24, marginTop: 0,
          }}>
            تسجيل الدخول
          </h2>

          {error && (
            <div style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
              color: "#B91C1C",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: 13,
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* كود المؤسسة */}
            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#374151", marginBottom: 6,
              }}>
                كود المؤسسة
              </label>
              <input
                type="text"
                value={form.orgCode}
                onChange={e => setForm(f => ({ ...f, orgCode: e.target.value.toUpperCase() }))}
                placeholder="مثال: COMP01"
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#F7F4F0",
                  border: "1px solid #C8C1B8",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 13, color: "#1E344F",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "'Cairo', Tahoma, sans-serif",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#406B93";
                  e.target.style.boxShadow = "0 0 0 3px rgba(64,107,147,0.12)";
                  e.target.style.background = "#FFFFFF";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#C8C1B8";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#F7F4F0";
                }}
              />
              <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 5 }}>
                اتركه فارغاً إذا كنت المدير العام
              </p>
            </div>

            {/* اسم المستخدم */}
            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#374151", marginBottom: 6,
              }}>
                اسم المستخدم
              </label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="أدخل اسم المستخدم"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#F7F4F0",
                  border: "1px solid #C8C1B8",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 13, color: "#1E344F",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "'Cairo', Tahoma, sans-serif",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#406B93";
                  e.target.style.boxShadow = "0 0 0 3px rgba(64,107,147,0.12)";
                  e.target.style.background = "#FFFFFF";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#C8C1B8";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#F7F4F0";
                }}
              />
            </div>

            {/* كلمة المرور */}
            <div>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#374151", marginBottom: 6,
              }}>
                كلمة المرور
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="أدخل كلمة المرور"
                required
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#F7F4F0",
                  border: "1px solid #C8C1B8",
                  borderRadius: 8,
                  padding: "9px 14px",
                  fontSize: 13, color: "#1E344F",
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  fontFamily: "'Cairo', Tahoma, sans-serif",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#406B93";
                  e.target.style.boxShadow = "0 0 0 3px rgba(64,107,147,0.12)";
                  e.target.style.background = "#FFFFFF";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#C8C1B8";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#F7F4F0";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#6B8FAD" : "linear-gradient(135deg, #406B93 0%, #2d5070 100%)",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 8,
                padding: "11px 0",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: 4,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity 0.15s, box-shadow 0.15s",
                boxShadow: loading ? "none" : "0 4px 12px rgba(64,107,147,0.30)",
                fontFamily: "'Cairo', Tahoma, sans-serif",
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 18px rgba(64,107,147,0.40)";
                  (e.currentTarget as HTMLButtonElement).style.opacity = "0.92";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? "none" : "0 4px 12px rgba(64,107,147,0.30)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 15, height: 15,
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center", color: "#9CA3AF",
          fontSize: 11.5, marginTop: 20,
        }}>
          OneSoft ERP v1.0 © 2024
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #B0A898; }
      `}</style>
    </div>
  );
}
