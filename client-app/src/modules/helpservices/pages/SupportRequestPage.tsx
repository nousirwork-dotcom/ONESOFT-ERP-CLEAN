import { useState, useEffect, useRef } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { toast } from "sonner";
import {
  Headphones, Plus, Send, RefreshCw, Star, X, ChevronRight,
  Clock, CheckCircle2, AlertTriangle, XCircle, MessageSquare,
  Inbox, FileText, Loader2, RotateCcw, Info,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";

// ─── الأنواع ───────────────────────────────────────────────────────────────────
type Tab = "new" | "my-tickets" | "new-replies";
type Ticket = {
  id: number; ticketNumber: string; subject: string; description: string;
  category: string; priority: string; status: string;
  unreadReplies: number; submittedAt: string | null; createdAt: string;
  updatedAt: string; rating: number | null; lcTicketRef: string | null;
};
type Message = {
  id: number; senderType: string; senderName: string | null;
  body: string; isRead: boolean; sentAt: string; createdAt: string;
};

// ─── تعريفات ──────────────────────────────────────────────────────────────────
const CATEGORY_OPTS = [
  { value: "general",   label: "عام" },
  { value: "technical", label: "مشكلة تقنية" },
  { value: "billing",   label: "فاتورة أو ترخيص" },
  { value: "feature",   label: "اقتراح / ميزة" },
  { value: "urgent",    label: "عاجل" },
];
const PRIORITY_OPTS = [
  { value: "low",    label: "منخفض" },
  { value: "normal", label: "عادي" },
  { value: "high",   label: "مرتفع" },
  { value: "urgent", label: "عاجل" },
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft:       { label: "مسودة",     variant: "secondary" },
    submitted:   { label: "مُرسَلة",   variant: "default" },
    open:        { label: "مفتوحة",    variant: "default" },
    in_progress: { label: "قيد المعالجة", variant: "default" },
    resolved:    { label: "محلولة",    variant: "outline" },
    closed:      { label: "مغلقة",     variant: "outline" },
    cancelled:   { label: "ملغاة",     variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    low: "text-gray-500", normal: "text-blue-600", high: "text-orange-500", urgent: "text-red-600",
  };
  const labels: Record<string, string> = {
    low: "منخفض", normal: "عادي", high: "مرتفع", urgent: "عاجل",
  };
  return (
    <span className={`text-xs font-semibold ${map[priority] ?? "text-gray-500"}`}>
      {labels[priority] ?? priority}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-colors">
          <Star className={`w-7 h-7 ${n <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ─── نموذج طلب جديد ───────────────────────────────────────────────────────────
function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"general" | "technical" | "billing" | "feature" | "urgent">("general");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const createDraft  = trpc.supportTickets.createDraft.useMutation();
  const submitTicket = trpc.supportTickets.submitTicket.useMutation();
  const diagQ        = trpc.supportTickets.getDiagnosticReport.useQuery();

  async function handleSubmit() {
    if (!subject.trim() || subject.trim().length < 5) {
      toast.error("الموضوع قصير جدًا (5 أحرف على الأقل)");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast.error("الوصف قصير جدًا (10 أحرف على الأقل)");
      return;
    }
    try {
      const draft = await createDraft.mutateAsync({ subject: subject.trim(), description: description.trim(), category, priority });
      await submitTicket.mutateAsync({ ticketId: draft.id });
      toast.success("تم إرسال طلب الدعم بنجاح ✅");
      onCreated();
      setSubject(""); setDescription(""); setCategory("general"); setPriority("normal"); setStep("form");
    } catch (e: any) {
      toast.error(e?.message ?? "حدث خطأ أثناء الإرسال");
    }
  }

  const isLoading = createDraft.isPending || submitTicket.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">طلب دعم فني جديد</h2>
            <p className="text-xs text-muted-foreground mt-0.5">اشرح مشكلتك بوضوح وسيتواصل معك الفريق قريبًا</p>
          </div>
        </div>

        {step === "form" && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">موضوع الطلب *</label>
              <Input
                placeholder="مثال: مشكلة في طباعة الفاتورة"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                maxLength={500}
                dir="rtl"
              />
              <p className="text-xs text-muted-foreground text-left">{subject.length}/500</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">التصنيف</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  dir="rtl"
                >
                  {CATEGORY_OPTS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">الأولوية</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  dir="rtl"
                >
                  {PRIORITY_OPTS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">تفاصيل المشكلة *</label>
              <Textarea
                placeholder="صف المشكلة بالتفصيل: متى بدأت، ما الخطوات التي قمت بها، ما الرسالة التي ظهرت..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={6}
                maxLength={5000}
                dir="rtl"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-left">{description.length}/5000</p>
            </div>

            {diagQ.data && (
              <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-xs space-y-1 text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-foreground mb-1">
                  <Info className="w-3.5 h-3.5" /> معلومات سيتم إرسالها مع الطلب
                </div>
                <p>المؤسسة: {diagQ.data.orgName} · المستخدم: {diagQ.data.userName} · المنصة: {diagQ.data.platform}</p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => setStep("confirm")}
              disabled={subject.length < 5 || description.length < 10}
            >
              <ChevronRight className="w-4 h-4 ml-1" />
              مراجعة وإرسال
            </Button>
          </>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4 space-y-3 text-sm">
              <div><span className="font-semibold text-foreground">الموضوع: </span>{subject}</div>
              <div><span className="font-semibold text-foreground">التصنيف: </span>{CATEGORY_OPTS.find(o => o.value === category)?.label}</div>
              <div><span className="font-semibold text-foreground">الأولوية: </span>{PRIORITY_OPTS.find(o => o.value === priority)?.label}</div>
              <div>
                <span className="font-semibold text-foreground">الوصف:</span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{description}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("form")}
                disabled={isLoading}
              >
                تعديل
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? <><Loader2 className="w-4 h-4 ml-1 animate-spin" />جارٍ الإرسال...</> : <><Send className="w-4 h-4 ml-1" />إرسال الطلب</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── عرض تفاصيل تذكرة ─────────────────────────────────────────────────────────
function TicketDetail({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [reply, setReply] = useState("");
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [showRating, setShowRating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const detailQ  = trpc.supportTickets.getTicket.useQuery({ ticketId }, { refetchInterval: 15000 });
  const addReply = trpc.supportTickets.addReply.useMutation({
    onSuccess: () => { setReply(""); detailQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cancelQ = trpc.supportTickets.cancelTicket.useMutation({
    onSuccess: () => { detailQ.refetch(); toast.success("تم إلغاء الطلب"); },
    onError: (e) => toast.error(e.message),
  });
  const rateQ = trpc.supportTickets.rateTicket.useMutation({
    onSuccess: () => { detailQ.refetch(); toast.success("شكرًا على تقييمك!"); setShowRating(false); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detailQ.data?.messages]);

  if (detailQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل...
      </div>
    );
  }
  if (!detailQ.data) return null;

  const { ticket, messages } = detailQ.data;
  const canReply = !["resolved", "closed", "cancelled"].includes(ticket.status);
  const canRate  = ["resolved", "closed"].includes(ticket.status) && ticket.rating === null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" /> العودة لقائمة الطلبات
      </button>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                {statusBadge(ticket.status)}
                {priorityBadge(ticket.priority)}
              </div>
              <h3 className="text-base font-bold text-foreground mt-1 leading-tight">{ticket.subject}</h3>
            </div>
            {canReply && (
              <button
                onClick={() => cancelQ.mutate({ ticketId: ticket.id })}
                disabled={cancelQ.isPending}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 shrink-0 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />إلغاء
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">أُرسل: {fmtDate(ticket.submittedAt ?? ticket.createdAt)}</p>
        </div>

        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد رسائل بعد.</p>
          )}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.senderType === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm border border-border/40"
              }`}>
                {msg.senderType !== "user" && (
                  <p className="text-xs font-semibold mb-1 opacity-70">{msg.senderName ?? "فريق الدعم"}</p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                <p className="text-xs mt-1 opacity-60">{fmtDate(msg.sentAt)}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {canReply && (
          <div className="p-4 border-t border-border/40 bg-muted/10">
            <div className="flex gap-2">
              <Textarea
                placeholder="اكتب ردك هنا..."
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={2}
                className="resize-none flex-1"
                dir="rtl"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (reply.trim()) addReply.mutate({ ticketId: ticket.id, body: reply.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                className="self-end"
                disabled={!reply.trim() || addReply.isPending}
                onClick={() => addReply.mutate({ ticketId: ticket.id, body: reply.trim() })}
              >
                {addReply.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter للإرسال</p>
          </div>
        )}

        {canRate && (
          <div className="p-4 border-t border-border/40 bg-amber-50/50 dark:bg-amber-950/20">
            {!showRating ? (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">هل أُغلق طلبك بشكل مُرضٍ؟</p>
                <Button size="sm" variant="outline" onClick={() => setShowRating(true)}>
                  <Star className="w-4 h-4 ml-1 text-amber-500" /> تقييم الخدمة
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">قيِّم مستوى الخدمة</p>
                <StarRating value={ratingVal} onChange={setRatingVal} />
                <Textarea
                  placeholder="تعليق إضافي (اختياري)"
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                  dir="rtl"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowRating(false)}>إلغاء</Button>
                  <Button size="sm"
                    disabled={!ratingVal || rateQ.isPending}
                    onClick={() => rateQ.mutate({ ticketId: ticket.id, rating: ratingVal, comment: ratingComment || undefined })}
                  >
                    {rateQ.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إرسال التقييم"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {ticket.rating && (
          <div className="p-3 border-t border-border/40 bg-muted/20 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`w-4 h-4 ${n <= (ticket.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
              ))}
            </div>
            <span>تقييمك: {ticket.rating}/5</span>
            {ticket.rating && <span className="text-xs">· {ratingComment}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── قائمة التذاكر ─────────────────────────────────────────────────────────────
function TicketsList({ filter, onSelectTicket, onNewTicket }: {
  filter?: "unread";
  onSelectTicket: (id: number) => void;
  onNewTicket: () => void;
}) {
  const listQ  = trpc.supportTickets.listMyTickets.useQuery();
  const retryQ = trpc.supportTickets.retryOutbox.useMutation({
    onSuccess: (r) => { toast.success(`تم إعادة إرسال ${r.retried} طلب`); listQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const id = setInterval(() => listQ.refetch(), 30000);
    return () => clearInterval(id);
  }, []);

  const tickets: Ticket[] = (listQ.data ?? []) as Ticket[];
  const filtered = filter === "unread"
    ? tickets.filter(t => t.unreadReplies > 0)
    : tickets;

  if (listQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل...
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filter === "unread" ? `${filtered.length} طلب بردود جديدة` : `${filtered.length} طلب`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 ml-1 ${listQ.isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" variant="outline" onClick={() => retryQ.mutate()} disabled={retryQ.isPending}>
            <RotateCcw className="w-3.5 h-3.5 ml-1" />
            إعادة الإرسال
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center space-y-3">
          {filter === "unread" ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-semibold text-foreground">لا توجد ردود جديدة</p>
              <p className="text-sm text-muted-foreground">جميع ردود الدعم الفني تمت قراءتها.</p>
            </>
          ) : (
            <>
              <Inbox className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <p className="font-semibold text-foreground">لا توجد طلبات بعد</p>
              <p className="text-sm text-muted-foreground">ابدأ بإرسال طلب دعم فني جديد.</p>
              <Button size="sm" onClick={onNewTicket}><Plus className="w-3.5 h-3.5 ml-1" />طلب جديد</Button>
            </>
          )}
        </div>
      )}

      {filtered.map(ticket => (
        <button
          key={ticket.id}
          className="w-full text-right rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all active:scale-[.99]"
          onClick={() => onSelectTicket(ticket.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                {statusBadge(ticket.status)}
                {ticket.unreadReplies > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    <MessageSquare className="w-3 h-3" />
                    {ticket.unreadReplies} جديد
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {fmtDate(ticket.updatedAt)}
                <span className="mx-1">·</span>
                {CATEGORY_OPTS.find(c => c.value === ticket.category)?.label}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-1" />
          </div>
          {ticket.rating !== null && (
            <div className="flex items-center gap-1 mt-2">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`w-3.5 h-3.5 ${n <= (ticket.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function SupportRequestPage() {
  const [tab, setTab] = useState<Tab>("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const pollQ = trpc.supportTickets.pollReplies.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });

  const totalUnread = pollQ.data?.totalUnread ?? 0;

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "new",         label: "طلب جديد",      icon: Plus },
    { key: "my-tickets",  label: "طلباتي",         icon: FileText },
    { key: "new-replies", label: "الردود الجديدة", icon: MessageSquare, badge: totalUnread },
  ];

  function handleSelectTicket(id: number) {
    setSelectedTicketId(id);
  }

  function handleBack() {
    setSelectedTicketId(null);
  }

  if (selectedTicketId) {
    return (
      <div className="h-full overflow-y-auto bg-background p-6" dir="rtl">
        <TicketDetail ticketId={selectedTicketId} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
            <Headphones className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الدعم الفني</h1>
            <p className="text-sm text-muted-foreground mt-0.5">تواصل مع فريق الدعم وتابع طلباتك</p>
          </div>
        </div>

        <div className="flex gap-1 rounded-xl bg-muted/40 p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {t.badge! > 9 ? "9+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "new" && (
          <NewTicketForm onCreated={() => setTab("my-tickets")} />
        )}
        {tab === "my-tickets" && (
          <TicketsList onSelectTicket={handleSelectTicket} onNewTicket={() => setTab("new")} />
        )}
        {tab === "new-replies" && (
          <TicketsList filter="unread" onSelectTicket={handleSelectTicket} onNewTicket={() => setTab("new")} />
        )}
      </div>
    </div>
  );
}
