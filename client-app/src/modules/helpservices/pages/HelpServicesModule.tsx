import {
  LifeBuoy, FileSignature, Wallet, UserSearch, ListTodo, Landmark,
  StickyNote, MessagesSquare, Sparkles, Headphones,
} from "lucide-react";
import { Card, CardContent } from "@/core/ui/card";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, type HsScreenPerm } from "@/shared/lib/hsPermissions";
import { canUseAi } from "@/shared/lib/aiPermissions";

// ─── وحدة «المساعدة والخدمات» ─────────────────────────────────────────────────
// 7 بطاقات، لكل بطاقة صفحة أولية بمسار مستقل يفتح داخل نظام التبويبات.

export const menuSections = [
  {
    id: "help-services",
    label: "الخدمات المساعدة",
    icon: LifeBuoy,
    children: [
      { id: "hs-rentals",       label: "الإيجارات والعقود",           icon: FileSignature,  path: "/hs/rentals" },
      { id: "hs-custody",       label: "العهد والمصروفات",            icon: Wallet,         path: "/hs/custody" },
      { id: "hs-customers",     label: "متابعة العملاء",              icon: UserSearch,     path: "/hs/customers" },
      { id: "hs-tasks",         label: "المهام والتذكيرات",           icon: ListTodo,       path: "/hs/tasks" },
      { id: "hs-gov-links",     label: "الروابط والخدمات",            icon: Landmark,       path: "/hs/gov-links" },
      { id: "hs-notes",         label: "الملاحظات",                   icon: StickyNote,     path: "/hs/notes" },
      { id: "hs-internal-comm", label: "التواصل الداخلي",             icon: MessagesSquare, path: "/hs/internal-comm" },
      { id: "hs-ai-assistant",  label: "المساعد الذكي",               icon: Sparkles,       path: "/hs/ai-assistant" },
      { id: "hs-support",       label: "طلب الدعم الفني",             icon: Headphones,     path: "/hs/support" },
    ] as Array<{ id: string; label: string; icon: React.ElementType; path?: string }>,
  },
];

type HsCard = {
  id: string;
  perm: HsScreenPerm | "ai_use";
  path: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  color: string;
  bg: string;
};

export const HS_CARDS: HsCard[] = [
  {
    id: "rentals",
    perm: "hs_rentals",
    path: "/hs/rentals",
    icon: FileSignature,
    labelAr: "الإيجارات والعقود",
    labelEn: "Rentals & Contracts",
    descAr: "متابعة عقود الإيجار ومواعيدها وتنبيهاتها.",
    descEn: "Track rental contracts, their dates, and alerts.",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    id: "custody",
    perm: "hs_custody",
    path: "/hs/custody",
    icon: Wallet,
    labelAr: "العهد والمصروفات",
    labelEn: "Custody & Expenses",
    descAr: "تسجيل ومتابعة العهد والمصروفات (الوارد والمنصرف والرصيد).",
    descEn: "Record and track custody and expenses (received, spent, balance).",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "customers",
    perm: "hs_customers",
    path: "/hs/customers",
    icon: UserSearch,
    labelAr: "متابعة العملاء",
    labelEn: "Customer Follow-up",
    descAr: "متابعة العملاء والتواصل معهم وتسجيل الملاحظات عليهم.",
    descEn: "Follow up with customers, communicate, and record notes.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    id: "tasks",
    perm: "hs_tasks",
    path: "/hs/tasks",
    icon: ListTodo,
    labelAr: "المهام والتذكيرات",
    labelEn: "Tasks & Reminders",
    descAr: "إدارة المهام اليومية والتذكيرات والمواعيد.",
    descEn: "Manage daily tasks, reminders, and appointments.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    id: "gov-links",
    perm: "hs_gov_links",
    path: "/hs/gov-links",
    icon: Landmark,
    labelAr: "الروابط والخدمات",
    labelEn: "Links & Services",
    descAr: "وصول سريع للمنصات والخدمات المختلفة المتعلقة بالأعمال.",
    descEn: "Quick access to various business-related platforms and services.",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    id: "notes",
    perm: "hs_notes",
    path: "/hs/notes",
    icon: StickyNote,
    labelAr: "الملاحظات",
    labelEn: "Notes",
    descAr: "تدوين الملاحظات الداخلية وتنظيمها.",
    descEn: "Write down and organize internal notes.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "internal-comm",
    perm: "hs_internal_comm",
    path: "/hs/internal-comm",
    icon: MessagesSquare,
    labelAr: "التواصل الداخلي",
    labelEn: "Internal Communication",
    descAr: "التواصل والمراسلة بين المستخدمين داخل المؤسسة.",
    descEn: "Messaging and communication between users inside the organization.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    id: "ai-assistant",
    perm: "ai_use",
    path: "/hs/ai-assistant",
    icon: Sparkles,
    labelAr: "المساعد الذكي",
    labelEn: "AI Assistant",
    descAr: "مساعد ذكي للبحث والتلخيص والمتابعة وإنشاء المسودات داخل النظام.",
    descEn: "Smart assistant for searching, summarizing, follow-up, and drafting inside the system.",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
  },
  {
    id: "support",
    perm: "hs_support",
    path: "/hs/support",
    icon: Headphones,
    labelAr: "طلب الدعم الفني",
    labelEn: "Technical Support",
    descAr: "تقديم طلبات الدعم الفني ومتابعة الردود وتقييم الخدمة.",
    descEn: "Submit support requests, follow up on replies, and rate the service.",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

export default function HelpServicesModule() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";

  const visibleCards = HS_CARDS.filter(card =>
    card.perm === "ai_use"
      ? canUseAi(user)
      : canViewHsScreen(user, card.perm as HsScreenPerm)
  );

  return (
    <div className="h-full overflow-y-auto bg-background" dir={dir}>
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── العنوان والوصف ── */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-helpservices-title">
              {ar ? "المساعدة والخدمات" : "Help & Services"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-helpservices-desc">
              {ar
                ? "أدوات وخدمات مساعدة لتنظيم الأعمال والمتابعة والتواصل داخل المؤسسة."
                : "Helper tools and services for organizing work, follow-up, and communication inside the organization."}
            </p>
          </div>
        </div>

        {/* ── البطاقات ── */}
        {visibleCards.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            {ar
              ? "لا تملك صلاحية الوصول إلى أي من شاشات هذه الوحدة."
              : "You don't have permission to access any screen in this module."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleCards.map(card => (
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
                data-testid={`card-helpservices-${card.id}`}
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
        )}
      </div>
    </div>
  );
}
