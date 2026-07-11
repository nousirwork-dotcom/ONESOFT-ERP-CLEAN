import React, { useState } from "react";
import { Shield, KeyRound, User, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";

const NAVY   = "#0F1D40";
const NAVY2  = "#1B2B5C";
const GOLD   = "#C9A84C";
const CREAM  = "#F8F5EF";
const BORDER = "#E5DDD0";

export default function LoginPage() {
  const { login, error: authError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orgCode,  setOrgCode]  = useState("SYSTEM");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const err = localErr ?? authError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLocalErr("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setLocalErr(null);
    setLoading(true);
    try {
      await login(username.trim(), password, orgCode.trim() || "SYSTEM");
    } catch (err: any) {
      setLocalErr(err.message ?? "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: CREAM, fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" }}
    >
      <div className="w-full max-w-sm px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl"
            style={{ backgroundColor: NAVY }}
          >
            <span className="text-[24px] font-black tracking-widest" style={{ color: GOLD }}>LC</span>
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-black" style={{ color: NAVY2 }}>
              <span style={{ color: NAVY2 }}>OneSoft</span>{" "}
              <span style={{ color: GOLD }}>License Center</span>
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#9CA3AF" }}>
              مخصص للمدير العام فقط
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
          style={{ border: `1px solid ${BORDER}` }}
        >
          {/* Banner */}
          <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ backgroundColor: NAVY }}>
            <Shield className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
            <p className="text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
              صلاحية الوصول: المدير العام · superadmin
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Error */}
            {err && (
              <div
                className="flex items-start gap-2.5 p-3.5 rounded-2xl"
                style={{ backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <p className="text-[13px] font-semibold text-red-700">{err}</p>
              </div>
            )}

            {/* Org Code */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-bold" style={{ color: "#374151" }}>
                كود المؤسسة
              </label>
              <input
                value={orgCode}
                onChange={e => setOrgCode(e.target.value)}
                placeholder="SYSTEM"
                className="w-full px-4 py-2.5 rounded-xl outline-none text-[14px] font-mono transition-all"
                style={{
                  border: `1.5px solid ${BORDER}`,
                  backgroundColor: "#F9FAFB",
                  color: NAVY2,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-bold" style={{ color: "#374151" }}>
                اسم المستخدم
              </label>
              <div className="relative">
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  className="w-full px-4 py-2.5 pl-10 rounded-xl outline-none text-[14px] transition-all"
                  style={{
                    border: `1.5px solid ${BORDER}`,
                    backgroundColor: "#F9FAFB",
                    color: NAVY2,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-bold" style={{ color: "#374151" }}>
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pl-10 rounded-xl outline-none text-[14px] transition-all"
                  style={{
                    border: `1.5px solid ${BORDER}`,
                    backgroundColor: "#F9FAFB",
                    color: NAVY2,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-white text-[15px] font-black transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 mt-2"
              style={{ backgroundColor: NAVY2 }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحقق...</>
                : <><KeyRound className="w-4 h-4" /> دخول مركز التراخيص</>
              }
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[12px] mt-5" style={{ color: "#9CA3AF" }}>
          هذا البرنامج حصري لمالك النظام ولا يُوزَّع مع نسخة العميل
        </p>
      </div>
    </div>
  );
}
