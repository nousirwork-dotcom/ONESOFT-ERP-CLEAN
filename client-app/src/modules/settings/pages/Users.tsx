import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Switch } from "@/core/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import {
  Building2, CheckCircle2, Eye, EyeOff, KeyRound, LifeBuoy, Loader2,
  LogOut, Pencil, Plus, Send, Sparkles, Trash2, Users as UsersIcon, X, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HS_MODULE_PERM } from "@/shared/lib/hsPermissions";
import { AI_MODULE_PERM, AI_PERM_DEFS } from "@/shared/lib/aiPermissions";
import { UserFormDialog, UserFormValue } from "./UserFormDialog";

// ── صلاحيات وحدة «المساعدة والخدمات» (extra_permissions) ─────────────────────
const HS_PERM_DEFS: Array<{ key: string; label: string; isModule?: boolean }> = [
  { key: HS_MODULE_PERM,       label: "عرض وحدة المساعدة والخدمات", isModule: true },
  { key: "hs_rentals",          label: "الإيجارات والعقود" },
  { key: "hs_custody",          label: "العهد والمصروفات" },
  { key: "hs_customers",        label: "متابعة العملاء" },
  { key: "hs_tasks",            label: "المهام والتذكيرات" },
  { key: "hs_gov_links",        label: "الروابط والخدمات الحكومية" },
  { key: "hs_notes",            label: "الملاحظات" },
  { key: "hs_internal_comm",    label: "التواصل الداخلي" },
  { key: "hs_support",          label: "طلب الدعم الفني" },
  { key: "hs_real_estate",      label: "المطور العقاري" },
  { key: "hs_re_purchases",     label: "المطور العقاري — البيان التفصيلي للمشتريات" },
  { key: "hs_re_documents",     label: "المطور العقاري — أوراق المشروع" },
  { key: "hs_re_trial_balance", label: "المطور العقاري — ميزان المراجعة المبسط" },
];

const WORK_PERM_DEFS: Array<{ key: string; label: string; desc: string }> = [
  { key: "can_work_cashier",    label: "السماح بالعمل ككاشير",  desc: "يستطيع إنشاء فواتير المبيعات ونقاط البيع" },
  { key: "can_work_accountant", label: "السماح بالعمل كمحاسب", desc: "يستطيع الوصول إلى القيود المحاسبية والتقارير المالية" },
];

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

// ─── VerifyOtpDialog ──────────────────────────────────────────────────────────
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

// ─── ChangeUserPasswordDialog ─────────────────────────────────────────────────
function ChangeUserPasswordDialog({
  user, onClose, allowPasswordless,
}: {
  user: any; onClose: () => void; allowPasswordless?: boolean;
}) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [noPassword, setNoPassword] = useState(false);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success(noPassword ? "تمت إزالة كلمة المرور — يمكن للمستخدم الدخول بدونها" : "تم تغيير كلمة المرور بنجاح");
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = () => {
    setError("");
    if (noPassword) { updateUser.mutate({ id: user.id, clearPassword: true }); return; }
    if (next !== confirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    updateUser.mutate({ id: user.id, newPassword: next });
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            تغيير كلمة مرور: {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {user.role !== "admin" && user.role !== "superadmin" && allowPasswordless && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">بدون كلمة مرور</p>
                <p className="text-xs text-muted-foreground">يدخل المستخدم باسم المستخدم فقط (من جهاز السيرفر)</p>
              </div>
              <Switch checked={noPassword} onCheckedChange={setNoPassword} />
            </div>
          )}
          {!noPassword && (
            <>
              <div>
                <Label>كلمة المرور الجديدة <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1" type="password" dir="ltr"
                  placeholder="كلمة المرور الجديدة"
                  value={next} onChange={(e) => setNext(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1" type="password" dir="ltr"
                  placeholder="أعد كتابتها"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !updateUser.isPending && handleSubmit()}
                />
              </div>
            </>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateUser.isPending}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={updateUser.isPending || (!noPassword && (!next || !confirm))}>
            {updateUser.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin me-1" />جاري الحفظ...</> : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── لوحة إسناد الفروع للمستخدم ───────────────────────────────────────────────
function UserBranchAssignmentsPanel({ userId, orgId }: { userId: number; orgId: number }) {
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");

  const assignmentsQ = trpc.users.listUserBranchAssignments.useQuery({ userId });
  const branchesQ    = trpc.branches.list.useQuery();
  const addMut       = trpc.users.addUserBranchAssignment.useMutation({
    onSuccess: () => {
      void utils.users.listUserBranchAssignments.invalidate({ userId });
      setAddOpen(false);
      setSelectedBranchId("");
      toast.success("تم إسناد الفرع بنجاح");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.users.removeUserBranchAssignment.useMutation({
    onSuccess: () => {
      void utils.users.listUserBranchAssignments.invalidate({ userId });
      toast.success("تم إلغاء إسناد الفرع");
    },
    onError: (e) => toast.error(e.message),
  });

  const assignments = assignmentsQ.data ?? [];
  const assignedBranchIds = new Set(assignments.map(a => a.branchId));
  const availableBranches = (branchesQ.data ?? []).filter((b: any) => !assignedBranchIds.has(b.id));

  return (
    <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <p className="font-medium">الفروع المُسندة</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
          onClick={() => setAddOpen(o => !o)} disabled={availableBranches.length === 0}>
          <Plus className="w-3 h-3" /> إسناد فرع
        </Button>
      </div>

      {addOpen && (
        <div className="flex gap-2 items-center">
          <select
            className="flex-1 border rounded-md px-2 py-1 text-sm bg-background"
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">اختر فرعاً…</option>
            {availableBranches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button size="sm" disabled={!selectedBranchId || addMut.isPending}
            onClick={() => selectedBranchId && addMut.mutate({ userId, branchId: Number(selectedBranchId) })}>
            {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "إسناد"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAddOpen(false); setSelectedBranchId(""); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {assignmentsQ.isLoading ? (
        <p className="text-xs text-muted-foreground flex gap-1 items-center"><Loader2 className="w-3 h-3 animate-spin" /> جاري التحميل…</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد فروع مُسندة — البائع سيظهر في جميع الفروع إذا كان مؤهلاً.</p>
      ) : (
        <div className="space-y-1.5">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-background border rounded-lg px-3 py-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm font-medium">{a.branchName}</span>
              </div>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                disabled={removeMut.isPending}
                onClick={() => removeMut.mutate({ assignmentId: a.id })}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
export default function Users() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [initialValue, setInitialValue] = useState<UserFormValue>({ fullName: "", loginName: "", userType: "cashier", allowLogin: true });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [verifyDialog, setVerifyDialog] = useState<{ open: boolean; channel: "phone" | "email"; devOtp?: string } | null>(null);

  // ── إعدادات الأمان والعمل والصلاحيات (وضع التعديل فقط) ──────────────────
  const [recoveryEnabledPhone, setRecoveryEnabledPhone] = useState(false);
  const [recoveryEnabledEmail, setRecoveryEnabledEmail] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [recoveryDirty, setRecoveryDirty] = useState(false);
  const [extraPerms, setExtraPerms] = useState<Record<string, boolean>>({});
  const [permsDirty, setPermsDirty] = useState(false);

  const utils = trpc.useUtils();

  const { data: usersList, isLoading } = trpc.users.list.useQuery();
  const { data: countInfo } = trpc.users.getUserCountInfo.useQuery();
  const { data: userGroups = [] } = trpc.users.listUserGroups.useQuery();
  const { data: branchesList = [] } = trpc.branches.list.useQuery();
  const { data: warehousesList = [] } = trpc.warehouses.list.useQuery();

  const PASSWORDLESS_KEY = "security.allow_passwordless_users";
  const { data: passwordlessPolicy } = trpc.appSettings.get.useQuery({ key: PASSWORDLESS_KEY });
  const allowPasswordless = passwordlessPolicy === true;
  const setPolicy = trpc.appSettings.set.useMutation({
    onSuccess: () => {
      utils.appSettings.get.invalidate({ key: PASSWORDLESS_KEY });
      toast.success("تم تحديث سياسة كلمات المرور");
    },
    onError: (e) => toast.error(e.message),
  });

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); utils.users.getUserCountInfo.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("تم حفظ التعديلات");
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleActive = trpc.users.update.useMutation({
    onSuccess: (_d, vars) => {
      utils.users.list.invalidate();
      utils.users.getUserCountInfo.invalidate();
      toast.success(vars.isActive ? "تم تفعيل المستخدم" : "تم إيقاف المستخدم");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      utils.users.getUserCountInfo.invalidate();
      toast.success("تم حذف المستخدم");
      setShowDeleteConfirm(false);
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const logoutAllSessions = trpc.users.logoutAllSessions.useMutation({
    onSuccess: () => toast.success("تم تسجيل خروج المستخدم من جميع الأجهزة"),
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
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("تم حفظ إعدادات الأمان");
      setRecoveryDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const setExtraPermissions = trpc.users.setExtraPermissions.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      utils.auth.me.invalidate();
      toast.success("تم حفظ الصلاحيات");
      setPermsDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── فتح النافذة ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setMode("create");
    setSelectedUser(null);
    setInitialValue({ fullName: "", loginName: "", userType: "cashier", allowLogin: true });
    setIsOpen(true);
  };

  const openEdit = (u: any) => {
    setMode("edit");
    setSelectedUser(u);
    setInitialValue({
      code: u.code ?? undefined,
      fullName: u.name ?? "",
      loginName: u.username ?? "",
      userType: u.role ?? "cashier",
      groupId: u.userGroupId ? String(u.userGroupId) : undefined,
      branchId: u.defaultBranchId ? String(u.defaultBranchId) : undefined,
      warehouseId: u.defaultWarehouseId ? String(u.defaultWarehouseId) : undefined,
      language: u.defaultLanguage ?? undefined,
      mobile: u.phone ?? undefined,
      email: u.email ?? undefined,
      allowLogin: u.allowLogin !== false,
    });
    setRecoveryEnabledPhone(u.recoveryEnabledPhone ?? false);
    setRecoveryEnabledEmail(u.recoveryEnabledEmail ?? false);
    setForcePasswordChange(u.forcePasswordChange ?? false);
    setRecoveryDirty(false);
    setExtraPerms({ ...(u.extraPermissions ?? {}) });
    setPermsDirty(false);
    setIsOpen(true);
  };

  const togglePerm = (key: string, v: boolean) => {
    setExtraPerms((p) => ({ ...p, [key]: v }));
    setPermsDirty(true);
  };

  const handleSavePerms = () => {
    const permissions: Record<string, boolean> = {};
    for (const d of HS_PERM_DEFS) permissions[d.key] = extraPerms[d.key] === true;
    for (const d of AI_PERM_DEFS) permissions[d.key] = extraPerms[d.key] === true;
    for (const d of WORK_PERM_DEFS) permissions[d.key] = extraPerms[d.key] === true;
    setExtraPermissions.mutate({ userId: selectedUser.id, permissions: permissions as any });
  };

  const handleSaveRecovery = () => {
    setRecoveryOptions.mutate({
      userId: selectedUser.id,
      recoveryEnabledPhone, recoveryEnabledEmail, forcePasswordChange,
    });
  };

  // ── handleDialogSubmit ────────────────────────────────────────────────────
  const handleDialogSubmit = async (value: UserFormValue): Promise<void> => {
    if (mode === "create") {
      if (!value.password && (!allowPasswordless || value.userType === "admin")) {
        toast.error(
          value.userType === "admin"
            ? "حسابات مدير النظام يجب أن تكون محمية بكلمة مرور"
            : "كلمة المرور مطلوبة",
        );
        const err = Object.assign(new Error("validation"), { switchTab: "login" as const });
        throw err;
      }
      const newUser = await createUser.mutateAsync({
        code: value.code || undefined,
        name: value.fullName,
        phone: value.mobile || undefined,
        email: value.email || undefined,
        username: value.loginName,
        password: value.password,
        role: value.userType as any,
        userGroupId: value.groupId ? Number(value.groupId) : null,
        defaultBranchId: value.branchId ? Number(value.branchId) : null,
        defaultWarehouseId: value.warehouseId ? Number(value.warehouseId) : null,
        defaultLanguage: value.language || null,
        allowLogin: value.allowLogin,
      });
      toast.success("تم إنشاء المستخدم بنجاح — يمكنك الآن تعديل إعدادات العمل والصلاحيات");
      const fullUser = {
        id: newUser.id, code: newUser.code,
        name: value.fullName,
        phone: value.mobile || null,
        email: value.email || null,
        username: value.loginName,
        role: value.userType,
        userGroupId: value.groupId ? Number(value.groupId) : null,
        defaultBranchId: value.branchId ? Number(value.branchId) : null,
        defaultWarehouseId: value.warehouseId ? Number(value.warehouseId) : null,
        defaultLanguage: value.language || null,
        allowLogin: value.allowLogin, isActive: true, forcePasswordChange: false,
        phoneVerifiedAt: null, emailVerifiedAt: null,
        recoveryEnabledPhone: false, recoveryEnabledEmail: false,
        extraPermissions: {}, lastLoginAt: null,
      };
      setMode("edit");
      setSelectedUser(fullUser);
      setInitialValue({
        code: newUser.code ?? undefined,
        fullName: value.fullName,
        loginName: value.loginName,
        userType: value.userType,
        groupId: value.groupId,
        branchId: value.branchId,
        warehouseId: value.warehouseId,
        language: value.language,
        mobile: value.mobile,
        email: value.email,
        allowLogin: value.allowLogin,
      });
      setForcePasswordChange(false);
      setRecoveryEnabledPhone(false);
      setRecoveryEnabledEmail(false);
      setExtraPerms({});
      setPermsDirty(false);
      setRecoveryDirty(false);
    } else {
      await updateUser.mutateAsync({
        id: selectedUser.id,
        name: value.fullName || undefined,
        phone: value.mobile || undefined,
        email: value.email || undefined,
        role: value.userType as any,
        newPassword: value.password || undefined,
        userGroupId: value.groupId ? Number(value.groupId) : null,
        defaultBranchId: value.branchId ? Number(value.branchId) : null,
        defaultWarehouseId: value.warehouseId ? Number(value.warehouseId) : null,
        defaultLanguage: value.language || null,
        allowLogin: value.allowLogin,
        forcePasswordChange,
      });
    }
  };

  // ── محتوى تبويب الدخول (الامتداد) ────────────────────────────────────────
  const loginTabExtension = mode === "edit" && selectedUser ? (
    <>
      {/* إجبار تغيير كلمة المرور */}
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">إجبار تغيير كلمة المرور</p>
            <p className="text-xs text-muted-foreground">يُجبر المستخدم على تغيير كلمته عند أول دخول</p>
          </div>
          <Switch
            checked={forcePasswordChange}
            onCheckedChange={(v) => { setForcePasswordChange(v); setRecoveryDirty(true); }}
          />
        </div>
        {recoveryDirty && (
          <Button size="sm" variant="outline" onClick={handleSaveRecovery}
            disabled={setRecoveryOptions.isPending} className="gap-1 mt-3">
            {setRecoveryOptions.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            حفظ إعدادات الأمان
          </Button>
        )}
      </div>
      {/* جلسات الدخول */}
      <div className="rounded-2xl border bg-muted/20 p-4">
        <p className="font-semibold mb-3">جلسات الدخول</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">آخر تسجيل دخول</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedUser?.lastLoginAt ? fmtDate(selectedUser.lastLoginAt) : "لم يُسجَّل دخول بعد"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
            disabled={logoutAllSessions.isPending}
            onClick={() => logoutAllSessions.mutate({ userId: selectedUser.id })}>
            {logoutAllSessions.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <LogOut className="w-3.5 h-3.5" />}
            إخراج من الأجهزة
          </Button>
        </div>
      </div>
    </>
  ) : null;

  // ── محتوى تبويب إعدادات العمل ────────────────────────────────────────────
  const workTabContent = mode === "edit" && selectedUser ? (
    <>
      {/* يظهر كبائع في فواتير المبيعات */}
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">يظهر كبائع في فواتير المبيعات</p>
            <p className="text-xs text-muted-foreground">يسمح لهذا المستخدم بالظهور كبائع في شاشة إنشاء فاتورة المبيعات</p>
          </div>
          <Switch
            checked={!!(selectedUser?.canBeSalesperson)}
            onCheckedChange={(v) => {
              updateUser.mutate({ id: selectedUser.id, canBeSalesperson: v });
            }}
            disabled={updateUser.isPending}
          />
        </div>
      </div>

      {/* الفروع المُسندة */}
      <UserBranchAssignmentsPanel userId={selectedUser.id} orgId={selectedUser.orgId} />

      {/* صلاحيات العمل */}
      {(selectedUser?.role === "admin" || selectedUser?.role === "superadmin") ? (
        <p className="text-xs text-muted-foreground bg-muted/40 border rounded-xl px-3 py-2.5">
          مدير النظام يملك جميع صلاحيات العمل دائماً — لا حاجة لتفعيل صلاحيات إضافية.
        </p>
      ) : (
        <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
          <p className="font-semibold">صلاحيات العمل</p>
          {WORK_PERM_DEFS.map((d, i) => (
            <div key={d.key} className={`flex items-center justify-between ${i > 0 ? "border-t pt-3" : ""}`}>
              <div>
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.desc}</p>
              </div>
              <Switch
                checked={extraPerms[d.key] === true}
                onCheckedChange={(v) => togglePerm(d.key, v)}
              />
            </div>
          ))}
          {permsDirty && (
            <Button size="sm" variant="outline" onClick={handleSavePerms}
              disabled={setExtraPermissions.isPending} className="gap-1 mt-2">
              {setExtraPermissions.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              حفظ إعدادات العمل
            </Button>
          )}
        </div>
      )}

      {/* إعدادات استعادة كلمة المرور */}
      <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
        <p className="font-semibold">إعدادات استعادة كلمة المرور</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">استعادة عبر الجوال</p>
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
        <div className="border-t pt-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">استعادة عبر البريد</p>
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
        {/* التحقق من الجوال والبريد */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">إرسال رمز التحقق</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VerifyBadge verified={!!selectedUser?.phoneVerifiedAt} label="الجوال" />
            </div>
            {selectedUser?.phone && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                disabled={sendVerification.isPending}
                onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "phone" })}>
                {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                إرسال رمز
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VerifyBadge verified={!!selectedUser?.emailVerifiedAt} label="البريد" />
            </div>
            {selectedUser?.email && (
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                disabled={sendVerification.isPending}
                onClick={() => sendVerification.mutate({ userId: selectedUser.id, channel: "email" })}>
                {sendVerification.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                إرسال رمز
              </Button>
            )}
          </div>
        </div>
        {recoveryDirty && (
          <Button size="sm" variant="outline" onClick={handleSaveRecovery}
            disabled={setRecoveryOptions.isPending} className="gap-1">
            {setRecoveryOptions.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            حفظ إعدادات الاستعادة
          </Button>
        )}
      </div>
    </>
  ) : null;

  // ── محتوى تبويب الصلاحيات ────────────────────────────────────────────────
  const permissionsTabContent = mode === "edit" && selectedUser ? (
    <>
      {/* صلاحيات المساعدة والخدمات */}
      <section className="rounded-2xl border bg-muted/20 p-4 space-y-3">
        <p className="font-semibold flex items-center gap-1.5">
          <LifeBuoy className="w-4 h-4 text-muted-foreground" />
          صلاحيات وحدة المساعدة والخدمات
        </p>
        {(selectedUser?.role === "admin" || selectedUser?.role === "superadmin") ? (
          <p className="text-xs text-muted-foreground bg-background border rounded-lg px-3 py-2.5">
            مدير النظام يرى وحدة المساعدة والخدمات وجميع شاشاتها دائمًا.
          </p>
        ) : (
          <>
            {HS_PERM_DEFS.map((d, i) => (
              <div key={d.key} className={`flex items-center justify-between ${i > 0 ? "border-t pt-3" : ""}`}>
                <div>
                  <p className={`text-sm ${d.isModule ? "font-semibold" : "font-medium"}`}>{d.label}</p>
                  {d.isModule && (
                    <p className="text-xs text-muted-foreground">بدونها لا تظهر الوحدة إطلاقًا</p>
                  )}
                </div>
                <Switch
                  checked={extraPerms[d.key] === true}
                  disabled={!d.isModule && extraPerms[HS_MODULE_PERM] !== true}
                  onCheckedChange={(v) => togglePerm(d.key, v)}
                  data-testid={`switch-perm-${d.key}`}
                />
              </div>
            ))}
            {extraPerms[HS_MODULE_PERM] !== true && (
              <p className="text-xs text-amber-600 border-t pt-2">
                ⚠ فعّل صلاحية الوحدة أولًا لتتمكن من تفعيل صلاحيات الشاشات.
              </p>
            )}
          </>
        )}
      </section>

      {/* صلاحيات المساعد الذكي */}
      <section className="rounded-2xl border bg-muted/20 p-4 space-y-3">
        <p className="font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-muted-foreground" />
          صلاحيات المساعد الذكي
        </p>
        {(selectedUser?.role === "admin" || selectedUser?.role === "superadmin") ? (
          <p className="text-xs text-muted-foreground bg-background border rounded-lg px-3 py-2.5">
            مدير النظام يملك جميع صلاحيات المساعد الذكي دائمًا.
          </p>
        ) : (
          <>
            {AI_PERM_DEFS.map((d, i) => (
              <div key={d.key} className={`flex items-center justify-between ${i > 0 ? "border-t pt-3" : ""}`}>
                <div>
                  <p className={`text-sm ${d.isModule ? "font-semibold" : "font-medium"}`}>{d.label}</p>
                  {d.isModule && (
                    <p className="text-xs text-muted-foreground">بدونها لا يستطيع المستخدم فتح المساعد الذكي</p>
                  )}
                </div>
                <Switch
                  checked={extraPerms[d.key] === true}
                  disabled={!d.isModule && extraPerms[AI_MODULE_PERM] !== true}
                  onCheckedChange={(v) => togglePerm(d.key, v)}
                  data-testid={`switch-perm-${d.key}`}
                />
              </div>
            ))}
            {extraPerms[AI_MODULE_PERM] !== true && (
              <p className="text-xs text-amber-600 border-t pt-2">
                ⚠ فعّل صلاحية «استخدام المساعد الذكي» أولًا لتتمكن من تفعيل بقية الصلاحيات.
              </p>
            )}
          </>
        )}
      </section>

      {permsDirty && (
        <Button size="sm" variant="outline" onClick={handleSavePerms}
          disabled={setExtraPermissions.isPending} className="gap-1"
          data-testid="button-save-perms">
          {setExtraPermissions.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          حفظ الصلاحيات
        </Button>
      )}
    </>
  ) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المستخدمين وصلاحياتهم وخيارات الأمان</p>
        </div>
        <Button onClick={openCreate} disabled={countInfo?.atLimit} className="gap-2">
          <Plus className="w-4 h-4" />إضافة مستخدم
        </Button>
      </div>

      {/* ── سياسة كلمات المرور ── */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium">السماح بمستخدمين بدون كلمة مرور</p>
            <p className="text-xs text-muted-foreground">
              ينطبق على المستخدمين غير الإداريين فقط — حسابات مدير النظام تبقى محمية بكلمة مرور دائماً
            </p>
          </div>
        </div>
        <Switch
          checked={allowPasswordless}
          disabled={setPolicy.isPending}
          onCheckedChange={(v) => setPolicy.mutate({ key: PASSWORDLESS_KEY, value: v })}
        />
      </div>

      {/* ── كارت عدد المستخدمين ── */}
      {countInfo && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="shadow-none border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <UsersIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المستخدمون الحاليون</p>
                <p className="text-xl font-bold leading-tight">
                  {countInfo.current} <span className="text-sm font-normal text-muted-foreground">/ {countInfo.max}</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className={`shadow-none border ${countInfo.remaining === 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${countInfo.remaining === 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                <Plus className={`w-5 h-5 ${countInfo.remaining === 0 ? "text-destructive" : "text-green-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المقاعد المتبقية</p>
                <p className={`text-xl font-bold leading-tight ${countInfo.remaining === 0 ? "text-destructive" : ""}`}>{countInfo.remaining}</p>
                {countInfo.remaining === 0 && <p className="text-[10px] text-destructive leading-tight">تجاوز الحد المسموح</p>}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-base">🪪</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الحد الأقصى بالترخيص</p>
                <p className="text-xl font-bold leading-tight">{countInfo.max}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {countInfo?.atLimit && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2.5">
          <span>⚠</span>
          <span>وصلت إلى الحد الأقصى لعدد المستخدمين ({countInfo.max}). لإضافة مستخدمين جدد يرجى ترقية الترخيص.</span>
        </div>
      )}

      {/* ── جدول المستخدمين ── */}
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
                <TableHead className="text-right">المجموعة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : usersList?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا يوجد مستخدمون</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                      <Plus className="w-3.5 h-3.5 me-1" />إضافة أول مستخدم
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                usersList?.map((u: any) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground font-mono">{u.code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{u.name}</div>
                      {u.forcePasswordChange && <div className="text-xs text-amber-600">يجب تغيير كلمة المرور</div>}
                      {u.allowLogin === false && <div className="text-xs text-red-500">مقيّد الدخول</div>}
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
                    <TableCell className="text-sm text-muted-foreground">
                      {u.userGroupId
                        ? ((userGroups as any[]).find((g) => g.id === u.userGroupId)?.name ?? <span className="text-xs opacity-40">—</span>)
                        : <span className="text-xs opacity-40">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.isActive}
                          disabled={toggleActive.isPending}
                          onCheckedChange={(v) => toggleActive.mutate({ id: u.id, isActive: v })}
                          title={u.isActive ? "إيقاف المستخدم" : "تفعيل المستخدم"}
                        />
                        <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                          {u.isActive ? "نشط" : "موقوف"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="تغيير كلمة المرور" onClick={() => setPasswordUser(u)}>
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── نافذة إضافة / تعديل (التصميم الجديد) ─────────────────────────── */}
      <UserFormDialog
        open={isOpen}
        mode={mode}
        initialValue={initialValue}
        onOpenChange={setIsOpen}
        onSubmit={handleDialogSubmit}
        groups={userGroups as any[]}
        branches={branchesList as any[]}
        warehouses={warehousesList as any[]}
        loginTabExtension={loginTabExtension}
        workTabContent={workTabContent}
        permissionsTabContent={permissionsTabContent}
      />

      {/* ─── نافذة الحذف ─────────────────────────────────────────────────── */}
      {mode === "edit" && selectedUser && (
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
      )}

      {/* ─── نافذة تغيير كلمة المرور ────────────────────────────────────── */}
      {passwordUser && (
        <ChangeUserPasswordDialog user={passwordUser} onClose={() => setPasswordUser(null)} allowPasswordless={allowPasswordless} />
      )}

      {/* ─── نافذة تأكيد OTP ─────────────────────────────────────────────── */}
      {verifyDialog && selectedUser && (
        <VerifyOtpDialog
          open={verifyDialog.open}
          onClose={() => setVerifyDialog(null)}
          userId={selectedUser.id}
          channel={verifyDialog.channel}
          devOtp={verifyDialog.devOtp}
          onSuccess={() => { utils.users.list.invalidate(); }}
        />
      )}
    </div>
  );
}
