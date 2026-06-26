import { fmtDate } from "@/utils/dateUtils";
import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, ChevronLeft, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(date: string | Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  return fmtDate(d);
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const usersQuery = trpc.chat.listUsers.useQuery(undefined, { enabled: open });
  const unreadQuery = trpc.chat.unreadCount.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const recentQuery = trpc.chat.recentConversations.useQuery(undefined, {
    enabled: open,
    refetchInterval: 5000,
  });
  const conversationQuery = trpc.chat.getConversation.useQuery(
    { withUserId: selectedUserId! },
    { enabled: !!selectedUserId, refetchInterval: 3000 }
  );
  const sendMutation = trpc.chat.send.useMutation();
  const markReadMutation = trpc.chat.markRead.useMutation();
  const utils = trpc.useUtils();

  const totalUnread =
    unreadQuery.data?.reduce((sum, r) => sum + Number(r.count), 0) ?? 0;

  useEffect(() => {
    if (selectedUserId) {
      markReadMutation.mutate({ fromUserId: selectedUserId });
      utils.chat.unreadCount.invalidate();
    }
  }, [selectedUserId, conversationQuery.data]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationQuery.data]);

  useEffect(() => {
    if (selectedUserId) inputRef.current?.focus();
  }, [selectedUserId]);

  const selectedUser = usersQuery.data?.find((u) => u.id === selectedUserId);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !selectedUserId) return;
    const content = message.trim();
    setMessage("");
    await sendMutation.mutateAsync({ receiverId: selectedUserId, content });
    utils.chat.getConversation.invalidate({ withUserId: selectedUserId });
    utils.chat.recentConversations.invalidate();
  }, [message, selectedUserId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredUsers = (usersQuery.data ?? []).filter(
    (u) => u.id !== user?.id && u.name.toLowerCase().includes(search.toLowerCase())
  );

  const getUnreadFromUser = (userId: number) =>
    unreadQuery.data?.find((r) => r.senderId === userId)?.count ?? 0;

  const getRecentMessage = (userId: number) =>
    recentQuery.data?.find((r) => r.other_user === userId);

  return (
    <>
      {/* ─── زر الفتح ─── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-50 w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all duration-200 hover:scale-105"
        style={{ width: 52, height: 52 }}
      >
        <MessageCircle className="w-6 h-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* ─── نافذة المحادثة ─── */}
      {open && (
        <div
          className="fixed bottom-20 left-6 z-50 w-80 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: 480 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground">
            {selectedUserId ? (
              <>
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-white/20 text-white text-[10px] font-bold">
                    {initials(selectedUser?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedUser?.name}</p>
                </div>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                <span className="flex-1 font-semibold text-sm">المحادثات الداخلية</span>
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ─── قائمة المستخدمين ─── */}
          {!selectedUserId && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Search */}
              <div className="px-3 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث عن مستخدم..."
                    className="w-full bg-muted rounded-lg py-1.5 pr-8 pl-3 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  />
                </div>
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs">لا يوجد مستخدمون</p>
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const unread = getUnreadFromUser(u.id);
                    const recent = getRecentMessage(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-right border-b border-border/50 last:border-0"
                      >
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {u.name}
                            </p>
                            {recent && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {timeAgo(recent.created_at)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {recent
                              ? (recent.sender_id === user?.id ? `أنت: ${recent.content}` : recent.content)
                              : `ابدأ محادثة مع ${u.name}`}
                          </p>
                        </div>
                        {Number(unread) > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">
                            {unread}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ─── المحادثة ─── */}
          {selectedUserId && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {conversationQuery.isLoading && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {(conversationQuery.data ?? []).length === 0 && !conversationQuery.isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                    <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs text-center">لا توجد رسائل بعد<br />ابدأ المحادثة الآن</p>
                  </div>
                )}
                {(conversationQuery.data ?? []).map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-tl-sm"
                            : "bg-muted text-foreground rounded-tr-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"} text-left`}>
                          {timeAgo(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border px-3 py-2 flex items-center gap-2">
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 rotate-180" />
                </button>
                <input
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالة..."
                  className="flex-1 bg-muted rounded-full py-1.5 px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                  dir="rtl"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
