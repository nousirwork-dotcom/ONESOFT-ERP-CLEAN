import {
  Building2, ReceiptText, FolderOpen, Scale,
} from "lucide-react";
import { Card, CardContent } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen } from "@/shared/lib/hsPermissions";
import { ArrowRight, ArrowLeft, ShieldAlert } from "lucide-react";

// ─── شاشة «المطور العقاري» الرئيسية ───────────────────────────────────────────
// تعرض ثلاث بطاقات فرعية لفتح الشاشات الفرعية.

type SubCard = {
  id: string;
  perm: "hs_re_purchases" | "hs_re_documents" | "hs_re_trial_balance";
  path: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  color: string;
  bg: string;
};

const SUB_CARDS: SubCard[] = [
  {
    id: "re-purchases",
    perm: "hs_re_purchases",
    path: "/hs/re-purchases",
    icon: ReceiptText,
    labelAr: "البيان التفصيلي للمشتريات",
    labelEn: "Purchases Detail Statement",
    descAr: "رقم وتفاصيل كاملة للمشتريات الخاصة بالمشروع.",
    descEn: "Complete number and details of purchases related to the project.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "re-documents",
    perm: "hs_re_documents",
    path: "/hs/re-documents",
    icon: FolderOpen,
    labelAr: "أوراق ومستندات المشروع",
    labelEn: "Project Papers & Documents",
    descAr: "أدارة وتدوين أوراق ومستندات المشروع العقاري.",
    descEn: "Manage and organize project real-estate papers and documents.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "re-trial-balance",
    perm: "hs_re_trial_balance",
    path: "/hs/re-trial-balance",
    icon: Scale,
    labelAr: "ميزان المراجعة المبسط",
    labelEn: "Simplified Trial Balance",
    descAr: "نظرة سريعة على الحسابات والأرصدة مرتبطة بالمشروع.",
    descEn: "Quick overview of accounts and balances related to the project.",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
  },
];

export default function RealEstatePage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const goBack = () =>
    openTab("/help-services-module", ar ? "المساعدة والخدمات" : "Help & Services", Building2);

  if (!canViewHsScreen(user, "hs_real_estate")) {
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
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ── زر الرجوع ── */}
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="gap-1.5 mb-5 -ms-2 text-muted-foreground hover:text-foreground"
          data-testid="button-re-back"
        >
          <BackIcon className="w-4 h-4" />
          {ar ? "المساعدة والخدمات" : "Help & Services"}
        </Button>

        {/* ── العنوان والوصف ── */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-teal-500/10 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-re-title">
              {ar ? "المطور العقاري" : "Real Estate Developer"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ar
                ? "إدارة مشاريع التطوير العقاري: المشتريات، المستندات، والمراجعة المبسطة."
                : "Manage real estate development projects: purchases, documents, and simplified review."}
            </p>
          </div>
        </div>

        {/* ── البطاقات الفرعية ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SUB_CARDS.map(card => (
            <Card
              key={card.id}
              className="border-border/50 cursor-pointer transition-all duration-150 hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
              role="button"
              tabIndex={0}
              onClick={() => openTab(card.path, ar ? card.labelAr : card.labelEn, card.icon)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTab(card.path, ar ? card.labelAr : card.labelEn, card.icon);
                }
              }}
              data-testid={`card-re-sub-${card.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 shrink-0 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-[22px] h-[22px] ${card.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {ar ? card.labelAr : card.labelEn}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {ar ? card.descAr : card.descEn}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
