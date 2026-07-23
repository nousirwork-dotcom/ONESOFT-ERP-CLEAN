import { useEffect, useRef, useState } from "react";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import {
  Sparkles, Send, Loader2, Plus, Trash2, History, ShieldAlert,
  CheckCircle2, XCircle, ClipboardList, Settings2,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Textarea } from "@/core/ui/textarea";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { useLang } from "@/core/contexts/LanguageContext";
import { isAdminRole } from "@/shared/lib/aiPermissions";
import { toast } from "sonner";

// ─── المساعد الذكي — واجهة المحادثة ──────────────────────────────────────────

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ type: string; id: number; label?: string }>;
  proposal?: ProposalState | null;
};

type ProposalState = {
  id: number;
  actionType: string;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  title: string;
  details: string;
  assigneeUserId: number | null;
  assigneeName?: string | null;
  dueDate: string;
  dueTime: string;
  priority: "low" | "normal" | "high";
  resultMessage?: string;
};

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

export default function AIAssistantPage() {
  const { dir } = useLang();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const status = trpc.ai.getStatus.useQuery();
  const perms = status.data?.perms ?? {};
  const canHistory = perms["ai_view_history"] === true;
  const canDelete = perms["ai_delete_conversations"] === true;
  const canConfirm = perms["ai_confirm_tasks"] === true;
  const canManage = perms["ai_manage_settings"] === true || isAdminRole(user?.role);

  const conversations = trpc.ai.listConversations.useQuery(undefined, {
    enabled: canHistory && (status.data?.keepHistory ?? false),
  });

  const orgUsers = trpc.users.list.useQuery(undefined, { enabled: canConfirm });

  const ask = trpc.ai.ask.useMutation({
    onSuccess: (res) => {
      setConversationId(res.conversationId ?? null);
      setMessages((prev): ChatMsg[] => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: res.answer,
          sources: (res.sources ?? []) as ChatMsg["sources"],
          proposal: res.proposal
            ? {
                id: res.proposal.id,
                actionType: res.proposal.actionType,
                status: "pending",
                title: String(res.proposal.payload?.title ?? ""),
                details: String(res.proposal.payload?.details ?? ""),
                assigneeUserId: res.proposal.payload?.assigneeUserId ?? null,
                assigneeName: res.proposal.payload?.assigneeName ?? null,
                dueDate: String(res.proposal.payload?.dueDate ?? ""),
                dueTime: String(res.proposal.payload?.dueTime ?? ""),
                priority: (["low", "normal", "high"].includes(res.proposal.payload?.priority)
                  ? res.proposal.payload.priority
                  : "normal") as ProposalState["priority"],
              }
            : null,
        } as ChatMsg,
      ]);
      if (canHistory) utils.ai.listConversations.invalidate();
    },
    onError: (e) => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: `⚠ ${e.message}` },
      ]);
    },
  });

  const confirmProposal = trpc.ai.confirmProposal.useMutation();
  const cancelProposal = trpc.ai.cancelProposal.useMutation();
  const deleteConversation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      utils.ai.listConversations.invalidate();
      toast.success("تم حذف المحادثة");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ask.isPending]);

  const handleSend = () => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: q }]);
    setQuestion("");
    ask.mutate({ question: q, conversationId });
  };

  const openConversation = async (convId: number) => {
    try {
      const rows = await utils.ai.getMessages.fetch({ conversationId: convId });
      setConversationId(convId);
      setMessages(
        rows.map((m: any) => ({
          id: `db${m.id}`,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          sources: m.sources ?? [],
        })),
      );
      setShowHistory(false);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر فتح المحادثة");
    }
  };

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const updateProposal = (msgId: string, patch: Partial<ProposalState>) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.proposal ? { ...m, proposal: { ...m.proposal, ...patch } } : m,
      ),
    );
  };

  const handleConfirm = (msg: ChatMsg) => {
    const p = msg.proposal!;
    if (!p.title.trim() || p.title.trim().length < 2) {
      toast.error("عنوان المهمة مطلوب (حرفان على الأقل)");
      return;
    }
    confirmProposal.mutate(
      {
        proposalId: p.id,
        title: p.title.trim(),
        details: p.details.trim(),
        assigneeUserId: p.assigneeUserId,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : null,
        dueTime: /^\d{2}:\d{2}$/.test(p.dueTime) ? p.dueTime : null,
        priority: p.priority,
      },
      {
        onSuccess: (res) => {
          updateProposal(msg.id, { status: "confirmed", resultMessage: `تم إنشاء المهمة #${res.taskId}` });
          toast.success(`تم إنشاء المهمة #${res.taskId}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleCancel = (msg: ChatMsg) => {
    cancelProposal.mutate(
      { proposalId: msg.proposal!.id },
      {
        onSuccess: () => updateProposal(msg.id, { status: "cancelled" }),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  // ── حالات المنع ───────────────────────────────────────────────────────────
  if (status.isLoading) {
    return (
      <div className="h-full flex items-center justify-center" dir={dir}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.data && !status.data.licenseAllowed) {
    return (
      <BlockedState
        dir={dir}
        icon={ShieldAlert}
        title="المساعد الذكي غير مفعّل في ترخيصك"
        desc="ميزة «المساعد الذكي» غير مشمولة في الترخيص الحالي. تواصل مع مزود النظام لتفعيلها."
      />
    );
  }

  if (status.data && (!status.data.configured || !status.data.enabled)) {
    return (
      <BlockedState
        dir={dir}
        icon={Settings2}
        title="المساعد الذكي غير مُعد بعد"
        desc={
          canManage
            ? "أدخل بيانات مزود الذكاء الاصطناعي وفعّل الخدمة من: الإعدادات ← المساعد الذكي."
            : "لم يقم مدير النظام بإعداد خدمة الذكاء الاصطناعي بعد. تواصل مع مدير النظام."
        }
      />
    );
  }

  const priorityLabels: Record<string, string> = { low: "منخفضة", normal: "عادية", high: "عالية" };

  return (
    <div className="h-full flex flex-col bg-background" dir={dir}>
      {/* ── الشريط العلوي ── */}
      <div className="border-b px-4 py-2.5 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
          <Sparkles className="w-4.5 h-4.5 w-[18px] h-[18px] text-fuchsia-600 dark:text-fuchsia-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">المساعد الذكي</p>
          <p className="text-[11px] text-muted-foreground">يجيب من بيانات النظام حسب صلاحياتك — العمليات تتطلب تأكيدك</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={newConversation} data-testid="button-ai-new-chat">
          <Plus className="w-3.5 h-3.5" /> محادثة جديدة
        </Button>
        {canHistory && (status.data?.keepHistory ?? false) && (
          <Button
            size="sm"
            variant={showHistory ? "default" : "outline"}
            className="gap-1"
            onClick={() => setShowHistory((v) => !v)}
            data-testid="button-ai-history"
          >
            <History className="w-3.5 h-3.5" /> السجل
          </Button>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ── قائمة المحادثات ── */}
        {showHistory && (
          <div className="w-64 border-e shrink-0 overflow-y-auto p-2 space-y-1">
            {(conversations.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد محادثات محفوظة</p>
            )}
            {(conversations.data ?? []).map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg px-2.5 py-2 cursor-pointer text-xs hover:bg-muted/60 ${
                  c.id === conversationId ? "bg-muted" : ""
                }`}
                onClick={() => openConversation(c.id)}
                data-testid={`row-ai-conversation-${c.id}`}
              >
                <span className="flex-1 truncate">{c.title || "محادثة"}</span>
                {canDelete && (
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation.mutate({ conversationId: c.id });
                      if (c.id === conversationId) newConversation();
                    }}
                    data-testid={`button-ai-delete-conv-${c.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── الرسائل ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                <Sparkles className="w-10 h-10 text-fuchsia-500/40" />
                <div>
                  <p className="text-sm font-semibold text-foreground">اسأل المساعد الذكي</p>
                  <p className="text-xs mt-1 max-w-sm leading-relaxed">
                    مثال: «ما المهام المتأخرة هذه الأسبوع؟» أو «أنشئ مهمة متابعة للعميل غدًا الساعة 10»
                  </p>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                  data-testid={`msg-ai-${m.role}`}
                >
                  {m.content}

                  {m.role === "assistant" && (m.sources?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 border-t pt-1.5">
                      المصادر: {m.sources!.slice(0, 6).map((s) => s.label ?? `${s.type}#${s.id}`).join("، ")}
                    </p>
                  )}

                  {/* ── بطاقة اقتراح مهمة ── */}
                  {m.proposal && (
                    <Card className="mt-3 border-fuchsia-500/30 bg-background">
                      <CardContent className="p-3 space-y-2.5">
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                          اقتراح: إنشاء مهمة جديدة
                        </p>

                        {m.proposal.status === "pending" ? (
                          <>
                            <div className="space-y-2">
                              <div>
                                <Label className="text-[11px]">العنوان</Label>
                                <Input
                                  value={m.proposal.title}
                                  onChange={(e) => updateProposal(m.id, { title: e.target.value })}
                                  className="h-8 text-xs mt-0.5"
                                  data-testid="input-ai-proposal-title"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px]">التفاصيل</Label>
                                <Textarea
                                  value={m.proposal.details}
                                  onChange={(e) => updateProposal(m.id, { details: e.target.value })}
                                  className="text-xs mt-0.5 min-h-[52px]"
                                  data-testid="input-ai-proposal-details"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px]">تاريخ الاستحقاق</Label>
                                  <DateSegmentInput
                                    value={m.proposal.dueDate}
                                    onChange={(v) => updateProposal(m.id, { dueDate: v })}
                                    standalone className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[11px]">الوقت</Label>
                                  <Input
                                    type="time"
                                    value={m.proposal.dueTime}
                                    onChange={(e) => updateProposal(m.id, { dueTime: e.target.value })}
                                    className="h-8 text-xs mt-0.5"
                                    data-testid="input-ai-proposal-due-time"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px]">الأولوية</Label>
                                  <Select
                                    value={m.proposal.priority}
                                    onValueChange={(v) => updateProposal(m.id, { priority: v as ProposalState["priority"] })}
                                  >
                                    <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-ai-proposal-priority">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(["low", "normal", "high"] as const).map((p) => (
                                        <SelectItem key={p} value={p}>{priorityLabels[p]}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {canConfirm && (
                                  <div>
                                    <Label className="text-[11px]">المسؤول</Label>
                                    <Select
                                      value={m.proposal.assigneeUserId ? String(m.proposal.assigneeUserId) : "none"}
                                      onValueChange={(v) =>
                                        updateProposal(m.id, { assigneeUserId: v === "none" ? null : Number(v) })
                                      }
                                    >
                                      <SelectTrigger className="h-8 text-xs mt-0.5" data-testid="select-ai-proposal-assignee">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">بدون مسؤول</SelectItem>
                                        {(orgUsers.data ?? [])
                                          .filter((u: any) => u.isActive !== false)
                                          .map((u: any) => (
                                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 pt-1">
                              {canConfirm ? (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleConfirm(m)}
                                  disabled={confirmProposal.isPending}
                                  data-testid="button-ai-proposal-confirm"
                                >
                                  {confirmProposal.isPending
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <CheckCircle2 className="w-3 h-3" />}
                                  تأكيد الإنشاء
                                </Button>
                              ) : (
                                <p className="text-[11px] text-amber-600 flex-1">
                                  لا تملك صلاحية تأكيد إنشاء المهام — اطلبها من مدير النظام.
                                </p>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleCancel(m)}
                                disabled={cancelProposal.isPending}
                                data-testid="button-ai-proposal-cancel"
                              >
                                <XCircle className="w-3 h-3" /> إلغاء
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p
                            className={`text-xs flex items-center gap-1.5 ${
                              m.proposal.status === "confirmed" ? "text-emerald-600" : "text-muted-foreground"
                            }`}
                            data-testid="text-ai-proposal-result"
                          >
                            {m.proposal.status === "confirmed" ? (
                              <><CheckCircle2 className="w-3.5 h-3.5" />{m.proposal.resultMessage ?? "تم تنفيذ الاقتراح"}</>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5" />تم إلغاء الاقتراح</>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ))}

            {ask.isPending && (
              <div className="flex justify-end">
                <div className="bg-muted rounded-2xl px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── إدخال السؤال ── */}
          <div className="border-t p-3 shrink-0">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اكتب سؤالك هنا…"
                maxLength={4000}
                disabled={ask.isPending}
                data-testid="input-ai-question"
              />
              <Button onClick={handleSend} disabled={ask.isPending || !question.trim()} className="gap-1" data-testid="button-ai-send">
                {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال
              </Button>
            </div>
            {!(status.data?.keepHistory ?? true) && (
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                حفظ المحادثات معطّل من الإعدادات — لن تُخزَّن هذه المحادثة.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockedState({
  dir, icon: Icon, title, desc,
}: { dir: string; icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-background px-6" dir={dir}>
      <div className="text-center max-w-md">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-base font-bold" data-testid="text-ai-blocked-title">{title}</p>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
