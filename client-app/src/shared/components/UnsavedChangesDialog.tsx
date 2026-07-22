import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLang } from "@/core/contexts/LanguageContext";
import { t } from "@/shared/lib/translations";

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
  const { lang, isAr } = useLang();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {t(lang, "unsavedTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          {t(lang, "unsavedMessage")}
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onSave} disabled={isSaving} className="gap-1">
            {isSaving ? t(lang, "unsavedSaving") : t(lang, "unsavedSave")}
          </Button>
          <Button variant="destructive" onClick={onDiscard} disabled={isSaving}>
            {t(lang, "unsavedDiscard")}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {t(lang, "unsavedCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
