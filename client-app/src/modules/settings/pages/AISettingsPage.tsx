import { useEffect, useState } from "react";
import {
  Sparkles, Loader2, PlugZap, Save, KeyRound, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { trpc } from "@/shared/lib/trpc";
import { fmtDate } from "@/shared/utils/dateUtils";
import { toast } from "sonner";

// ─── إعدادات المساعد الذكي (صلاحية ai_manage_settings) ───────────────────────

const PROVIDER_PRESETS: Array<{ id: string; label: string; baseUrl: string; model: string }> = [
  { id: "openai",     label: "OpenAI",              baseUrl: "https://api.openai.com/v1",            model: "gpt-4o-mini" },
  { id: "openrouter", label: "OpenRouter",          baseUrl: "https://openrouter.ai/api/v1",         model: "openai/gpt-4o-mini" },
  { id: "deepseek",   label: "DeepSeek",            baseUrl: "https://api.deepseek.com/v1",          model: "deepseek-chat" },
  { id: "groq",       label: "Groq",                baseUrl: "https://api.groq.com/openai/v1",       model: "llama-3.3-70b-versatile" },
  { id: "custom",     label: "مخصص (متوافق OpenAI)", baseUrl: "",                                     model: "" },
];

type FormState = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  allowOrgData: boolean;
  keepHistory: boolean;
  retentionDays: number;
};

export default function AISettingsPage() {
  const utils = trpc.useUtils();
  const settings = trpc.ai.getSettings.useQuery(undefined, { retry: false });

  const [form, setForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data && !form) {
      setForm({
        enabled:       settings.data.enabled,
        provider:      settings.data.provider,
        baseUrl:       settings.data.baseUrl,
        model:         settings.data.model,
        apiKey:        "",
        maxTokens:     settings.data.maxTokens,
        temperature:   settings.data.temperature,
        allowOrgData:  settings.data.allowOrgData,
        keepHistory:   settings.data.keepHistory,
        retentionDays: settings.data.retentionDays,
      });
    }
  }, [settings.data, form]);

  const saveSettings = trpc.ai.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ إعدادات المساعد الذكي");
      setDirty(false);
      setForm((f) => (f ? { ...f, apiKey: "" } : f));
      utils.ai.getSettings.invalidate();
      utils.ai.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const testConnection = trpc.ai.testConnection.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      utils.ai.getSettings.invalidate();
      utils.ai.getStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setDirty(true);
  };

  const applyPreset = (id: string) => {
    const p = PROVIDER_PRESETS.find((x) => x.id === id);
    if (!p || !form) return;
    setForm({
      ...form,
      provider: p.id,
      baseUrl: p.id === "custom" ? form.baseUrl : p.baseUrl,
      model: p.id === "custom" ? form.model : p.model,
    });
    setDirty(true);
  };

  const handleSave = () => {
    if (!form) return;
    if (!form.baseUrl.trim() || !/^https?:\/\//.test(form.baseUrl.trim())) {
      toast.error("رابط الخدمة (Base URL) غير صحيح");
      return;
    }
    if (!form.model.trim()) {
      toast.error("اسم النموذج مطلوب");
      return;
    }
    if (!settings.data?.hasApiKey && !form.apiKey.trim()) {
      toast.error("مفتاح API مطلوب عند الإعداد لأول مرة");
      return;
    }
    saveSettings.mutate({
      enabled:       form.enabled,
      provider:      form.provider,
      baseUrl:       form.baseUrl.trim(),
      model:         form.model.trim(),
      apiKey:        form.apiKey.trim() || undefined,
      maxTokens:     form.maxTokens,
      temperature:   form.temperature,
      allowOrgData:  form.allowOrgData,
      keepHistory:   form.keepHistory,
      retentionDays: form.retentionDays,
    });
  };

  if (settings.isLoading || !form) {
    if (settings.error) {
      return (
        <div className="p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-3" />
          <p className="text-sm text-muted-foreground">{settings.error.message}</p>
        </div>
      );
    }
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
          <Sparkles className="w-[22px] h-[22px] text-fuchsia-600 dark:text-fuchsia-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">إعدادات المساعد الذكي</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ربط النظام بمزود ذكاء اصطناعي متوافق مع OpenAI. المفتاح يُحفظ مشفّرًا ولا يُعرض مرة أخرى.
          </p>
        </div>
      </div>

      {/* ── حالة الاتصال ── */}
      {(settings.data?.lastError || settings.data?.lastOkAt) && (
        <div
          className={`text-xs rounded-lg border px-3 py-2.5 flex items-center gap-2 ${
            settings.data.lastError
              ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
              : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          }`}
          data-testid="text-ai-connection-status"
        >
          {settings.data.lastError ? (
            <><AlertTriangle className="w-4 h-4 shrink-0" />آخر خطأ: {settings.data.lastError}</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 shrink-0" />آخر اتصال ناجح: {fmtDate(settings.data.lastOkAt as any)}</>
          )}
        </div>
      )}

      {/* ── التفعيل ── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">تفعيل المساعد الذكي</p>
            <p className="text-xs text-muted-foreground mt-0.5">عند الإيقاف لا يستطيع أي مستخدم استخدام المساعد.</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} data-testid="switch-ai-enabled" />
        </CardContent>
      </Card>

      {/* ── المزود ── */}
      <Card>
        <CardContent className="p-4 space-y-3.5">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <PlugZap className="w-4 h-4 text-muted-foreground" /> مزود الخدمة
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">المزود</Label>
              <Select value={form.provider} onValueChange={applyPreset}>
                <SelectTrigger className="mt-1" data-testid="select-ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">النموذج (Model)</Label>
              <Input
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                dir="ltr"
                className="mt-1 text-left"
                placeholder="gpt-4o-mini"
                data-testid="input-ai-model"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">رابط الخدمة (Base URL)</Label>
            <Input
              value={form.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              dir="ltr"
              className="mt-1 text-left"
              placeholder="https://api.openai.com/v1"
              data-testid="input-ai-base-url"
            />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> مفتاح API
              {settings.data?.hasApiKey && (
                <span className="text-[10px] text-muted-foreground font-normal" dir="ltr">
                  (محفوظ: {settings.data.apiKeyMasked})
                </span>
              )}
            </Label>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(e) => set("apiKey", e.target.value)}
              dir="ltr"
              className="mt-1 text-left"
              placeholder={settings.data?.hasApiKey ? "اتركه فارغًا للإبقاء على المفتاح الحالي" : "sk-…"}
              autoComplete="new-password"
              data-testid="input-ai-api-key"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">أقصى عدد Tokens للرد</Label>
              <Input
                type="number"
                min={64}
                max={32000}
                value={form.maxTokens}
                onChange={(e) => set("maxTokens", Math.max(64, Math.min(32000, Number(e.target.value) || 1024)))}
                dir="ltr"
                className="mt-1 text-left"
                data-testid="input-ai-max-tokens"
              />
            </div>
            <div>
              <Label className="text-xs">درجة الإبداع (Temperature: 0–2)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={form.temperature}
                onChange={(e) => set("temperature", Math.max(0, Math.min(2, Number(e.target.value) || 0)))}
                dir="ltr"
                className="mt-1 text-left"
                data-testid="input-ai-temperature"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── الخصوصية والاحتفاظ ── */}
      <Card>
        <CardContent className="p-4 space-y-3.5">
          <p className="text-sm font-semibold">الخصوصية والاحتفاظ بالبيانات</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">السماح بإرسال بيانات المؤسسة للمزود</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                عند الإيقاف يجيب المساعد بمعرفة عامة فقط دون الاطلاع على بيانات النظام.
              </p>
            </div>
            <Switch checked={form.allowOrgData} onCheckedChange={(v) => set("allowOrgData", v)} data-testid="switch-ai-allow-org-data" />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <p className="text-sm">حفظ سجل المحادثات</p>
              <p className="text-xs text-muted-foreground mt-0.5">عند الإيقاف لا تُخزَّن أي محادثات في قاعدة البيانات.</p>
            </div>
            <Switch checked={form.keepHistory} onCheckedChange={(v) => set("keepHistory", v)} data-testid="switch-ai-keep-history" />
          </div>

          {form.keepHistory && (
            <div className="border-t pt-3">
              <Label className="text-xs">مدة الاحتفاظ بالمحادثات (أيام)</Label>
              <Input
                type="number"
                min={1}
                max={3650}
                value={form.retentionDays}
                onChange={(e) => set("retentionDays", Math.max(1, Math.min(3650, Number(e.target.value) || 90)))}
                dir="ltr"
                className="mt-1 text-left w-40"
                data-testid="input-ai-retention-days"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── الأزرار ── */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saveSettings.isPending || !dirty} className="gap-1.5" data-testid="button-ai-save-settings">
          {saveSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ الإعدادات
        </Button>
        <Button
          variant="outline"
          onClick={() => testConnection.mutate()}
          disabled={testConnection.isPending || dirty || !settings.data?.hasApiKey}
          className="gap-1.5"
          data-testid="button-ai-test-connection"
        >
          {testConnection.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          اختبار الاتصال
        </Button>
        {dirty && <p className="text-xs text-amber-600 self-center">احفظ التغييرات أولًا قبل اختبار الاتصال.</p>}
      </div>
    </div>
  );
}
