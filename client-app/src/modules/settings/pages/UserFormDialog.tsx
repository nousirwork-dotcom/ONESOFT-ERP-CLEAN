import * as React from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import { useModalAttention } from "./useModalAttention";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";
import { DEFAULT_USER_TOOLS } from "@/components/unified-toolbar/toolbar.constants";
import type { ToolbarActionMap, ToolbarToolItem } from "@/components/unified-toolbar/toolbar.types";

export type UserFormTab = "basic" | "contact" | "login" | "work" | "permissions";

export type UserLoginMethod = 'username' | 'username_or_email' | 'email';

export interface UserFormValue {
  code?: string;
  fullName: string;
  loginName: string;
  userType: string;
  categoryId?: string;
  mobile?: string;
  email?: string;
  allowLogin: boolean;
  loginMethod: UserLoginMethod;
  password?: string;
}

interface UserFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialValue: UserFormValue;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: UserFormValue) => Promise<void>;
  categories: Array<{ id: number; name: string; autoNumbering: boolean }>;
  loginTabExtension?: React.ReactNode;
  workTabContent?: React.ReactNode;
  permissionsTabContent?: React.ReactNode;
  // ── Toolbar callbacks ───────────────────────────────────────────────────────
  onToolbarNew?: () => void;
  onToolbarCopy?: () => void;
  onToolbarDelete?: () => void;
  onToolbarFirst?: () => void;
  onToolbarPrev?: () => void;
  onToolbarNext?: () => void;
  onToolbarLast?: () => void;
  toolbarRecord?: number;
  toolbarTotal?: number;
}

const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

export function UserFormDialog({
  open,
  mode,
  initialValue,
  onOpenChange,
  onSubmit,
  categories,
  loginTabExtension,
  workTabContent,
  permissionsTabContent,
  onToolbarNew,
  onToolbarCopy,
  onToolbarDelete,
  onToolbarFirst,
  onToolbarPrev,
  onToolbarNext,
  onToolbarLast,
  toolbarRecord,
  toolbarTotal,
}: UserFormDialogProps) {
  const [activeTab, setActiveTab] = React.useState<UserFormTab>("basic");
  const [value, setValue] = React.useState<UserFormValue>(initialValue);
  const [showPassword, setShowPassword] = React.useState(false);
  const [mobileError, setMobileError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [codeAutoFilled, setCodeAutoFilled] = React.useState(false);
  const [pendingToolbarAction, setPendingToolbarAction] = React.useState<(() => void) | null>(null);
  const { contentRef, attractAttention, attentionMessage } = useModalAttention();

  const selectedCategory = categories.find(c => String(c.id) === value.categoryId);
  const isAutoNumbering = mode === "create" && !!selectedCategory?.autoNumbering;

  const nextCodeQuery = trpc.userCategories.nextCode.useQuery(
    { categoryId: Number(value.categoryId) },
    {
      enabled: mode === "create" && !!value.categoryId && isAutoNumbering,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  );

  React.useEffect(() => {
    if (mode !== "create" || !isAutoNumbering) return;
    if (nextCodeQuery.isFetching) return;
    if (nextCodeQuery.data?.code) {
      setValue(cur => ({ ...cur, code: nextCodeQuery.data!.code }));
      setCodeAutoFilled(true);
    } else if (nextCodeQuery.data === null) {
      setValue(cur => ({ ...cur, code: "" }));
      setCodeAutoFilled(false);
      toast.warning("تجاوز النظام آخر رقم مسموح به في هذه الفئة");
    }
  }, [nextCodeQuery.data, nextCodeQuery.isFetching, isAutoNumbering, mode]);

  React.useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setActiveTab("basic");
    setShowPassword(false);
    setMobileError(null);
    setIsSaving(false);
    setCodeAutoFilled(false);
  }, [initialValue, open]);

  const isDirty = React.useMemo(
    () => JSON.stringify(value) !== JSON.stringify(initialValue),
    [initialValue, value],
  );

  const update = <K extends keyof UserFormValue>(key: K, next: UserFormValue[K]) => {
    setValue((cur) => ({ ...cur, [key]: next }));
    if (key === "mobile") {
      const v = next as string | undefined;
      if (v) {
        setMobileError(
          PHONE_REGEX.test((v ?? "").replace(/\s/g, ""))
            ? null
            : "رقم الجوال غير صحيح (8–15 رقمًا، + اختيارية)",
        );
      } else {
        setMobileError(null);
      }
    }
  };

  const handleCategoryChange = (v: string) => {
    const newCatId = v === "_none" ? undefined : v;
    const newCat = categories.find(c => String(c.id) === newCatId);
    setValue(cur => ({
      ...cur,
      categoryId: newCatId,
      code: newCatId && newCat?.autoNumbering ? "" : cur.code,
    }));
    setCodeAutoFilled(false);
  };

  const requestClose = () => {
    if (!isDirty) { onOpenChange(false); return; }
    setConfirmOpen(true);
  };

  const save = async () => {
    if (!value.fullName.trim()) {
      toast.error("الاسم الكامل مطلوب");
      setActiveTab("basic");
      return;
    }
    if (!value.loginName.trim()) {
      toast.error("اسم الدخول مطلوب");
      setActiveTab("basic");
      return;
    }
    if (value.mobile && !PHONE_REGEX.test(value.mobile.replace(/\s/g, ""))) {
      setMobileError("رقم الجوال غير صحيح (8–15 رقمًا، + اختيارية)");
      setActiveTab("contact");
      return;
    }
    // ── التحقق من البريد عند طرق الدخول التي تستوجبه ──────────────────────────
    if (value.loginMethod === 'email' && !value.email?.trim()) {
      toast.error("طريقة «البريد الإلكتروني فقط» تستوجب إدخال بريد صحيح من تبويب التواصل");
      setActiveTab("contact");
      return;
    }
    setMobileError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        ...value,
        mobile: value.mobile?.trim() || undefined,
        email: value.email?.trim() || undefined,
        password: value.password || undefined,
      });
    } catch (e: any) {
      if (e?.switchTab) {
        setActiveTab(e.switchTab as UserFormTab);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const guardedToolbarAction = (action: () => void) => {
    if (isDirty) {
      setPendingToolbarAction(() => action);
      setConfirmOpen(true);
    } else {
      action();
    }
  };

  const toolbarActions: ToolbarActionMap = {
    save: {
      supported: true,
      allowed: true,
      stateEnabled: !isSaving && isDirty && !mobileError,
      disabledReason: !isDirty
        ? "لا توجد تغييرات للحفظ"
        : mobileError
          ? "أصلح خطأ الجوال أولًا"
          : "أكمل البيانات المطلوبة أولًا",
      loading: isSaving,
      onClick: () => void save(),
    },
    draft: {
      supported: false,
      disabledReason: "المسودة غير مستخدمة في شاشة المستخدمين",
    },
    new: {
      supported: !!onToolbarNew,
      allowed: true,
      stateEnabled: true,
      disabledReason: "ليس لديك صلاحية إضافة مستخدم أو تم تجاوز العدد المسموح",
      onClick: onToolbarNew ? () => guardedToolbarAction(onToolbarNew) : undefined,
    },
    duplicate: {
      supported: !!onToolbarCopy,
      allowed: true,
      stateEnabled: mode === "edit",
      disabledReason: "اختر مستخدمًا محفوظًا أولًا",
      onClick: onToolbarCopy ? () => guardedToolbarAction(onToolbarCopy) : undefined,
    },
    tools: {
      supported: true,
      allowed: true,
      stateEnabled: true,
      onClick: () => {},
    },
    edit: {
      supported: false,
      disabledReason: "التعديل يتم مباشرة من خلال فتح المستخدم",
    },
    delete: {
      supported: !!onToolbarDelete,
      allowed: true,
      stateEnabled: mode === "edit",
      disabledReason: "اختر مستخدمًا محفوظًا أولًا",
      onClick: onToolbarDelete ? () => guardedToolbarAction(onToolbarDelete) : undefined,
    },
    first: {
      supported: !!onToolbarFirst,
      allowed: true,
      stateEnabled: !!toolbarTotal && toolbarTotal > 0,
      onClick: onToolbarFirst ? () => guardedToolbarAction(onToolbarFirst) : undefined,
    },
    previous: {
      supported: !!onToolbarPrev,
      allowed: true,
      stateEnabled: !!toolbarRecord && toolbarRecord > 1,
      onClick: onToolbarPrev ? () => guardedToolbarAction(onToolbarPrev) : undefined,
    },
    next: {
      supported: !!onToolbarNext,
      allowed: true,
      stateEnabled: !!toolbarRecord && !!toolbarTotal && toolbarRecord < toolbarTotal,
      onClick: onToolbarNext ? () => guardedToolbarAction(onToolbarNext) : undefined,
    },
    last: {
      supported: !!onToolbarLast,
      allowed: true,
      stateEnabled: !!toolbarTotal && toolbarTotal > 0,
      onClick: onToolbarLast ? () => guardedToolbarAction(onToolbarLast) : undefined,
    },
    approve: {
      supported: false,
      disabledReason: "الاعتماد غير مستخدم في شاشة المستخدمين",
    },
    unapprove: {
      supported: false,
      disabledReason: "إلغاء الاعتماد غير مستخدم في شاشة المستخدمين",
    },
    preview: {
      supported: false,
      disabledReason: "المعاينة غير مستخدمة في شاشة المستخدمين",
    },
    send: {
      supported: false,
      disabledReason: "الإرسال غير مستخدم في شاشة المستخدمين",
    },
    print: {
      supported: false,
      disabledReason: "الطباعة غير مستخدمة في شاشة المستخدمين",
    },
    exit: {
      supported: true,
      allowed: true,
      stateEnabled: true,
      onClick: requestClose,
    },
  };

  const toolbarTools: ToolbarToolItem[] = [
    {
      id: "change-password",
      label: "تغيير كلمة المرور",
      enabled: false,
      disabledReason: "استخدم زر القفل بجانب المستخدم في القائمة",
    },
    {
      id: "activity",
      label: "نشاط المستخدم",
      enabled: false,
      disabledReason: "غير مربوط بعد",
    },
    {
      id: "related",
      label: "المستندات المرتبطة",
      separatorBefore: true,
      enabled: false,
      disabledReason: "غير مربوط بعد",
    },
    {
      id: "attachments",
      label: "إرفاق مستندات",
      enabled: false,
      disabledReason: "غير مربوط بعد",
    },
  ];

  const saveAndContinue = async () => {
    await save();
    setConfirmOpen(false);
    const next = pendingToolbarAction;
    setPendingToolbarAction(null);
    if (next) {
      next();
    } else {
      onOpenChange(false);
    }
  };

  const discardAndContinue = () => {
    setConfirmOpen(false);
    const next = pendingToolbarAction;
    setPendingToolbarAction(null);
    if (next) {
      next();
    } else {
      onOpenChange(false);
    }
  };

  const isCodeLoading = isAutoNumbering && nextCodeQuery.isFetching;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          onEscapeKeyDown={(e) => { e.preventDefault(); requestClose(); }}
          onPointerDownOutside={(e) => { e.preventDefault(); attractAttention(); }}
          onInteractOutside={(e) => e.preventDefault()}
          className="h-[640px] max-h-[calc(100vh-32px)] w-[920px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl"
        >
          <div
            ref={contentRef}
            data-attention="false"
            className={cn(
              "flex h-full min-h-0 flex-col",
              "data-[attention=true]:animate-[modal-attention_320ms_ease-in-out]",
              "data-[attention=true]:ring-2 data-[attention=true]:ring-primary/50",
            )}
          >
            {/* ─── الرأس ──────────────────────────────────────────────────────── */}
            <DialogHeader className="shrink-0 border-b px-6 py-4 text-right">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserRoundPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">
                      {mode === "create" ? "إضافة مستخدم جديد" : "تعديل بيانات المستخدم"}
                    </DialogTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      بيانات الحساب ونطاق العمل والصلاحيات.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={requestClose}
                  aria-label="إغلاق"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <span className="text-lg leading-none">×</span>
                </Button>
              </div>
            </DialogHeader>

            {/* ─── التبويبات ──────────────────────────────────────────────────── */}
            <Tabs
              dir="rtl"
              value={activeTab}
              onValueChange={(tab) => setActiveTab(tab as UserFormTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="grid h-12 shrink-0 w-full grid-cols-5 rounded-none border-b bg-muted/30 p-1">
                <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                <TabsTrigger value="contact">التواصل</TabsTrigger>
                <TabsTrigger value="login">الدخول والحالة</TabsTrigger>
                <TabsTrigger value="work" disabled={mode === "create"}>
                  {mode === "create" && <LockKeyhole className="ms-1 h-3.5 w-3.5" />}
                  إعدادات العمل
                </TabsTrigger>
                <TabsTrigger value="permissions" disabled={mode === "create"}>
                  {mode === "create" && <LockKeyhole className="ms-1 h-3.5 w-3.5" />}
                  الصلاحيات
                </TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">

                {/* ── البيانات الأساسية ───────────────────────────────────────── */}
                <TabsContent value="basic" className="m-0 space-y-4">
                  <FormSection title="هوية المستخدم" hint="البيانات المطلوبة لإنشاء الحساب">
                    <div className="grid grid-cols-2 gap-4">

                      <FormField label="الاسم الكامل" required>
                        <Input
                          value={value.fullName}
                          onChange={(e) => update("fullName", e.target.value)}
                          placeholder="الاسم الكامل"
                        />
                      </FormField>

                      <FormField label="كود المستخدم">
                        <div className="relative">
                          <Input
                            dir="ltr"
                            className={cn(
                              "text-left",
                              isAutoNumbering && "pe-16 bg-muted/40",
                            )}
                            value={value.code ?? ""}
                            onChange={(e) => {
                              update("code", e.target.value || undefined);
                              setCodeAutoFilled(false);
                            }}
                            placeholder={isCodeLoading ? "جاري التوليد…" : "USR001"}
                            disabled={mode === "edit"}
                            readOnly={isCodeLoading}
                          />
                          {isCodeLoading && (
                            <Loader2 className="absolute end-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />
                          )}
                          {codeAutoFilled && !isCodeLoading && mode === "create" && (
                            <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-semibold bg-primary/10 rounded px-1.5 py-0.5 pointer-events-none">
                              تلقائي
                            </span>
                          )}
                        </div>
                        {isAutoNumbering && nextCodeQuery.data === null && !nextCodeQuery.isFetching && (
                          <p className="text-xs text-destructive mt-0.5">تم استنفاد جميع أرقام هذه الفئة</p>
                        )}
                      </FormField>

                      <FormField label="اسم الدخول" required>
                        <Input
                          dir="ltr"
                          className="text-left"
                          value={value.loginName}
                          onChange={(e) => update("loginName", e.target.value)}
                          placeholder="login_name"
                          disabled={mode === "edit"}
                        />
                        {mode === "edit" && (
                          <p className="text-xs text-muted-foreground mt-0.5">لا يمكن تغيير اسم الدخول</p>
                        )}
                      </FormField>

                      <FormField label="فئة المستخدم">
                        <DlgSelect
                          value={value.categoryId ?? "_none"}
                          onChange={handleCategoryChange}
                          disabled={mode === "edit"}
                          options={[
                            { value: "_none", label: "— بدون فئة —" },
                            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                          ]}
                        />
                        {mode === "create" && selectedCategory && !selectedCategory.autoNumbering && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            هذه الفئة لا تستخدم الترقيم التلقائي — أدخل الكود يدوياً
                          </p>
                        )}
                        {mode === "edit" && (
                          <p className="text-xs text-muted-foreground mt-0.5">لا يمكن تغيير الفئة بعد الإنشاء</p>
                        )}
                      </FormField>

                    </div>
                  </FormSection>
                </TabsContent>

                {/* ── التواصل ─────────────────────────────────────────────────── */}
                <TabsContent value="contact" className="m-0 space-y-4">
                  <FormSection title="بيانات التواصل" hint="حقول اختيارية">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="رقم الجوال">
                        <Input
                          dir="ltr"
                          className={cn("text-left", mobileError && "border-destructive")}
                          value={value.mobile ?? ""}
                          onChange={(e) => update("mobile", e.target.value || undefined)}
                          placeholder="+9665xxxxxxxx أو 05xxxxxxxx"
                          type="tel"
                        />
                        {mobileError && (
                          <p className="text-destructive text-xs mt-1">{mobileError}</p>
                        )}
                      </FormField>
                      <FormField label="البريد الإلكتروني">
                        <Input
                          dir="ltr"
                          className="text-left"
                          value={value.email ?? ""}
                          onChange={(e) => update("email", e.target.value || undefined)}
                          placeholder="name@company.com"
                          type="email"
                        />
                      </FormField>
                    </div>
                  </FormSection>
                </TabsContent>

                {/* ── الدخول والحالة ──────────────────────────────────────────── */}
                <TabsContent value="login" className="m-0 space-y-4">
                  <FormSection title="نوع المستخدم ودوره">
                    <FormField label="نوع المستخدم" required>
                      <DlgSelect
                        value={value.userType}
                        onChange={(v) => update("userType", v)}
                        options={[
                          { value: "admin",             label: "مدير النظام" },
                          { value: "accountant",        label: "محاسب" },
                          { value: "cashier",           label: "كاشير" },
                          { value: "warehouse_manager", label: "مدير مخزن" },
                          { value: "viewer",            label: "مشاهد" },
                        ]}
                      />
                    </FormField>
                  </FormSection>

                  <FormSection title="طريقة تسجيل الدخول">
                    <FormField label="طريقة تسجيل الدخول" required>
                      <DlgSelect
                        value={value.loginMethod}
                        onChange={(v) => update("loginMethod", v as UserLoginMethod)}
                        options={[
                          { value: "username",          label: "اسم المستخدم فقط" },
                          { value: "username_or_email", label: "اسم المستخدم أو البريد الإلكتروني" },
                          { value: "email",             label: "البريد الإلكتروني فقط" },
                        ]}
                      />
                      {value.loginMethod === 'username' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          يدخل المستخدم باسم الدخول فقط — البريد اختياري للتواصل واستعادة كلمة المرور
                        </p>
                      )}
                      {value.loginMethod === 'username_or_email' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          يستطيع الدخول باسم الدخول أو بالبريد الإلكتروني — يجب إدخال بريد صحيح غير مكرر
                        </p>
                      )}
                      {value.loginMethod === 'email' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          البريد إجباري — لا يُستخدم اسم الدخول في تسجيل الدخول (يبقى معرفاً داخلياً)
                        </p>
                      )}
                      {(value.loginMethod === 'username_or_email' || value.loginMethod === 'email') && !value.email?.trim() && (
                        <p className="text-xs text-amber-600 mt-1">
                          يجب إدخال البريد الإلكتروني من تبويب التواصل لإتاحة الدخول بالبريد
                        </p>
                      )}
                    </FormField>
                  </FormSection>

                  <FormSection title="حالة الدخول">
                    <SwitchCard
                      title="السماح بتسجيل الدخول"
                      description="تعطيله يمنع الدخول بغض النظر عن كلمة المرور"
                      checked={value.allowLogin}
                      onCheckedChange={(v) => update("allowLogin", v)}
                    />
                  </FormSection>

                  <FormSection
                    title={mode === "create" ? "كلمة المرور" : "تغيير كلمة المرور"}
                    hint="لا توجد شروط للطول أو التعقيد"
                  >
                    <div className="relative">
                      <Input
                        dir="ltr"
                        className="pe-10 text-left"
                        type={showPassword ? "text" : "password"}
                        value={value.password ?? ""}
                        onChange={(e) => update("password", e.target.value || undefined)}
                        placeholder={
                          mode === "edit"
                            ? "اتركها فارغة للاحتفاظ بالكلمة الحالية"
                            : "يمكن تركها فارغة حسب سياسة النظام"
                        }
                      />
                      <button
                        type="button"
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword((p) => !p)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormSection>

                  {loginTabExtension}
                </TabsContent>

                {/* ── إعدادات العمل ───────────────────────────────────────────── */}
                <TabsContent value="work" className="m-0 space-y-4">
                  {workTabContent}
                </TabsContent>

                {/* ── الصلاحيات ───────────────────────────────────────────────── */}
                <TabsContent value="permissions" className="m-0 space-y-4">
                  {permissionsTabContent}
                </TabsContent>

              </div>
            </Tabs>

            {/* ─── رسالة التنبيه ────────────────────────────────────────────── */}
            {attentionMessage && (
              <div className="mx-6 mb-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 text-center animate-in fade-in duration-150">
                {attentionMessage}
              </div>
            )}

            {/* ─── شريط الحركات الموحد ───────────────────────────────────────── */}
            <div className="relative h-[78px] shrink-0">
              <UnifiedBottomToolbar
                actions={toolbarActions}
                tools={toolbarTools}
                activeAction={isSaving ? "save" : undefined}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={confirmOpen}
        isSaving={isSaving}
        onSave={() => void saveAndContinue()}
        onDiscard={discardAndContinue}
        onCancel={() => { setConfirmOpen(false); setPendingToolbarAction(null); }}
      />
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-muted/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-semibold">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="me-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function DlgSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <Select dir="rtl" value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="z-[12000]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SwitchCard({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
