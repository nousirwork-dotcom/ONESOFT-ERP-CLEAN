import {
  ReceiptText, FolderOpen, Scale, Building2,
  ArrowRight, ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, type HsScreenPerm } from "@/shared/lib/hsPermissions";

// ─── إطار شاشات «المطور العقاري» الفرعية — سلة موحدة قابلة للاستخدام عدة مرات

function ReShell({
  perm,
  icon: Icon,
  titleAr,
  titleEn,
  descAr,
  descEn,
  color,
  bg,
}: {
  perm: HsScreenPerm;
  icon: React.ElementType;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  color: string;
  bg: string;
}) {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const goBack = () =>
    openTab("/hs/real-estate", ar ? "المطور العقاري" : "Real Estate Developer", Building2);

  if (!canViewHsScreen(user, perm)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
        <Building2 className="w-10 h-10 opacity-30" />
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
          data-testid="button-re-sub-back"
        >
          <BackIcon className="w-4 h-4" />
          {ar ? "المطور العقاري" : "Real Estate Developer"}
        </Button>

        {/* ── العنوان والوصف ── */}
        <div className="flex items-start gap-4 mb-8">
          <div className={`w-14 h-14 shrink-0 rounded-2xl ${bg} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${color}`} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-re-sub-title">
              {ar ? titleAr : titleEn}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{ar ? descAr : descEn}</p>
          </div>
        </div>

        {/* ── محتوى «قيد التفعيل» ── */}
        <Card className="border-dashed border-border/60">
          <CardContent className="py-14 flex flex-col items-center justify-center gap-3 text-center">
            <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/60">
              {ar ? "سيتم التفعيل في المرحلة التالية" : "Will be activated in the next phase"}
            </span>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              {ar
                ? "هذه الشاشة قيد التجهيز وستتوفر وظائفها في التحديثات القادمة."
                : "This screen is under preparation; its features will be available in upcoming updates."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── البيان التفصيلي للمشتريات ──
export function RePurchasesPage() {
  return (
    <ReShell
      perm="hs_re_purchases"
      icon={ReceiptText}
      titleAr="البيان التفصيلي للمشتريات"
      titleEn="Purchases Detail Statement"
      descAr="رقم وتفاصيل كاملة للمشتريات الخاصة بالمشروع."
      descEn="Complete number and details of purchases related to the project."
      color="text-emerald-600 dark:text-emerald-400"
      bg="bg-emerald-500/10"
    />
  );
}

// ─── أوراق ومستندات المشروع ──
export function ReDocumentsPage() {
  return (
    <ReShell
      perm="hs_re_documents"
      icon={FolderOpen}
      titleAr="أوراق ومستندات المشروع"
      titleEn="Project Papers & Documents"
      descAr="أدارة وتدوين أوراق ومستندات المشروع العقاري."
      descEn="Manage and organize project real-estate papers and documents."
      color="text-amber-600 dark:text-amber-400"
      bg="bg-amber-500/10"
    />
  );
}

// ─── ميزان المراجعة المبسط ──
export function ReTrialBalancePage() {
  return (
    <ReShell
      perm="hs_re_trial_balance"
      icon={Scale}
      titleAr="ميزان المراجعة المبسط"
      titleEn="Simplified Trial Balance"
      descAr="نظرة سريعة على الحسابات والأرصدة مرتبطة بالمشروع."
      descEn="Quick overview of accounts and balances related to the project."
      color="text-indigo-600 dark:text-indigo-400"
      bg="bg-indigo-500/10"
    />
  );
}
