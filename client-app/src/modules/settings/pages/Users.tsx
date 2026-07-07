import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import { Pencil, Plus, Shield, Trash2, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  cashier: "كاشير",
  warehouse_manager: "مدير مخزن",
  viewer: "مشاهد",
  user: "مستخدم",
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

function validatePhone(val: string): string | null {
  if (!val) return null;
  if (!PHONE_REGEX.test(val.replace(/\s/g, "")))
    return "رقم الجوال غير صحيح. يجب أن يكون بين 8 و15 رقمًا (مع + اختيارية)";
  return null;
}

type Mode = "create" | "edit";

interface FormState {
  code: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  newPassword: string;
  role: string;
}

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  phone: "",
  email: "",
  username: "",
  password: "",
  newPassword: "",
  role: "user",
});

export default function Users() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("تم إنشاء المستخدم بنجاح");
      setIsOpen(false);
    },
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

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("تم حذف المستخدم");
      setShowDeleteConfirm(false);
      setIsOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setMode("create");
    setSelectedUser(null);
    setForm(emptyForm());
    setPhoneError(null);
    setIsOpen(true);
  };

  const openEdit = (u: any) => {
    setMode("edit");
    setSelectedUser(u);
    setForm({
      code: u.code ?? "",
      name: u.name ?? "",
      phone: u.phone ?? "",
      email: u.email ?? "",
      username: u.username ?? "",
      password: "",
      newPassword: "",
      role: u.role ?? "user",
    });
    setPhoneError(null);
    setIsOpen(true);
  };

  const setField = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "phone") setPhoneError(validatePhone(v));
  };

  const handleSubmit = () => {
    const err = validatePhone(form.phone);
    if (err) { setPhoneError(err); return; }

    if (mode === "create") {
      if (!form.name.trim()) { toast.error("الاسم الكامل مطلوب"); return; }
      if (!form.username.trim()) { toast.error("اسم المستخدم مطلوب"); return; }
      if (form.password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
      createUser.mutate({
        code: form.code || undefined,
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        username: form.username,
        password: form.password,
        role: form.role as any,
      });
    } else {
      updateUser.mutate({
        id: selectedUser.id,
        name: form.name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        role: form.role as any,
        newPassword: form.newPassword || undefined,
      });
    }
  };

  const handleDelete = () => {
    if (selectedUser) deleteUser.mutate({ id: selectedUser.id });
  };

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground text-sm mt-0.5">إدارة المستخدمين وصلاحياتهم</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة مستخدم
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
                <TableHead className="text-right w-24">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
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
                users?.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground font-mono">{(u as any).code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.username}</TableCell>
                    <TableCell className="text-muted-foreground text-sm" dir="ltr">
                      {(u as any).phone ?? <span className="text-muted-foreground/40 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[u.role] ?? roleColors.user}`}>
                        {roleLabels[u.role] ?? u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(u as any).isActive ? "default" : "secondary"} className="text-xs">
                        {(u as any).isActive ? "نشط" : "موقوف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)} title="تعديل">
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

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {mode === "create" ? "إضافة مستخدم جديد" : `تعديل: ${selectedUser?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الكود <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                <Input
                  className="mt-1"
                  placeholder="مثال: USR001"
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  disabled={mode === "edit"}
                />
              </div>
              <div>
                <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                <Input
                  className="mt-1"
                  placeholder="الاسم الكامل"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>
                رقم الجوال
                <span className="text-muted-foreground text-xs me-1"> (اختياري — يُستخدم لاحقًا في استعادة كلمة المرور)</span>
              </Label>
              <Input
                className={`mt-1 ${phoneError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                placeholder="مثال: +9665xxxxxxxx أو 05xxxxxxxx"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                dir="ltr"
                type="tel"
              />
              {phoneError && (
                <p className="text-red-500 text-xs mt-1">{phoneError}</p>
              )}
              {!form.phone && (
                <p className="text-amber-600 text-xs mt-1">
                  ⚠ يُفضَّل إدخال رقم الجوال لتفعيل استعادة كلمة المرور لاحقًا.
                </p>
              )}
            </div>

            <div>
              <Label>البريد الإلكتروني <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
              <Input
                className="mt-1"
                placeholder="example@company.com"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم المستخدم {mode === "create" && <span className="text-red-500">*</span>}</Label>
                <Input
                  className="mt-1"
                  placeholder="اسم الدخول"
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                  disabled={mode === "edit"}
                  dir="ltr"
                />
                {mode === "edit" && (
                  <p className="text-xs text-muted-foreground mt-0.5">لا يمكن تغيير اسم المستخدم</p>
                )}
              </div>
              <div>
                <Label>
                  {mode === "create" ? (
                    <><span>كلمة المرور</span> <span className="text-red-500">*</span></>
                  ) : (
                    <span>كلمة مرور جديدة <span className="text-muted-foreground text-xs">(اختياري)</span></span>
                  )}
                </Label>
                <Input
                  className="mt-1"
                  type="password"
                  placeholder={mode === "create" ? "6 أحرف على الأقل" : "اتركه فارغًا إن لم تُرِد التغيير"}
                  value={mode === "create" ? form.password : form.newPassword}
                  onChange={(e) => setField(mode === "create" ? "password" : "newPassword", e.target.value)}
                  dir="ltr"
                />
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
          </div>

          <DialogFooter className="flex-row-reverse sm:flex-row gap-2 pt-2">
            {mode === "edit" && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="mr-auto gap-1"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </Button>
            )}
            <div className="flex gap-2 ms-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={isPending || !!phoneError}>
                {isPending ? "جاري الحفظ..." : mode === "create" ? "إنشاء المستخدم" : "حفظ التعديلات"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف المستخدم "<span className="font-medium text-foreground">{selectedUser?.name}</span>"؟
            سيتم تعطيل حسابه ولن يتمكن من تسجيل الدخول.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
