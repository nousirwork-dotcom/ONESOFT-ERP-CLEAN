import { fmtDate } from "@/shared/utils/dateUtils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { trpc } from "@/shared/lib/trpc";
import { Shield, Trash2, Users as UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  cashier: "كاشير",
  warehouse_manager: "مدير مخزن",
  user: "مستخدم",
};
const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  cashier: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_manager: "bg-amber-100 text-amber-700 border-amber-200",
  user: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function Users() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [role, setRole] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("تم تحديث الصلاحية"); setIsOpen(false); },
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

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setRole(u.role ?? "user");
    setBranchId(u.branchId ? String(u.branchId) : "");
    setIsOpen(true);
  };
  const handleSubmit = () => {
    updateRole.mutate({ userId: selectedUser.id, role: role as any, branchId: branchId ? Number(branchId) : undefined });
  };
  const handleDelete = () => {
    if (selectedUser) deleteUser.mutate({ id: selectedUser.id });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <p className="text-muted-foreground text-sm mt-0.5">إدارة صلاحيات وأدوار المستخدمين</p>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">الفرع</TableHead>
                <TableHead className="text-right">آخر دخول</TableHead>
                <TableHead className="text-right w-20">الصلاحيات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>))}</TableRow>
                ))
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>لا يوجد مستخدمون</p>
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[u.role] ?? roleColors.user}`}>
                        {roleLabels[u.role] ?? u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {branches?.find((b) => b.id === (u as any).branchId)?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDate(u.lastSignedIn)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                        <Shield className="w-3.5 h-3.5" />
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تعديل صلاحيات: {selectedUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الدور</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير النظام</SelectItem>
                  <SelectItem value="cashier">كاشير</SelectItem>
                  <SelectItem value="warehouse_manager">مدير مخزن</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفرع</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="بدون فرع محدد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون فرع</SelectItem>
                  {branches?.map((b) => (<SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="mr-auto gap-1"
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
            <div className="flex gap-2 ms-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
              <Button onClick={handleSubmit} disabled={updateRole.isPending}>حفظ الصلاحيات</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف المستخدم "<span className="font-medium text-foreground">{selectedUser?.name}</span>"؟ سيتم تعطيل حساب المستخدم ولن يتمكن من تسجيل الدخول.
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
