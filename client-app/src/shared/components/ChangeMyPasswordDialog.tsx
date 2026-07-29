import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { trpc } from "@/shared/lib/trpc";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ChangeMyPasswordDialog({
  open, onClose,
}: {
  open: boolean; onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const changePass = trpc.users.changeMyPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrent(""); setNext(""); setConfirm(""); setError("");
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = () => {
    if (next.length < 6) { setError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل"); return; }
    if (next !== confirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    setError("");
    changePass.mutate({ currentPassword: current, newPassword: next });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            تغيير كلمة المرور
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label>كلمة المرور الحالية</Label>
            <Input
              className="mt-1" type="password" dir="ltr"
              placeholder="اتركها فارغة إن لم تكن معيّنة"
              value={current} onChange={(e) => setCurrent(e.target.value)}
              autoFocus
              data-global-keyboard="false"
            />
          </div>
          <div>
            <Label>كلمة المرور الجديدة <span className="text-red-500">*</span></Label>
            <Input
              className="mt-1" type="password" dir="ltr"
              placeholder="6 أحرف على الأقل"
              value={next} onChange={(e) => setNext(e.target.value)}
              data-global-keyboard="false"
            />
          </div>
          <div>
            <Label>تأكيد كلمة المرور الجديدة <span className="text-red-500">*</span></Label>
            <Input
              className="mt-1" type="password" dir="ltr"
              placeholder="أعد كتابتها"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !changePass.isPending && handleSubmit()}
              data-global-keyboard="false"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={changePass.isPending}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={changePass.isPending || !next || !confirm}>
            {changePass.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin me-1" />جاري الحفظ...</> : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
