import { ArrowRight, ArrowLeft, LifeBuoy, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { useAuth } from "@/core/hooks/useAuth";
import { canViewHsScreen, type HsScreenPerm } from "@/shared/lib/hsPermissions";

// ─── إطار موحّد لصفحات وحدة «المساعدة والخدمات» ─────────────────────────────
// زر رجوع للشاشة الرئيسية للوحدة + عنوان ووصف + حراسة الصلاحية + محتوى «قريبًا».

type SubOption = {
  id: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  route?: string;
};

export default function HsPageShell({
  perm,
  icon: Icon,
  titleAr,
  titleEn,
  descAr,
  descEn,
  color,
  bg,
  subOptions,
}: {
  perm: HsScreenPerm;
  icon: React.ElementType;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  color: string;
  bg: string;
  subOptions?: SubOption[];
}) {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const goBack = () =>
    openTab("/help-services-module", ar ? "المساعدة والخدمات" : "Help & Services", LifeBuoy);

  if (!canViewHsScreen(user, perm)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
        <ShieldAlert className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">
          {ar ? "لا تملك صلاحية الوصول إلى هذه الشاشة" : "You don't have permission to access this screen"}
        </p>
        <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5">
          <BackIcon className="w-3.5 h-3.5" />
          {ar ? "رجوع" : "Back"}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background" dir={dir}>
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* ── زر الرجوع ── */}
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="gap-1.5 mb-5 -ms-2 text-muted-foreground hover:text-foreground"
          data-testid="button-hs-back"
        >
          <BackIcon className="w-4 h-4" />
          {ar ? "المساعدة والخدمات" : "Help & Services"}
        </Button>

        {/* ── العنوان والوصف ── */}
        <div className="flex items-start gap-4 mb-8">
          <div className={`w-14 h-14 shrink-0 rounded-2xl ${bg} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${color}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-hs-page-title">
              {ar ? titleAr : titleEn}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ar ? descAr : descEn}
            </p>
          </div>
        </div>

        {/* ── الخيارات الفرعية (إن وجدت) ── */}
        {subOptions && subOptions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subOptions.map(opt => (
              <Card
                key={opt.id}
                className={`border-border/50 transition-all ${opt.route ? "cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[.99]" : "opacity-70 cursor-not-allowed select-none"}`}
                aria-disabled={!opt.route}
                data-testid={`card-hs-sub-${opt.id}`}
                onClick={() => opt.route && openTab(opt.route, ar ? opt.labelAr : opt.labelEn, opt.icon)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 shrink-0 rounded-xl ${bg} flex items-center justify-center`}>
                      <opt.icon className={`w-[22px] h-[22px] ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">
                          {ar ? opt.labelAr : opt.labelEn}
                        </p>
                        {!opt.route && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                            {ar ? "قريبًا" : "Coming soon"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        {ar ? opt.descAr : opt.descEn}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-border/60">
            <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
              <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
                {ar ? "قريبًا" : "Coming soon"}
              </span>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                {ar
                  ? "هذه الشاشة قيد التجهيز وستتوفر وظائفها في التحديثات القادمة."
                  : "This screen is under preparation; its features will be available in upcoming updates."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
