import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import { CheckCircle2, Loader2, Pencil, Plus, Send, Shield, Trash2, Users as UsersIcon, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام", accountant: "محاسب", cashier: "كاشير",
  warehouse_manager: "مدير مخزن", viewer: "مشاهد", user: "مستخدم",
};
const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  accountant: "bg-green-100 text-green-700 border-green-200",
  cashier: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_manager: "bg-amber-100 text-amber-700 border-amber-200",
  viewer: "bg-gray-100 text-gray-600 border-gray-200",
  user: "bg-gray-100 text-gray-700 border-gray-200",
};

const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
function validatePhone(v: string) {
  if (!v) return null;
  if (!PHONE_REGEX.test(v.replace(/\s/g, "")))
    return "رقم الجوال غير صحيح (8–15 رقمًا، + اختيارية)";
  return null;
}

type Mode = "create" | "edit";
interface FormState {
  code: string; name: string; phone: string; email: string;
  username: string; password: string; newPassword: string; role: string;
}
const emptyForm = (): FormState => ({
  code: "", name: "", phone: "", email: "",
  username: "", password: "", newPassword: "", role: "user",
});

// ─── VerifyBadge ──────────────────────────────────────────────────────────────
function VerifyBadge({ verified, label }: { verified: boolean; label: string }) {
  return verified ? (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" />{label} محقق
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <XCircle className="w-3.5 h-3.5" />{label} غير محقق
    </span>
  );
}

// ─── VerifyOtpDialog ─────────────────────────────────────────────────────────
function VerifyOtpDialog({
  open, onClose, userId, channel, devOtp, onSuccess,
}: {
  open: boolean; onClose: () => void; userId: number;
  channel: "phone" | "email"; devOtp?: string; onSuccess: () => void;
}) {
  const [otp, setOtp] = useState("");
  const utils = trpc.useUtils();
  const confirm = trpc.recovery.confirmVerification.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success(`تم تأكيد ${channel === "phone" ? "رقم الجوال" : "البريد الإلكتروني"} بنجاح`);
      setOtp("");
      onSuccess();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>تأكيد {channel === "phone" ? "رقم الجوال" : "البريد الإلكتروني"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {devOtp && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <span className="font-semibold">كود التجربة (dev):</span>
              <span className="font-mono ms-2 text-lg font-bold">{devOtp}</span>
            </div>
          )}
          <div>
            <Label>كود التحقق (6 أرقام)</Label>
            <Input
              className="mt-1 text-center font-mono text-xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              dir="ltr"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => confirm.mutate({ userId, channel, otp })} disabled={otp.length < 6 || confirm.isPending}>
            {confirm.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin me-1" />جاري التحقق...</> : "تأكيد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
export default function Users() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Verification dialog state
  const [verifyDialog, setVerifyDialog] = useState<{ open: boolean; channel: "phone" | "email"; devOtp?: string } | null>(null);

  // Recovery options state (only used in edit mode)
  const [recoveryEnabledPhone, setRecoveryEnabledPhone] = useState(false);
  const [recoveryEnabledEmail, setRecoveryEnabledEmail] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [recoveryDirty, setRecoveryDirty] = useState(false);

  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم إنشاء المستخدم بنجاح"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم حفظ التعديلات"); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم حذف المستخدم"); setShowDeleteConfirm(false); setIsOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const sendVerification = trpc.recovery.sendVerification.useMutation({
    onSuccess: (data, vars) => {
      toast.success(`تم إرسال كود التحقق للـ${vars.channel === "phone" ? "جوال" : "بريد"}`);
      setVerifyDialog({ open: true, channel: vars.channel, devOtp: data.devOtp });
    },
    onError: (e) => toast.error(e.message),
  });

  const setRecoveryOptions = trpc.recovery.setRecoveryOptions.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم حفظ إعدادات الاستعادة"); setRecoveryDirty(false); },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setMode("create"); setSelectedUser(null); setForm(emptyForm()); setPhoneError(null); setIsOpen(true);
  };
  const openEdit = (u: any) => {
    setMode("edit"); setSelectedUser(u);
    setForm({ code: u.code ?? "", name: u.name ?? "", phone: u.phone ?? "", email: u.email ?? "", username: u.username ?? "", password: "", newPassword: "", role: u.role ?? "user" });
    setPhoneError(null);
    setRecoveryEnabledPhone(u.recoveryEnabledPhone ?? false);
    setRecoveryEnabledEmail(u.recoveryEnabledEmail ?? false);
    setForcePasswordChange(u.forcePasswordChange ?? false);
    setRecoveryDirty(false);
    setIsOpen(true);
  };

  const setField = (k: keyof FormState, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "phone" && mode === "edit" && selectedUser?.phoneVerifiedAt) {
        // phone changed → reset verification on save
      }
      return next;
    });
    if (k === "phone") setPhoneError(validatePhone(v));
  };

  const phoneChanged = mode === "edit" && form.phone !== (selectedUser?.phone ?? "");
  const emailChanged = mode === "edit" && form.email !== (selectedUser?.email ?? "");

  const handleSubmit = () => {
    const err = validatePhone(form.phone);
    if (err) { setPhoneError(err); return; }
    if (mode === "create") {
      if (!form.name.trim()) { toast.error("الاسم الكامل مطلوب"); return; }
      if (!form.username.trim()) { toast.error("اسم المستخدم مطلوب"); return; }
      createUser.mutate({ code: form.code || undefined, name: form.name, phone: form.phone || undefined, email: form.email || undefined, username: form.username, password: form.password, role: form.role as any });
    } else {
      updateUser.mutate({ id: selectedUser.id, name: form.name || undefined, phone: form.phone || undefined, email: form.email || undefined, role: form.role as any, newPassword: form.newPassword || undefined });
    }
  };

  const handleSaveRecovery = () => {
    setRecoveryOptions.mutate({
      userId: selectedUser.id,
      recoveryEnabledPhone, recoveryEnabledEmail, forcePasswordChange,
    });
  };

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المستخدمين وصلاحياتهم وخيارات الأمان</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />إضافة مستخدم
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right w-20">الكود</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">اسم المستخدم</TableHead>
                <TableHead className="text-right">رقم الجوال</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => (<TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>))}</TableRow>
                ))
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا يوجد مستخدمون</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                      <Plus className="w-3.5 h-3.5 me-1" />إضافة أول مستخدم
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((u: any) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground font-mono">{u.code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      {u.forcePasswordChange && (
                        <div className="text-xs text-amber-600">يجب تغيير كلمة المرور</div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.username}</TableCell>
                    <TableCell>
                      {u.phone ? (
                        <div>
                          <div className="text-sm" dir="ltr">{u.phone}</div>
                          <VerifyBadge verified={!!u.phoneVerifiedAt} label="الجوال" />
                        </div>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {u.email ? (
                        <div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                          <VerifyBadge verified={!!u.emailVerifiedAt} label="البريد" />
                        </div>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[u.role] ?? roleColors.user}`}>
                        {roleLabels[u.role] ?? u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                        {u.isActive ? "نشط" : "موقوف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── نافذة إضافة / تعديل ───────────────────────────────────────────── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {mode === "create" ? "إضافة مستخدم جديد" : `تعديل: ${selectedUser?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* ── البيانات الأساسية ── */}
            <section className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">البيانات الأساسية</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الكود <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                  <Input className="mt-1" placeholder="USR001" value={form.code} onChange={(e) => setField("code", e.target.value)} disabled={mode === "edit"} />
                </div>
                <div>
                  <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                  <Input className="mt-1" placeholder="الاسم الكامل" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>اسم المستخدم {mode === "create" && <span className="text-red-500">*</span>}</Label>
                  <Input className="mt-1" placeholder="login_name" value={form.username} onChange={(e) => setField("username", e.target.value)} disabled={mode === "edit"} dir="ltr" />
                  {mode === "edit" && <p className="text-xs text-muted-foreground mt-0.5">لا يمكن تغيير اسم المستخدم</p>}
                </div>
                <div>
                  <Label>
                    {mode === "create" ? <span>كلمة المرور <span className="text-muted-foreground text-xs">(اختياري)</span></span> : <span>كلمة مرور جديدة <span className="text-muted-foreground text-xs">(اختياري)</span></span>}
                  </Label>
                  <Input className="mt-1" type="password" placeholder="اتركها فارغة للدخول بدون كلمة مرور" value={mode === "create" ? form.password : form.newPassword} onChange={(e) => setField(mode === "create" ? "password" : "newPassword", e.target.value)} dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>رقم الجوال <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                    {mode === "edit" && selectedUser?.phone && !phoneChanged && (
                      <div className="flex items-center gap-1">
                        <VerifyBadge verified={!!selectedUser?.phoneVerifiedAt} label="الجوال" />
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                          disabled={sendVerification.isPending}
                          onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "phone" })}>
                          {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          تحقق
                        </Button>
                      </div>
                    )}
                  </div>
                  <Input
                    className={phoneError ? "border-red-400" : ""}
                    placeholder="+9665xxxxxxxx أو 05xxxxxxxx"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    dir="ltr" type="tel"
                  />
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                  {phoneChanged && selectedUser?.phoneVerifiedAt && (
                    <p className="text-amber-600 text-xs mt-1">⚠ تغيير الجوال سيلغي التحقق</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>البريد الإلكتروني <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                    {mode === "edit" && selectedUser?.email && !emailChanged && (
                      <div className="flex items-center gap-1">
                        <VerifyBadge verified={!!selectedUser?.emailVerifiedAt} label="البريد" />
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                          disabled={sendVerification.isPending}
                          onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "email" })}>
                          {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          تحقق
                        </Button>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="example@company.com"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    dir="ltr"
                  />
                  {emailChanged && selectedUser?.emailVerifiedAt && (
                    <p className="text-amber-600 text-xs mt-1">⚠ تغيير البريد سيلغي التحقق</p>
                  )}
                </div>
              </div>
              <div>
                <Label>الدور <span className="text-red-500">*</span></Label>
                <Select value={form.role} onValueChange={(v) => setField("role", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">مدير النظام</SelectItem>
                    <SelectItem value="accountant">محاسب</SelectItem>
                    <SelectItem value="cashier">كاشير</SelectItem>
                    <SelectItem value="warehouse_manager">مدير مخزن</SelectItem>
                    <SelectItem value="viewer">مشاهد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* ── بيانات التواصل ── */}
            <section className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">بيانات التواصل والاستعادة</p>

              {/* الجوال */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>رقم الجوال <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                  {mode === "edit" && selectedUser?.phone && (
                    <div className="flex items-center gap-2">
                      <VerifyBadge verified={!!selectedUser?.phoneVerifiedAt && !phoneChanged} label="الجوال" />
                      {!phoneChanged && (
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                          disabled={sendVerification.isPending}
                          onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "phone" })}
                        >
                          {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          إرسال كود
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  className={`${phoneError ? "border-red-400" : ""}`}
                  placeholder="+9665xxxxxxxx أو 05xxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  dir="ltr" type="tel"
                />
                {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                {phoneChanged && selectedUser?.phoneVerifiedAt && (
                  <p className="text-amber-600 text-xs mt-1">⚠ تغيير الجوال سيلغي التحقق الحالي ويتطلب إعادة التحقق.</p>
                )}
                {!form.phone && (
                  <p className="text-amber-600 text-xs mt-1">⚠ يُفضَّل إدخال رقم الجوال لتفعيل استعادة كلمة المرور.</p>
                )}
              </div>

              {/* البريد */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>البريد الإلكتروني <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                  {mode === "edit" && selectedUser?.email && (
                    <div className="flex items-center gap-2">
                      <VerifyBadge verified={!!selectedUser?.emailVerifiedAt && !emailChanged} label="البريد" />
                      {!emailChanged && (
                        <Button
                          variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                          disabled={sendVerification.isPending}
                          onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "email" })}
                        >
                          {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          إرسال كود
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  placeholder="example@company.com"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  dir="ltr"
                />
                {emailChanged && selectedUser?.emailVerifiedAt && (
                  <p className="text-amber-600 text-xs mt-1">⚠ تغيير البريد سيلغي التحقق الحالي ويتطلب إعادة التحقق.</p>
                )}
              </div>
            </section>

            {/* ── إعدادات الاستعادة (تعديل فقط) ── */}
            {mode === "edit" && (
              <section className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">إعدادات الاستعادة والأمان</p>

                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">استعادة كلمة المرور عبر الجوال</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser?.phoneVerifiedAt ? "الجوال محقق ✓" : "يتطلب تحقق الجوال أولاً"}
                      </p>
                    </div>
                    <Switch
                      checked={recoveryEnabledPhone}
                      disabled={!selectedUser?.phoneVerifiedAt}
                      onCheckedChange={(v) => { setRecoveryEnabledPhone(v); setRecoveryDirty(true); }}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <div>
                      <p className="text-sm font-medium">استعادة كلمة المرور عبر البريد</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser?.emailVerifiedAt ? "البريد محقق ✓" : "يتطلب تحقق البريد أولاً"}
                      </p>
                    </div>
                    <Switch
                      checked={recoveryEnabledEmail}
                      disabled={!selectedUser?.emailVerifiedAt}
                      onCheckedChange={(v) => { setRecoveryEnabledEmail(v); setRecoveryDirty(true); }}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <div>
                      <p className="text-sm font-medium">إجبار تغيير كلمة المرور</p>
                      <p className="text-xs text-muted-foreground">يُجبر المستخدم على تغيير كلمته عند أول دخول</p>
                    </div>
                    <Switch
                      checked={forcePasswordChange}
                      onCheckedChange={(v) => { setForcePasswordChange(v); setRecoveryDirty(true); }}
                    />
                  </div>
                </div>

                {recoveryDirty && (
                  <Button size="sm" variant="outline" onClick={handleSaveRecovery} disabled={setRecoveryOptions.isPending} className="gap-1">
                    {setRecoveryOptions.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    حفظ إعدادات الأمان
                  </Button>
                )}
              </section>
            )}
          </div>

          <DialogFooter className="flex-row-reverse sm:flex-row gap-2 pt-2 border-t mt-2">
            {mode === "edit" && (
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="mr-auto gap-1">
                <Trash2 className="w-4 h-4" />حذف
              </Button>
            )}
            <div className="flex gap-2 ms-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={isPending || !!phoneError}>
                {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin me-1" />جاري الحفظ...</> : mode === "create" ? "إنشاء المستخدم" : "حفظ التعديلات"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── نافذة حذف ─────────────────────────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف المستخدم "<span className="font-medium text-foreground">{selectedUser?.name}</span>"؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteUser.mutate({ id: selectedUser.id })} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── نافذة تأكيد OTP ────────────────────────────────────────────────── */}
      {verifyDialog && selectedUser && (
        <VerifyOtpDialog
          open={verifyDialog.open}
          onClose={() => setVerifyDialog(null)}
          userId={selectedUser.id}
          channel={verifyDialog.channel}
          devOtp={verifyDialog.devOtp}
          onSuccess={() => {
            // Refresh selectedUser data
            utils.users.list.invalidate();
          }}
        />
      )}
    </div>
  );
}
