/**
 * FirstRunWizard — معالج الإعداد الأول
 * يظهر مرة واحدة فقط عند أول تشغيل (عندما لا توجد مؤسسات)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Building2, User, Shield, CheckCircle2, ChevronRight, ChevronLeft,
  Globe, Calendar, Lock, Database, Zap,
} from "lucide-react";

// ── الخطوات ───────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "welcome",  label: "مرحباً بك",       icon: Building2 },
  { id: "company",  label: "معلومات الشركة",   icon: Building2 },
  { id: "admin",    label: "حساب المدير",      icon: User      },
  { id: "settings", label: "الإعدادات",        icon: Globe     },
  { id: "done",     label: "جاهز!",            icon: CheckCircle2 },
];

interface Props { onComplete: () => void; }

export default function FirstRunWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // ── بيانات النموذج ────────────────────────────────────────────────────────
  const [company, setCompany] = useState({
    name: "", nameEn: "", taxNumber: "", phone: "", email: "", address: "",
    country: "SA", currency: "SAR", fiscalYear: new Date().getFullYear(), language: "ar" as "ar"|"en",
  });
  const [admin, setAdmin] = useState({ username: "", password: "", confirmPassword: "", name: "", email: "" });
  const [backup, setBackup] = useState({ enabled: true, directory: "" });
  const [zatca, setZatca] = useState({ setupNow: false });

  const firstRunMut = trpc.setup.firstRun.useMutation({
    onSuccess: () => { setStep(4); },
    onError: (e) => { toast.error(`❌ ${e.message}`); setLoading(false); },
  });

  const handleNext = async () => {
    if (step === 1 && !company.name.trim()) { toast.error("أدخل اسم الشركة"); return; }
    if (step === 2) {
      if (!admin.username.trim() || !admin.name.trim()) { toast.error("أدخل بيانات المدير"); return; }
      if (admin.password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
      if (admin.password !== admin.confirmPassword) { toast.error("كلمة المرور غير متطابقة"); return; }
    }
    if (step === 3) {
      setLoading(true);
      firstRunMut.mutate({
        company: { ...company },
        admin:   { username: admin.username, password: admin.password, name: admin.name, email: admin.email || undefined },
        backup:  { enabled: backup.enabled, directory: backup.directory || undefined },
        zatca:   { setupNow: zatca.setupNow },
      });
      return;
    }
    if (step === 4) { onComplete(); return; }
    setStep(s => s + 1);
  };

  const C = (k: keyof typeof company) => (v: string) => setCompany(p => ({ ...p, [k]: v }));
  const A = (k: keyof typeof admin)   => (v: string) => setAdmin(p => ({ ...p, [k]: v }));

  return (
    <Dialog open>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0" style={{ direction: "rtl" }}>
        <div className="flex h-[580px]">
          {/* ── الشريط الجانبي ─────────────────────────────────────────── */}
          <div className="w-52 bg-slate-900 flex flex-col py-6 px-3 shrink-0">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-2">
                <Building2 className="w-6 h-6 text-slate-900" />
              </div>
              <p className="text-amber-400 font-bold text-sm">OneSoft ERP</p>
              <p className="text-slate-500 text-xs">الإعداد الأول</p>
            </div>
            <div className="flex flex-col gap-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done    = i < step;
                const current = i === step;
                return (
                  <div key={s.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${current ? "bg-amber-500/20 text-amber-400" : done ? "text-emerald-400" : "text-slate-500"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${current ? "bg-amber-500 text-slate-900" : done ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className="text-xs">{s.label}</span>
                  </div>
                );
              })}
            </div>
            {/* شريط التقدم */}
            <div className="mt-auto">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
              </div>
              <p className="text-slate-500 text-xs mt-1 text-center">{Math.round((step / (STEPS.length - 1)) * 100)}%</p>
            </div>
          </div>

          {/* ── المحتوى الرئيسي ─────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-8">

              {/* خطوة 0: ترحيب */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-slate-900">مرحباً بك في OneSoft ERP</h2>
                  <p className="text-slate-600">سيرشدك هذا المعالج لإعداد البرنامج في دقائق.</p>
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    {[
                      { icon: Building2, t: "إعداد بيانات الشركة",   d: "اسم الشركة والرقم الضريبي" },
                      { icon: User,      t: "إنشاء حساب المدير",     d: "اسم المستخدم وكلمة المرور" },
                      { icon: Globe,     t: "إعداد العملة واللغة",   d: "SAR والعربية افتراضياً" },
                      { icon: Shield,    t: "تأمين النظام",           d: "تشفير البيانات الحساسة" },
                    ].map(({ icon: Icon, t, d }) => (
                      <div key={t} className="border border-slate-200 rounded-xl p-4 flex gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{t}</p>
                          <p className="text-xs text-slate-500">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                    <p className="text-sm text-blue-800">💡 يمكن تعديل جميع الإعدادات لاحقاً من داخل البرنامج.</p>
                  </div>
                </div>
              )}

              {/* خطوة 1: معلومات الشركة */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900">معلومات الشركة</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-600">اسم الشركة <span className="text-red-500">*</span></Label>
                      <Input value={company.name} onChange={e => C("name")(e.target.value)} placeholder="مثال: شركة النجاح التجارية" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">اسم الشركة (إنجليزي)</Label>
                      <Input value={company.nameEn} onChange={e => C("nameEn")(e.target.value)} placeholder="Al Najah Trading Co." className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">الرقم الضريبي (VAT)</Label>
                      <Input value={company.taxNumber} onChange={e => C("taxNumber")(e.target.value)} placeholder="300xxxxxxxxxx3" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">الهاتف</Label>
                      <Input value={company.phone} onChange={e => C("phone")(e.target.value)} placeholder="+966 5x xxx xxxx" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">البريد الإلكتروني</Label>
                      <Input value={company.email} onChange={e => C("email")(e.target.value)} placeholder="info@company.com" className="mt-1" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-600">العنوان</Label>
                      <Input value={company.address} onChange={e => C("address")(e.target.value)} placeholder="الرياض، المملكة العربية السعودية" className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              {/* خطوة 2: حساب المدير */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900">إنشاء حساب المدير</h2>
                  <p className="text-sm text-slate-500">هذا الحساب سيكون له صلاحية كاملة على النظام.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-600">الاسم الكامل <span className="text-red-500">*</span></Label>
                      <Input value={admin.name} onChange={e => A("name")(e.target.value)} placeholder="محمد أحمد" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">اسم المستخدم <span className="text-red-500">*</span></Label>
                      <Input value={admin.username} onChange={e => A("username")(e.target.value)} placeholder="admin" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">البريد الإلكتروني</Label>
                      <Input value={admin.email} onChange={e => A("email")(e.target.value)} placeholder="admin@company.com" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">كلمة المرور <span className="text-red-500">*</span></Label>
                      <Input type="password" value={admin.password} onChange={e => A("password")(e.target.value)} placeholder="6 أحرف على الأقل" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                      <Input type="password" value={admin.confirmPassword} onChange={e => A("confirmPassword")(e.target.value)} placeholder="أعد الكتابة" className="mt-1" />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-800 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" /> كلمة المرور مشفّرة ولا تُخزّن بشكل مقروء.
                    </p>
                  </div>
                </div>
              )}

              {/* خطوة 3: الإعدادات */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900">إعدادات النظام</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">العملة الأساسية</Label>
                      <Select value={company.currency} onValueChange={C("currency")}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAR">🇸🇦 ريال سعودي (SAR)</SelectItem>
                          <SelectItem value="AED">🇦🇪 درهم إماراتي (AED)</SelectItem>
                          <SelectItem value="KWD">🇰🇼 دينار كويتي (KWD)</SelectItem>
                          <SelectItem value="USD">🇺🇸 دولار أمريكي (USD)</SelectItem>
                          <SelectItem value="EUR">🇪🇺 يورو (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">لغة النظام</Label>
                      <Select value={company.language} onValueChange={v => C("language")(v as "ar"|"en")}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                          <SelectItem value="en">🇺🇸 English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">السنة المالية</Label>
                      <Select value={String(company.fiscalYear)} onValueChange={v => setCompany(p => ({ ...p, fiscalYear: parseInt(v) }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2024,2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">الدولة</Label>
                      <Select value={company.country} onValueChange={C("country")}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SA">🇸🇦 المملكة العربية السعودية</SelectItem>
                          <SelectItem value="AE">🇦🇪 الإمارات</SelectItem>
                          <SelectItem value="KW">🇰🇼 الكويت</SelectItem>
                          <SelectItem value="BH">🇧🇭 البحرين</SelectItem>
                          <SelectItem value="QA">🇶🇦 قطر</SelectItem>
                          <SelectItem value="OM">🇴🇲 عُمان</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* إعداد هيئة الزكاة */}
                  <div className="border border-slate-200 rounded-xl p-4 mt-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Zap className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">ربط هيئة الزكاة والضريبة (ZATCA)</p>
                        <p className="text-xs text-slate-500 mt-0.5">الفوترة الإلكترونية وفق متطلبات هيئة الزكاة</p>
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            onClick={() => setZatca({ setupNow: true })}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${zatca.setupNow ? "bg-green-600 text-white border-green-600" : "border-slate-300 text-slate-600 hover:border-green-500"}`}>
                            إعداد الآن
                          </button>
                          <button
                            onClick={() => setZatca({ setupNow: false })}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!zatca.setupNow ? "bg-slate-700 text-white border-slate-700" : "border-slate-300 text-slate-600"}`}>
                            لاحقاً
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* خطوة 4: اكتمل */}
              {step === 4 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">🎉 اكتمل الإعداد!</h2>
                  <p className="text-slate-600 max-w-xs">تم إعداد <strong>{company.name}</strong> بنجاح. يمكنك الآن البدء في استخدام OneSoft ERP.</p>
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1 text-right w-full max-w-xs">
                    <p><span className="font-semibold">اسم المستخدم:</span> {admin.username}</p>
                    <p><span className="font-semibold">العملة:</span> {company.currency}</p>
                    <p><span className="font-semibold">السنة المالية:</span> {company.fiscalYear}</p>
                  </div>
                  {zatca.setupNow && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 w-full max-w-xs">
                      <p className="text-xs text-green-800">ستُفتح صفحة إعداد ZATCA بعد الانتهاء.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── أزرار التنقل ───────────────────────────────────────────── */}
            <div className="border-t border-slate-100 px-8 py-4 flex items-center justify-between bg-slate-50">
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0 || step === 4}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" /> السابق
              </button>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i === step ? "bg-amber-500" : i < step ? "bg-emerald-400" : "bg-slate-200"}`} />
                ))}
              </div>
              <Button
                onClick={handleNext}
                disabled={loading || firstRunMut.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold gap-1.5">
                {loading || firstRunMut.isPending ? "جارٍ الحفظ..." : step === 4 ? "ابدأ الاستخدام ✓" : step === 3 ? "إنهاء الإعداد" : (<>التالي <ChevronLeft className="w-4 h-4" /></>)}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
