import {
  FileSignature, Wallet, UserSearch, ListTodo, Landmark, StickyNote,
  MessagesSquare, CalendarClock, ClipboardList,
} from "lucide-react";
import HsPageShell from "./HsPageShell";

// ─── صفحات وحدة «المساعدة والخدمات» (أولية — قريبًا) ─────────────────────────

export function HsRentalsPage() {
  return (
    <HsPageShell
      perm="hs_rentals"
      icon={FileSignature}
      titleAr="الإيجارات والعقود"
      titleEn="Rentals & Contracts"
      descAr="متابعة عقود الإيجار ومواعيدها وتنبيهاتها."
      descEn="Track rental contracts, their dates, and alerts."
      color="text-indigo-600 dark:text-indigo-400"
      bg="bg-indigo-500/10"
      subOptions={[
        {
          id: "rentals-tracking",
          icon: CalendarClock,
          labelAr: "متابعة الإيجارات",
          labelEn: "Rentals Tracking",
          descAr: "جدول متابعة عقود الإيجار والدفعات والتجديدات.",
          descEn: "Tracking table for rental contracts, payments, and renewals.",
        },
      ]}
    />
  );
}

export function HsCustodyPage() {
  return (
    <HsPageShell
      perm="hs_custody"
      icon={Wallet}
      titleAr="العهد والمصروفات"
      titleEn="Custody & Expenses"
      descAr="تسجيل ومتابعة العهد والمصروفات (الوارد والمنصرف والرصيد)."
      descEn="Record and track custody and expenses (received, spent, balance)."
      color="text-emerald-600 dark:text-emerald-400"
      bg="bg-emerald-500/10"
      subOptions={[
        {
          id: "custody-tracking",
          icon: ClipboardList,
          labelAr: "متابعة العهد",
          labelEn: "Custody Tracking",
          descAr: "سجل تفصيلي لعمليات العهدة وأرصدتها.",
          descEn: "Detailed log of custody transactions and balances.",
        },
      ]}
    />
  );
}

export function HsCustomersPage() {
  return (
    <HsPageShell
      perm="hs_customers"
      icon={UserSearch}
      titleAr="متابعة العملاء"
      titleEn="Customer Follow-up"
      descAr="متابعة العملاء والتواصل معهم وتسجيل الملاحظات عليهم."
      descEn="Follow up with customers, communicate, and record notes."
      color="text-rose-600 dark:text-rose-400"
      bg="bg-rose-500/10"
    />
  );
}

export function HsTasksPage() {
  return (
    <HsPageShell
      perm="hs_tasks"
      icon={ListTodo}
      titleAr="المهام والتذكيرات"
      titleEn="Tasks & Reminders"
      descAr="إدارة المهام اليومية والتذكيرات والمواعيد."
      descEn="Manage daily tasks, reminders, and appointments."
      color="text-orange-600 dark:text-orange-400"
      bg="bg-orange-500/10"
    />
  );
}

export function HsGovLinksPage() {
  return (
    <HsPageShell
      perm="hs_gov_links"
      icon={Landmark}
      titleAr="الروابط والخدمات الحكومية"
      titleEn="Government Links & Services"
      descAr="وصول سريع للمنصات والخدمات الحكومية المتعلقة بالأعمال."
      descEn="Quick access to business-related government platforms and services."
      color="text-sky-600 dark:text-sky-400"
      bg="bg-sky-500/10"
    />
  );
}

export function HsNotesPage() {
  return (
    <HsPageShell
      perm="hs_notes"
      icon={StickyNote}
      titleAr="الملاحظات"
      titleEn="Notes"
      descAr="تدوين الملاحظات الداخلية وتنظيمها."
      descEn="Write down and organize internal notes."
      color="text-amber-600 dark:text-amber-400"
      bg="bg-amber-500/10"
    />
  );
}

export function HsInternalCommPage() {
  return (
    <HsPageShell
      perm="hs_internal_comm"
      icon={MessagesSquare}
      titleAr="التواصل الداخلي"
      titleEn="Internal Communication"
      descAr="التواصل والمراسلة بين المستخدمين داخل المؤسسة."
      descEn="Messaging and communication between users inside the organization."
      color="text-violet-600 dark:text-violet-400"
      bg="bg-violet-500/10"
    />
  );
}
