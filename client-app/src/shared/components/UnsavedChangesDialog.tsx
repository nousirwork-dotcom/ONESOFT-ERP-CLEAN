import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { AlertTriangle } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel,
  isSaving,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            تغييرات غير محفوظة
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          لديك تغييرات لم تُحفظ بعد. هل تريد حفظها قبل الخروج؟
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onSave} disabled={isSaving} className="gap-1">
            {isSaving ? "جاري الحفظ..." : "حفظ ثم خروج"}
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={isSaving}>
            خروج بدون حفظ
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            إلغاء والعودة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
