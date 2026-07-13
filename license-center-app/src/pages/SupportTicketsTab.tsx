import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  MessageSquare, RefreshCw, ChevronRight, Clock, CheckCircle2,
  AlertTriangle, XCircle, Loader2, Send, StickyNote, User,
} from "lucide-react";

const NAVY  = "#0F1D40";
const NAVY2 = "#1B2B5C";
const GOLD  = "#C9A84C";
const CREAM = "#F8F5EF";
const BORDER = "#E5DDD0";

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d as string);
    return dt.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })
      + " " + dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return String(d); }
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  open:        { label: "مفتوحة",        bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  in_progress: { label: "قيد المعالجة",  bg: "#FEF9C3", text: "#92400E", dot: "#F59E0B" },
  resolved:    { label: "محلولة",        bg: "#DCFCE7", text: "#166534", dot: "#22C55E" },
  closed:      { label: "مغلقة",         bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: "منخفض", color: "#6B7280" },
  normal: { label: "عادي",  color: "#3B82F6" },
  high:   { label: "مرتفع", color: "#F97316" },
  urgent: { label: "عاجل",  color: "#EF4444" },
};

const CATEGORY_MAP: Record<string, string> = {
  general:   "عام",
  technical: "مشكلة تقنية",
  billing:   "فاتورة / ترخيص",
  feature:   "اقتراح",
  urgent:    "عاجل",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

type Ticket = {
  id: number; ticketNumber: string; orgName: string | null; orgId: string | null;
  subject: string; description: string; category: string; priority: string;
  status: string; submitterName: string | null; assignedTo: string | null;
  createdAt: string; updatedAt: string;
};

type Message = {
  id: number; senderType: string; senderName: string | null;
  body: string; isReadByClient: boolean; isReadBySupport: boolean; createdAt: string;
};

type Note = { id: number; author: string | null; body: string; createdAt: string };

// ─── نافذة تفاصيل التذكرة ─────────────────────────────────────────────────────
function TicketDetail({
  ticketId, onBack,
}: { ticketId: number; onBack: () => void }) {
  const [replyBody, setReplyBody]   = useState("");
  const [noteBody, setNoteBody]     = useState("");
  const [showNote, setShowNote]     = useState(false);
  const [newStatus, setNewStatus]   = useState("");

  const detailQ = trpc.licenseCenter.getSupportTicket.useQuery(
    { ticketId }, { retry: false, refetchInterval: 15000 }
  );
  const replyQ = trpc.licenseCenter.replyToTicket.useMutation({
    onSuccess: () => { setReplyBody(""); detailQ.refetch(); },
  });
  const noteQ = trpc.licenseCenter.addInternalNote.useMutation({
    onSuccess: () => { setNoteBody(""); setShowNote(false); detailQ.refetch(); },
  });
  const statusQ = trpc.licenseCenter.updateTicketStatus.useMutation({
    onSuccess: () => { setNewStatus(""); detailQ.refetch(); },
  });

  if (detailQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2" style={{ color: "#9CA3AF" }}>
        <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل...
      </div>
    );
  }
  if (!detailQ.data) return null;

  const { ticket, messages, notes } = detailQ.data;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-medium hover:opacity-80 transition-opacity"
        style={{ color: GOLD }}
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        العودة لقائمة التذاكر
      </button>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
        <div className="px-5 py-4 border-b flex items-start gap-4" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[12px] font-mono" style={{ color: "#9CA3AF" }}>{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <span className="text-[12px] font-semibold" style={{ color: PRIORITY_MAP[ticket.priority]?.color ?? "#6B7280" }}>
                {PRIORITY_MAP[ticket.priority]?.label}
              </span>
            </div>
            <h3 className="text-[16px] font-extrabold leading-tight" style={{ color: NAVY2 }}>{ticket.subject}</h3>
            <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
              {ticket.orgName ?? ticket.orgId ?? "—"} · {ticket.submitterName ?? "—"} · {fmtDate(ticket.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              className="text-[12px] rounded-lg border px-2 py-1.5 bg-white"
              style={{ borderColor: BORDER, color: NAVY2 }}
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
            >
              <option value="">تغيير الحالة...</option>
              <option value="open">مفتوحة</option>
              <option value="in_progress">قيد المعالجة</option>
              <option value="resolved">محلولة</option>
              <option value="closed">مغلقة</option>
            </select>
            <button
              disabled={!newStatus || statusQ.isPending}
              onClick={() => statusQ.mutate({ ticketId: ticket.id, status: newStatus as any })}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: NAVY2 }}
            >
              {statusQ.isPending ? "..." : "حفظ"}
            </button>
          </div>
        </div>

        <div className="p-5 max-h-80 overflow-y-auto space-y-3">
          {messages.map((msg: Message) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderType === "support" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3 text-[13px]"
                style={msg.senderType === "support"
                  ? { backgroundColor: NAVY2, color: "white", borderBottomLeftRadius: "6px" }
                  : { backgroundColor: "#F3F4F6", color: NAVY2, borderBottomRightRadius: "6px" }
                }
              >
                <p className="font-semibold text-[11px] mb-1 opacity-70">
                  {msg.senderType === "support" ? "فريق الدعم" : msg.senderName ?? "العميل"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                <p className="text-[11px] mt-1.5 opacity-50">{fmtDate(msg.createdAt)}</p>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-[13px] py-6" style={{ color: "#9CA3AF" }}>لا رسائل بعد</p>
          )}
        </div>

        <div className="p-4 border-t" style={{ borderColor: BORDER }}>
          <div className="flex gap-2">
            <textarea
              className="flex-1 rounded-xl border px-3 py-2 text-[13px] resize-none outline-none focus:border-[#1B2B5C] transition-colors"
              style={{ borderColor: BORDER, color: NAVY2 }}
              rows={2}
              dir="rtl"
              placeholder="اكتب ردًّا على العميل..."
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
            />
            <button
              disabled={!replyBody.trim() || replyQ.isPending}
              onClick={() => replyQ.mutate({ ticketId: ticket.id, body: replyBody.trim() })}
              className="px-4 rounded-xl text-white text-[13px] font-bold disabled:opacity-40 transition-opacity hover:opacity-90 shrink-0"
              style={{ backgroundColor: NAVY2 }}
            >
              {replyQ.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-2" style={{ borderColor: BORDER }}>
          <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: NAVY2 }}>
            <StickyNote className="w-4 h-4" style={{ color: GOLD }} />
            الملاحظات الداخلية
          </p>
          {notes.map((n: Note) => (
            <div key={n.id} className="rounded-xl p-3 text-[12px]" style={{ backgroundColor: "rgba(201,168,76,0.08)", color: NAVY2 }}>
              <p className="font-semibold mb-0.5" style={{ color: GOLD }}>{n.author ?? "admin"} · {fmtDate(n.createdAt)}</p>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm p-4" style={{ borderColor: BORDER }}>
        {!showNote ? (
          <button
            className="text-[13px] font-medium flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}
            onClick={() => setShowNote(true)}
          >
            <StickyNote className="w-4 h-4" />
            إضافة ملاحظة داخلية
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold" style={{ color: NAVY2 }}>ملاحظة داخلية (لن تُرسَل للعميل)</p>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-[13px] resize-none outline-none"
              style={{ borderColor: BORDER, color: NAVY2 }}
              rows={3}
              dir="rtl"
              value={noteBody}
              onChange={e => setNoteBody(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="text-[12px] px-3 py-1.5 rounded-lg border font-medium"
                style={{ borderColor: BORDER, color: "#6B7280" }}
                onClick={() => setShowNote(false)}
              >
                إلغاء
              </button>
              <button
                disabled={!noteBody.trim() || noteQ.isPending}
                onClick={() => noteQ.mutate({ ticketId: ticket.id, body: noteBody.trim() })}
                className="text-[12px] px-3 py-1.5 rounded-lg text-white font-bold disabled:opacity-40"
                style={{ backgroundColor: NAVY2 }}
              >
                {noteQ.isPending ? "..." : "حفظ الملاحظة"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function SupportTicketsTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const listQ = trpc.licenseCenter.listSupportTickets.useQuery(
    { limit: 100 }, { retry: false, refetchInterval: 30000 }
  );
  const dashQ = trpc.licenseCenter.getSupportDashboard.useQuery(undefined, { retry: false });

  const tickets: Ticket[] = (listQ.data ?? []) as Ticket[];
  const filtered = statusFilter ? tickets.filter(t => t.status === statusFilter) : tickets;

  if (selectedId) {
    return (
      <div className="p-4" dir="rtl">
        <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div dir="rtl" className="p-4 space-y-4">
      {dashQ.data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "مفتوحة",        val: dashQ.data.open,       color: "#3B82F6" },
            { label: "قيد المعالجة",  val: dashQ.data.inProgress, color: "#F59E0B" },
            { label: "محلولة",        val: dashQ.data.resolved,   color: "#22C55E" },
            { label: "مغلقة",         val: dashQ.data.closed,     color: "#9CA3AF" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border p-4 text-center shadow-sm" style={{ borderColor: BORDER }}>
              <p className="text-[28px] font-black" style={{ color: c.color }}>{c.val}</p>
              <p className="text-[12px] font-semibold mt-0.5" style={{ color: "#6B7280" }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: BORDER, backgroundColor: "rgba(201,168,76,0.04)" }}>
          <MessageSquare className="w-4 h-4" style={{ color: GOLD }} />
          <h2 className="text-[15px] font-extrabold" style={{ color: NAVY2 }}>تذاكر الدعم الفني</h2>
          <span className="mr-auto text-[12px] px-2.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#DBEAFE", color: "#1D4ED8" }}>
            {filtered.length} تذكرة
          </span>

          <select
            className="text-[12px] rounded-lg border px-2 py-1.5 bg-white"
            style={{ borderColor: BORDER, color: NAVY2 }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="in_progress">قيد المعالجة</option>
            <option value="resolved">محلولة</option>
            <option value="closed">مغلقة</option>
          </select>

          <button
            onClick={() => listQ.refetch()}
            disabled={listQ.isFetching}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${listQ.isFetching ? "animate-spin" : ""}`} style={{ color: GOLD }} />
          </button>
        </div>

        {listQ.isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2" style={{ color: "#9CA3AF" }}>
            <Loader2 className="w-5 h-5 animate-spin" /> جارٍ التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: "#9CA3AF" }}>
            <CheckCircle2 className="w-8 h-8" />
            <p className="text-[13px] font-medium">لا توجد تذاكر بهذه الحالة</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: BORDER }}>
            {filtered.map(ticket => (
              <button
                key={ticket.id}
                className="w-full text-right px-5 py-3.5 hover:bg-gray-50/60 transition-colors flex items-center gap-4"
                onClick={() => setSelectedId(ticket.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[11px] font-mono" style={{ color: "#9CA3AF" }}>{ticket.ticketNumber}</span>
                    <StatusBadge status={ticket.status} />
                    <span className="text-[11px] font-semibold" style={{ color: PRIORITY_MAP[ticket.priority]?.color ?? "#6B7280" }}>
                      {PRIORITY_MAP[ticket.priority]?.label}
                    </span>
                    <span className="text-[11px]" style={{ color: "#9CA3AF" }}>{CATEGORY_MAP[ticket.category] ?? ticket.category}</span>
                  </div>
                  <p className="text-[14px] font-bold truncate" style={{ color: NAVY2 }}>{ticket.subject}</p>
                  <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "#9CA3AF" }}>
                    <User className="w-3 h-3" />
                    {ticket.orgName ?? ticket.orgId ?? "—"} · {ticket.submitterName ?? "—"} · {fmtDate(ticket.updatedAt)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#D1D5DB" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
