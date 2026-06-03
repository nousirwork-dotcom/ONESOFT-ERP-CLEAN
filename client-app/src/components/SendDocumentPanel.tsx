/**
 * SendDocumentPanel.tsx — إرسال المستندات إلكترونياً
 * يدعم: WhatsApp | Telegram | البريد الإلكتروني
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  X, Send, MessageCircle, Mail, Clock,
  CheckCircle, AlertCircle, Loader2, ExternalLink,
} from "lucide-react";

/* ── TelegramIcon (لا تحتوي lucide على Telegram) ─── */
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

/* ══════════════════════════════════════════════════════════════════ */
export interface SendDocumentPanelProps {
  open: boolean;
  onClose: () => void;
  docType: string;
  docId?: number;
  docNumber: string;
  docTypeName: string;
  amount: string;
  currency?: string;
  customerId?: number;
  customerName?: string;
}

type Channel = "whatsapp" | "telegram" | "email";

const METHOD_LABELS: Record<string, string> = {
  whatsapp: "واتساب", telegram: "تيليجرام", email: "بريد",
};
const STATUS_LABELS: Record<string, string> = {
  sent: "تم الإرسال", failed: "فشل", pending: "بانتظار",
};

/* ══════════════════════════════════════════════════════════════════ */
export default function SendDocumentPanel({
  open, onClose, docType, docId, docNumber, docTypeName, amount,
  currency = "SAR", customerId, customerName = "العميل",
}: SendDocumentPanelProps) {

  const [activeTab, setActiveTab] = useState<Channel>("whatsapp");
  const [waPhone,   setWaPhone]   = useState("");
  const [tgId,      setTgId]      = useState("");
  const [email,     setEmail]     = useState("");
  const [waMsg,     setWaMsg]     = useState("");
  const [tgMsg,     setTgMsg]     = useState("");
  const [emailMsg,  setEmailMsg]  = useState("");
  const [emailSubj, setEmailSubj] = useState("");
  const [isSending, setIsSending] = useState(false);

  const utils = trpc.useUtils();

  /* ── جلب بيانات العميل ──── */
  const { data: customers } = trpc.customers.list.useQuery(undefined, { staleTime: 60000 });
  const customer = customerId ? customers?.find(c => c.id === customerId) : null;

  /* ── جلب إعدادات الإرسال ── */
  const { data: cfg } = trpc.documentSend.getSettings.useQuery();

  /* ── سجل الإرسال لهذا المستند ── */
  const { data: logs, refetch: refetchLogs } = trpc.documentSend.getLogs.useQuery(
    { docType, docId, limit: 15 },
    { enabled: open }
  );

  /* ── تعبئة بيانات العميل ── */
  useEffect(() => {
    if (customer) {
      setWaPhone((customer as any).whatsappPhone || customer.phone || "");
      setTgId((customer as any).telegramId || "");
      setEmail(customer.email || "");
    }
  }, [customer]);

  /* ── قوالب الرسائل الافتراضية ── */
  const defaultMsg = `عزيزي ${customerName}،\nمرفق لكم ${docTypeName} رقم ${docNumber}\nبمبلغ ${amount} ${currency}.\n\nشكراً لتعاملكم معنا.`;
  const defaultSubj = `${docTypeName} رقم ${docNumber}`;

  useEffect(() => {
    if (!waMsg)   setWaMsg(cfg?.whatsappMessageTemplate?.replace(/\{\{customerName\}\}/g, customerName)?.replace(/\{\{docTypeName\}\}/g, docTypeName)?.replace(/\{\{docNumber\}\}/g, docNumber)?.replace(/\{\{amount\}\}/g, amount)?.replace(/\{\{currency\}\}/g, currency) || defaultMsg);
    if (!tgMsg)   setTgMsg(cfg?.telegramMessageTemplate?.replace(/\{\{customerName\}\}/g, customerName)?.replace(/\{\{docTypeName\}\}/g, docTypeName)?.replace(/\{\{docNumber\}\}/g, docNumber)?.replace(/\{\{amount\}\}/g, amount)?.replace(/\{\{currency\}\}/g, currency) || defaultMsg);
    if (!emailMsg) setEmailMsg(defaultMsg);
    if (!emailSubj) setEmailSubj(defaultSubj);
  }, [cfg, customerName, docNumber, amount]);

  /* ── mutations ── */
  const sendWA = trpc.documentSend.sendWhatsApp.useMutation();
  const sendTG = trpc.documentSend.sendTelegram.useMutation();
  const sendEM = trpc.documentSend.sendEmail.useMutation();

  const baseInput = { docType, docId, docNumber, docTypeName, amount, currency, customerName };

  const handleSendWA = async () => {
    if (!waPhone.trim()) { toast.error("أدخل رقم الواتساب"); return; }
    setIsSending(true);
    try {
      const res = await sendWA.mutateAsync({ ...baseInput, customerPhone: waPhone.trim(), customMessage: waMsg });
      toast.success("جاري فتح واتساب...");
      window.open(res.waUrl, "_blank");
      await refetchLogs();
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSending(false); }
  };

  const handleSendTG = async () => {
    if (!tgId.trim()) { toast.error("أدخل معرّف تيليجرام"); return; }
    setIsSending(true);
    try {
      const res = await sendTG.mutateAsync({ ...baseInput, telegramId: tgId.trim(), customMessage: tgMsg });
      if (res.status === "sent") {
        toast.success("تم الإرسال عبر تيليجرام ✓");
      } else if (res.tgUrl) {
        toast.info("يتطلب ضبط Bot Token — جاري فتح المحادثة");
        window.open(res.tgUrl, "_blank");
      } else {
        toast.warning("أضف Telegram Bot Token في الإعدادات لإرسال تلقائي");
      }
      await refetchLogs();
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSending(false); }
  };

  const handleSendEmail = async () => {
    if (!email.trim()) { toast.error("أدخل البريد الإلكتروني"); return; }
    setIsSending(true);
    try {
      const res = await sendEM.mutateAsync({ ...baseInput, customerEmail: email.trim(), customMessage: emailMsg, customSubject: emailSubj });
      if (res.status === "sent") {
        toast.success("تم إرسال البريد الإلكتروني ✓");
      } else {
        toast.warning("تحقق من إعدادات البريد الإلكتروني في الإعدادات");
      }
      await refetchLogs();
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSending(false); }
  };

  if (!open) return null;

  /* ─── Render ─── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-[#406B93] rounded-t-xl">
          <Send className="w-5 h-5 text-white/80" />
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">إرسال المستند</h2>
            <p className="text-white/60 text-xs">{docTypeName} — {docNumber} | {customerName}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Channel)} className="flex flex-col h-full">
            <div className="px-5 pt-3 border-b border-border shrink-0">
              <TabsList className="w-full grid grid-cols-4 h-9 bg-muted/50">
                <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />واتساب
                  {cfg?.whatsappEnabled === false && <span className="text-[9px] text-muted-foreground">(معطل)</span>}
                </TabsTrigger>
                <TabsTrigger value="telegram" className="text-xs gap-1.5">
                  <TelegramIcon className="w-3.5 h-3.5 text-blue-500" />تيليجرام
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-500" />البريد
                </TabsTrigger>
                <TabsTrigger value="log" className="text-xs gap-1.5">
                  <Clock className="w-3.5 h-3.5" />السجل
                  {(logs?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{logs?.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              {/* ── واتساب ── */}
              <TabsContent value="whatsapp" className="p-5 space-y-4 m-0">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                  <MessageCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-green-800">
                    <p className="font-semibold">إرسال عبر WhatsApp Web</p>
                    <p className="mt-0.5 text-green-700">يفتح تطبيق واتساب مع الرسالة جاهزة للإرسال</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">رقم الواتساب <span className="text-red-500">*</span></Label>
                  <Input
                    value={waPhone} onChange={e => setWaPhone(e.target.value)}
                    placeholder="05xxxxxxxx أو +9665xxxxxxxx"
                    className="mt-1 text-sm font-mono" dir="ltr"
                  />
                </div>
                <div>
                  <Label className="text-xs">نص الرسالة</Label>
                  <Textarea
                    value={waMsg} onChange={e => setWaMsg(e.target.value)}
                    rows={6} className="mt-1 text-sm resize-none"
                    placeholder="اكتب رسالتك هنا..."
                  />
                </div>
                <Button
                  onClick={handleSendWA}
                  disabled={isSending || !waPhone.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  إرسال عبر واتساب
                </Button>
              </TabsContent>

              {/* ── تيليجرام ── */}
              <TabsContent value="telegram" className="p-5 space-y-4 m-0">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <TelegramIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold">إرسال عبر Telegram</p>
                    <p className="mt-0.5 text-blue-700">
                      {cfg?.telegramBotToken
                        ? "✓ Bot Token مُهيَّأ — الإرسال تلقائي"
                        : "أضف Bot Token في الإعدادات للإرسال التلقائي، أو استخدم رابط @username لفتح المحادثة"}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">معرّف تيليجرام <span className="text-red-500">*</span></Label>
                  <Input
                    value={tgId} onChange={e => setTgId(e.target.value)}
                    placeholder="@username أو Chat ID الرقمي"
                    className="mt-1 text-sm font-mono" dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    مثال: @ahmed123 أو 123456789
                  </p>
                </div>
                <div>
                  <Label className="text-xs">نص الرسالة</Label>
                  <Textarea
                    value={tgMsg} onChange={e => setTgMsg(e.target.value)}
                    rows={6} className="mt-1 text-sm resize-none"
                  />
                </div>
                <Button
                  onClick={handleSendTG}
                  disabled={isSending || !tgId.trim()}
                  className="w-full gap-2" style={{ background: "#229ED9" }}
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TelegramIcon className="w-4 h-4" />}
                  {cfg?.telegramBotToken ? "إرسال عبر تيليجرام" : "فتح محادثة تيليجرام"}
                </Button>
              </TabsContent>

              {/* ── البريد الإلكتروني ── */}
              <TabsContent value="email" className="p-5 space-y-4 m-0">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <Mail className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800">
                    <p className="font-semibold">إرسال بريد إلكتروني</p>
                    <p className="mt-0.5 text-orange-700">
                      {cfg?.emailEnabled
                        ? "✓ البريد مُهيَّأ — الإرسال تلقائي"
                        : "فعّل البريد وأضف API Key في الإعدادات → إعدادات الإرسال"}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">البريد الإلكتروني للعميل <span className="text-red-500">*</span></Label>
                  <Input
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    type="email" className="mt-1 text-sm font-mono" dir="ltr"
                  />
                </div>
                <div>
                  <Label className="text-xs">الموضوع</Label>
                  <Input
                    value={emailSubj} onChange={e => setEmailSubj(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">نص الرسالة</Label>
                  <Textarea
                    value={emailMsg} onChange={e => setEmailMsg(e.target.value)}
                    rows={5} className="mt-1 text-sm resize-none"
                  />
                </div>
                <Button
                  onClick={handleSendEmail}
                  disabled={isSending || !email.trim()}
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  إرسال البريد الإلكتروني
                </Button>
              </TabsContent>

              {/* ── السجل ── */}
              <TabsContent value="log" className="p-5 m-0">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  سجل الإرسال لهذا المستند
                </h3>
                {!logs || logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Clock className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">لا يوجد سجل إرسال بعد</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card text-xs">
                        <div className="mt-0.5">
                          {log.status === "sent"
                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                            : log.status === "failed"
                            ? <AlertCircle className="w-4 h-4 text-red-500" />
                            : <Clock className="w-4 h-4 text-yellow-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-4">
                              {METHOD_LABELS[log.method] ?? log.method}
                            </Badge>
                            <Badge
                              className={`text-[10px] h-4 ${
                                log.status === "sent" ? "bg-green-100 text-green-700"
                                : log.status === "failed" ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"}`}
                              variant="secondary"
                            >
                              {STATUS_LABELS[log.status] ?? log.status}
                            </Badge>
                            <span className="text-muted-foreground">{log.recipientContact}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">
                            {new Date(log.sentAt).toLocaleDateString("ar-SA")}
                            {" — "}
                            {new Date(log.sentAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {log.errorMessage && (
                            <p className="text-red-500 mt-1 truncate">{log.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
