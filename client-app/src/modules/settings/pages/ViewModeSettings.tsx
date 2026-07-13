import { Card, CardContent, CardHeader, CardTitle } from '@/core/ui/card';
import { Check, LayoutPanelLeft } from 'lucide-react';
import { useAuth } from '@/core/hooks/useAuth';
import { useUiPrefs, type LayoutMode } from '@/core/contexts/UiPrefsContext';

// ─── إعداد "طريقة عرض واجهة النظام" ──────────────────────────────────────────
// اختيار شخصي لكل مستخدم + افتراضي المنشأة (للمسؤول فقط)

const MODES: Array<{ value: LayoutMode; label: string; desc: string }> = [
  { value: 'vertical',   label: 'رأسية',   desc: 'القائمة الرئيسية بشكل رأسي على جانب الشاشة' },
  { value: 'horizontal', label: 'أفقية',   desc: 'القائمة الرئيسية بشكل أفقي أعلى الشاشة' },
  { value: 'apps',       label: 'مركزية',  desc: 'وحدات النظام في منتصف الصفحة على شكل أيقونات' },
];

function ModeThumb({ mode }: { mode: LayoutMode }) {
  return (
    <div className="w-full h-16 rounded-md border border-border bg-muted/40 overflow-hidden flex" dir="rtl">
      {mode === 'vertical' && (
        <>
          <div className="w-1/4 h-full bg-primary/25" />
          <div className="flex-1 p-1.5 flex flex-col gap-1">
            <div className="h-1.5 w-3/4 rounded bg-foreground/15" />
            <div className="h-1.5 w-1/2 rounded bg-foreground/10" />
            <div className="flex-1 rounded bg-foreground/5" />
          </div>
        </>
      )}
      {mode === 'horizontal' && (
        <div className="flex-1 flex flex-col">
          <div className="h-3 bg-primary/25" />
          <div className="h-2 bg-primary/10" />
          <div className="flex-1 p-1.5">
            <div className="h-full rounded bg-foreground/5" />
          </div>
        </div>
      )}
      {mode === 'apps' && (
        <div className="flex-1 flex flex-col">
          <div className="h-2.5 bg-primary/25" />
          <div className="flex-1 p-1.5 flex flex-col items-center gap-1">
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/15" />
            <div className="grid grid-cols-4 gap-1 w-full flex-1 mt-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded bg-primary/20" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViewModeSettings() {
  const { user } = useAuth();
  const { layoutMode, setLayoutMode, orgDefaultLayoutMode, setOrgDefaultLayoutMode } = useUiPrefs();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <LayoutPanelLeft className="w-4 h-4 text-primary" />
          طريقة عرض واجهة النظام
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-4">
        <p className="text-[11px] text-muted-foreground -mt-1">
          اختيار شخصي — يُحفظ لحسابك ويُطبَّق على هذا الجهاز وأي جهاز آخر تسجّل الدخول منه
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODES.map(m => {
            const active = layoutMode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setLayoutMode(m.value)}
                className={`relative text-start rounded-lg border p-3 transition-all ${
                  active
                    ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50'
                }`}
                data-testid={`viewmode-option-${m.value}`}
              >
                {active && (
                  <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </span>
                )}
                <ModeThumb mode={m.value} />
                <p className="text-xs font-semibold mt-2">{m.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold mb-1.5">الافتراضي للمنشأة (للمستخدمين الجدد)</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              يُطبَّق على المستخدمين الذين لم يختاروا طريقة عرض بعد
            </p>
            <div className="flex flex-wrap gap-2">
              {MODES.map(m => {
                const active = orgDefaultLayoutMode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setOrgDefaultLayoutMode(m.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                    data-testid={`org-default-${m.value}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
