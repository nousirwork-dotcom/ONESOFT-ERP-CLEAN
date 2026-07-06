import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useBranding, applyCssVariables, DEFAULT_BRANDING, type BrandingSettings } from '@/core/contexts/BrandingContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui/card';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { Palette, RotateCcw, Save, Eye, Monitor, Upload, Image, Sliders } from 'lucide-react';
import { useAuth } from '@/core/hooks/useAuth';

function ColorField({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 shrink-0">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="w-8 h-8 rounded-md border border-border cursor-pointer"
          style={{ background: value }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-[11px] text-muted-foreground mb-0.5 block">{label}</Label>
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-[11px] font-mono"
          placeholder="#000000"
        />
      </div>
      {hint && <span className="text-[10px] text-muted-foreground shrink-0">{hint}</span>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function LoginPreview({ s }: { s: BrandingSettings }) {
  const bg =
    s.login_background_type === 'solid'  ? s.login_background_value :
    s.login_background_type === 'image'  ? `url(${s.login_background_value}) center/cover no-repeat` :
    s.login_background_value;

  const r = `${s.border_radius}px`;

  return (
    <div style={{
      background: bg, borderRadius: 12, padding: 20, minHeight: 340,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, fontFamily: "'Cairo', Tahoma, sans-serif",
    }}>
      {s.logo_url ? (
        <img src={s.logo_url} alt="logo" style={{ width: 52, height: 52, borderRadius: r, objectFit: 'cover' }} />
      ) : (
        <img src="/logo.png" alt="logo" style={{ width: 52, height: 52, borderRadius: r, objectFit: 'cover' }} />
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: s.text_color, fontWeight: 800, fontSize: s.font_size + 4 }}>
          One<span style={{ color: s.primary_color }}>Soft</span> ERP
        </div>
        <div style={{ color: s.text_color, opacity: 0.55, fontSize: s.font_size - 1, marginTop: 2 }}>
          نظام إدارة الأعمال المتكامل
        </div>
      </div>
      <div style={{
        background: s.card_background_color, borderRadius: r,
        padding: '14px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <input
          readOnly placeholder="اسم المستخدم"
          style={{
            background: s.background_color, border: `1px solid #D4CDC1`,
            borderRadius: r, padding: '6px 10px',
            fontSize: s.font_size - 1, color: s.text_color, outline: 'none', width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <input
          readOnly type="password" placeholder="كلمة المرور"
          style={{
            background: s.background_color, border: `1px solid #D4CDC1`,
            borderRadius: r, padding: '6px 10px',
            fontSize: s.font_size - 1, color: s.text_color, outline: 'none', width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <button style={{
          background: s.button_color, color: s.button_text_color,
          border: 'none', borderRadius: r, padding: '8px',
          fontWeight: 700, fontSize: s.font_size - 1, cursor: 'default',
          width: '100%',
        }}>
          تسجيل الدخول
        </button>
      </div>
    </div>
  );
}

function SidebarPreview({ s }: { s: BrandingSettings }) {
  const items = ['لوحة التحكم', 'المبيعات', 'المشتريات', 'المحاسبة', 'الإعدادات'];
  return (
    <div style={{
      background: s.sidebar_color, borderRadius: 10, padding: '12px 0',
      width: '100%', fontFamily: "'Cairo', Tahoma, sans-serif",
    }}>
      <div style={{ padding: '4px 12px 8px', borderBottom: `1px solid rgba(255,255,255,0.06)`, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" style={{ width: 28, height: 28, borderRadius: 6 }} />
          <span style={{ color: s.sidebar_text_color, fontWeight: 700, fontSize: 12 }}>OneSoft ERP</span>
        </div>
      </div>
      {items.map((item, i) => (
        <div key={item} style={{
          padding: '8px 12px', margin: '1px 8px', borderRadius: 4, cursor: 'default',
          background: i === 0 ? s.sidebar_active_color : 'transparent',
          color: i === 0 ? s.button_text_color : s.sidebar_text_color,
          fontSize: 12, fontWeight: i === 0 ? 700 : 500,
        }}>
          {item}
        </div>
      ))}
    </div>
  );
}

export default function BrandingSettingsPage() {
  const { settings, reload } = useBranding();
  const { user } = useAuth();
  const [form, setForm] = useState<BrandingSettings>({ ...settings });
  const [previewMode, setPreviewMode] = useState<'login' | 'sidebar'>('login');
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  useEffect(() => {
    applyCssVariables(form);
  }, [form]);

  const set = <K extends keyof BrandingSettings>(k: K, v: BrandingSettings[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const saveMutation = trpc.branding.saveSettings.useMutation({
    onSuccess: () => { toast.success('تم حفظ إعدادات الهوية بنجاح'); reload(); },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.branding.resetSettings.useMutation({
    onSuccess: () => {
      toast.success('تم استعادة الإعدادات الافتراضية');
      reload();
      setForm({ ...DEFAULT_BRANDING });
    },
    onError: (e) => toast.error(e.message),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      set('logo_url', url);
    };
    reader.readAsDataURL(file);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        <div className="text-center">
          <Palette className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>هذه الصفحة متاحة للمسؤولين فقط</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold">هوية النظام والألوان</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="w-3.5 h-3.5 ml-1" />
            استعادة الافتراضيات
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending || !isAdmin}
          >
            <Save className="w-3.5 h-3.5 ml-1" />
            {saveMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* ── Settings Panel ── */}
        <div className="flex flex-col gap-4 overflow-auto">

          {/* الشعار */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Image className="w-4 h-4 text-primary" />
                الشعار واللوجو
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0"
                onClick={() => logoInputRef.current?.click()}
              >
                {form.logo_url ? (
                  <img src={form.logo_url} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <img src="/logo.png" className="w-full h-full object-cover rounded-lg" />
                )}
              </div>
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground mb-1 block">رابط الشعار (URL أو Base64)</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.logo_url ?? ''}
                    onChange={e => set('logo_url', e.target.value || null)}
                    placeholder="https://example.com/logo.png"
                    className="h-8 text-[11px]"
                  />
                  <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">أو ارفع صورة من جهازك</p>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </CardContent>
          </Card>

          {/* الألوان الأساسية */}
          <Section title="الألوان الأساسية" icon={Palette}>
            <ColorField label="اللون الأساسي" value={form.primary_color} onChange={v => set('primary_color', v)} hint="الأزرار، الروابط" />
            <ColorField label="اللون الثانوي" value={form.secondary_color} onChange={v => set('secondary_color', v)} />
            <ColorField label="لون التمييز" value={form.accent_color} onChange={v => set('accent_color', v)} />
            <ColorField label="لون الخلفية" value={form.background_color} onChange={v => set('background_color', v)} />
            <ColorField label="خلفية الكارت" value={form.card_background_color} onChange={v => set('card_background_color', v)} />
            <ColorField label="لون النصوص" value={form.text_color} onChange={v => set('text_color', v)} />
          </Section>

          {/* الأزرار */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                الأزرار
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="لون الزر" value={form.button_color} onChange={v => set('button_color', v)} />
                <ColorField label="نص الزر" value={form.button_text_color} onChange={v => set('button_text_color', v)} />
              </div>
              <div className="mt-3">
                <Label className="text-[11px] text-muted-foreground mb-1 block">معاينة</Label>
                <button style={{
                  background: form.button_color, color: form.button_text_color,
                  border: 'none', borderRadius: form.border_radius, padding: '8px 20px',
                  fontWeight: 700, fontSize: 13, cursor: 'default',
                  fontFamily: "'Cairo', Tahoma, sans-serif",
                }}>
                  مثال للزر
                </button>
              </div>
            </CardContent>
          </Card>

          {/* الشريط الجانبي */}
          <Section title="الشريط الجانبي" icon={Monitor}>
            <ColorField label="خلفية الشريط" value={form.sidebar_color} onChange={v => set('sidebar_color', v)} />
            <ColorField label="نصوص الشريط" value={form.sidebar_text_color} onChange={v => set('sidebar_text_color', v)} />
            <ColorField label="العنصر النشط" value={form.sidebar_active_color} onChange={v => set('sidebar_active_color', v)} />
          </Section>

          {/* شاشة تسجيل الدخول */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                خلفية شاشة تسجيل الدخول
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1.5 block">نوع الخلفية</Label>
                <Select
                  value={form.login_background_type}
                  onValueChange={v => set('login_background_type', v as BrandingSettings['login_background_type'])}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient">تدرج لوني (Gradient)</SelectItem>
                    <SelectItem value="solid">لون ثابت (Solid)</SelectItem>
                    <SelectItem value="image">صورة (Image)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  {form.login_background_type === 'gradient' ? 'CSS Gradient' :
                   form.login_background_type === 'solid'    ? 'كود اللون' :
                   'رابط الصورة'}
                </Label>
                {form.login_background_type === 'solid' ? (
                  <div className="flex gap-2">
                    <div className="relative w-8 h-8 shrink-0">
                      <input type="color" value={form.login_background_value}
                        onChange={e => set('login_background_value', e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      <div className="w-8 h-8 rounded-md border border-border cursor-pointer"
                        style={{ background: form.login_background_value }} />
                    </div>
                    <Input value={form.login_background_value}
                      onChange={e => set('login_background_value', e.target.value)}
                      className="h-8 text-[11px] font-mono flex-1" />
                  </div>
                ) : (
                  <Input value={form.login_background_value}
                    onChange={e => set('login_background_value', e.target.value)}
                    className="h-8 text-[11px] font-mono"
                    placeholder={form.login_background_type === 'gradient'
                      ? 'linear-gradient(145deg, #E8E0D4, #C8C0B4)'
                      : 'https://example.com/bg.jpg'} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* الأبعاد والخطوط */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                الأبعاد والخطوط
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px] text-muted-foreground">نسبة تدوير الزوايا</Label>
                  <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{form.border_radius}px</span>
                </div>
                <input
                  type="range" min={0} max={24} step={1}
                  value={form.border_radius}
                  onChange={e => set('border_radius', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>حاد (0px)</span><span>دائري (24px)</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[11px] text-muted-foreground">حجم الخط الأساسي</Label>
                  <span className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{form.font_size}px</span>
                </div>
                <input
                  type="range" min={10} max={18} step={1}
                  value={form.font_size}
                  onChange={e => set('font_size', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                  <span>صغير (10px)</span><span>كبير (18px)</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Live Preview Panel ── */}
        <div className="flex flex-col gap-3 sticky top-0 self-start">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">معاينة مباشرة</span>
            <div className="flex gap-1 mr-auto">
              <button
                onClick={() => setPreviewMode('login')}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                  previewMode === 'login' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => setPreviewMode('sidebar')}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                  previewMode === 'sidebar' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                الشريط الجانبي
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-border shadow-sm">
            {previewMode === 'login'
              ? <LoginPreview s={form} />
              : <SidebarPreview s={form} />
            }
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            التغييرات تُطبَّق فوراً على الواجهة
          </p>
        </div>
      </div>
    </div>
  );
}
