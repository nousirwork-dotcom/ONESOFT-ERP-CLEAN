import {
  LifeBuoy, Wallet, Landmark, StickyNote, MessagesSquare,
} from "lucide-react";
import { Card, CardContent } from "@/core/ui/card";
import { useLang } from "@/core/contexts/LanguageContext";

// ─── وحدة «المساعدة والخدمات» ─────────────────────────────────────────────────
// شاشات فرعية مستقبلية (غير مفعّلة حاليًا). لا مسارات فعّالة حتى لا تُسجَّل
// في فهرس البحث أو نظام التبويبات قبل تنفيذها.

export const menuSections = [
  {
    id: "help-services",
    label: "الخدمات المساعدة",
    icon: LifeBuoy,
    children: [] as Array<{ id: string; label: string; icon: React.ElementType; path?: string }>,
  },
];

type UpcomingCard = {
  id: string;
  icon: React.ElementType;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  color: string;
  bg: string;
};

const UPCOMING_CARDS: UpcomingCard[] = [
  {
    id: "custody-log",
    icon: Wallet,
    labelAr: "سجل العهدة",
    labelEn: "Custody Log",
    descAr: "تسجيل ومتابعة عمليات العهدة (الوارد والمنصرف والرصيد).",
    descEn: "Record and track custody transactions (received, spent, balance).",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "gov-links",
    icon: Landmark,
    labelAr: "الروابط والخدمات الحكومية",
    labelEn: "Government Links & Services",
    descAr: "وصول سريع للمنصات والخدمات الحكومية المتعلقة بالأعمال.",
    descEn: "Quick access to business-related government platforms and services.",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    id: "notes",
    icon: StickyNote,
    labelAr: "الملاحظات",
    labelEn: "Notes",
    descAr: "تدوين الملاحظات والمهام والتذكيرات الداخلية.",
    descEn: "Write down internal notes, tasks, and reminders.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    id: "internal-chat",
    icon: MessagesSquare,
    labelAr: "التواصل الداخلي",
    labelEn: "Internal Communication",
    descAr: "التواصل والمراسلة بين المستخدمين داخل المؤسسة.",
    descEn: "Messaging and communication between users inside the organization.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
];

export default function HelpServicesModule() {
  const { lang, dir } = useLang();
  const ar = lang === "ar";

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

        {/* ── البطاقات (غير مفعّلة — قريبًا) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {UPCOMING_CARDS.map(card => (
            <Card
              key={card.id}
              className="border-border/50 opacity-70 cursor-not-allowed select-none"
              aria-disabled="true"
              data-testid={`card-helpservices-${card.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3.5">
                  <div className={`w-11 h-11 shrink-0 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-[22px] h-[22px] ${card.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">
                        {ar ? card.labelAr : card.labelEn}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">
                        {ar ? "قريبًا" : "Coming soon"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {ar ? card.descAr : card.descEn}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/70 mt-8">
          {ar
            ? "هذه الخدمات قيد التجهيز وستتوفر في التحديثات القادمة."
            : "These services are under preparation and will be available in upcoming updates."}
        </p>
      </div>
    </div>
  );
}
